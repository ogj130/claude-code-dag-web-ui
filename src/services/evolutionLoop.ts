/**
 * evolutionLoop — 自进化学习闭环
 *
 * 4 阶段循环：Execute → Evaluate → Abstract → Refine
 *
 * Execute:  记录执行轨迹（任务、工具、结果、耗时、Token）
 * Evaluate: 质量评分（成功率 + Token 效率 + 用户满意度）
 * Abstract: LLM 辅助模式提取 → 候选 Skill 生成
 * Refine:   低效 Skill 淘汰 + 置信度衰减
 *
 * 使用方式：
 *   import { evolutionLoop } from '@/services/evolutionLoop';
 *   evolutionLoop.recordExecution(trace);
 *   await evolutionLoop.runCycle(workspaceId);
 */

// ── 类型定义 ────────────────────────────────────────────────

/** 执行轨迹 */
export interface ExecutionTrace {
  id: string;
  workspaceId: string;
  timestamp: number;
  taskDescription: string;
  toolsUsed: string[];
  isSuccess: boolean;
  errorMessage?: string;
  tokenCount: number;
  durationMs: number;
  userSatisfaction?: number; // 1-5 评分
}

/** 质量评估结果 */
export interface QualityScore {
  traceId: string;
  successRate: number;
  tokenEfficiency: number; // 0-1, 越高越好
  satisfactionScore: number; // 0-1
  overallScore: number; // 加权平均
}

/** 候选 Skill */
export interface CandidateSkill {
  id: string;
  name: string;
  description: string;
  content: string; // Skill 内容（prompt 模板或代码片段）
  source: 'llm_extracted' | 'frequency_pattern';
  confidence: number;
  createdAt: number;
  traces: string[]; // 关联的 trace IDs
}

/** 进化周期结果 */
export interface CycleResult {
  phase: string;
  tracesProcessed: number;
  scoresGenerated: number;
  candidatesExtracted: number;
  candidatesRefined: number;
  skillsMerged: number;
  skillsEliminated: number;
}

// ── 配置 ────────────────────────────────────────────────────

const EVOLUTION_CONFIG = {
  /** 最少轨迹数才触发完整周期 */
  minTracesForCycle: 5,
  /** 每次最多处理的轨迹数 */
  maxTracesPerCycle: 100,
  /** 候选 Skill 置信度阈值（低于此值被淘汰） */
  skillConfidenceThreshold: 0.3,
  /** 置信度衰减因子（每个周期） */
  confidenceDecayFactor: 0.95,
  /** Token 效率基准（每任务 token 消耗中位数） */
  tokenEfficiencyBaseline: 2000,
  /** 评分权重 */
  scoreWeights: {
    successRate: 0.4,
    tokenEfficiency: 0.3,
    satisfaction: 0.3,
  },
} as const;

// ── 状态 ────────────────────────────────────────────────────

const _pendingTraces: ExecutionTrace[] = [];
const _scores: Map<string, QualityScore> = new Map();
const _candidateSkills: Map<string, CandidateSkill> = new Map();
let _cycleCount = 0;

// ── 辅助 ────────────────────────────────────────────────────

function generateId(): string {
  return `evo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Phase 1: Execute ────────────────────────────────────────

/**
 * 记录一条执行轨迹
 */
export function recordExecution(trace: Omit<ExecutionTrace, 'id' | 'timestamp'>): string {
  const id = generateId();
  const fullTrace: ExecutionTrace = {
    ...trace,
    id,
    timestamp: Date.now(),
  };
  _pendingTraces.push(fullTrace);
  return id;
}

/**
 * 获取所有待处理轨迹
 */
export function getPendingTraces(workspaceId?: string): ExecutionTrace[] {
  if (workspaceId) {
    return _pendingTraces.filter((t) => t.workspaceId === workspaceId);
  }
  return [..._pendingTraces];
}

// ── Phase 2: Evaluate ───────────────────────────────────────

/**
 * 计算单条轨迹的质量评分
 */
export function evaluateTrace(trace: ExecutionTrace): QualityScore {
  const successRate = trace.isSuccess ? 1.0 : 0.0;

  const tokenEfficiency = Math.min(
    1.0,
    EVOLUTION_CONFIG.tokenEfficiencyBaseline / Math.max(trace.tokenCount, 1)
  );

  const satisfactionScore = trace.userSatisfaction
    ? trace.userSatisfaction / 5.0
    : trace.isSuccess ? 0.7 : 0.3; // 无评分时用默认值

  const w = EVOLUTION_CONFIG.scoreWeights;
  const overallScore =
    w.successRate * successRate +
    w.tokenEfficiency * tokenEfficiency +
    w.satisfaction * satisfactionScore;

  const score: QualityScore = {
    traceId: trace.id,
    successRate,
    tokenEfficiency,
    satisfactionScore,
    overallScore: Math.round(overallScore * 100) / 100,
  };

  _scores.set(trace.id, score);
  return score;
}

/**
 * 批量评估轨迹
 */
export function evaluateTraces(traces: ExecutionTrace[]): QualityScore[] {
  return traces.map(evaluateTrace);
}

/**
 * 获取评分统计摘要
 */
export function getScoreSummary(): {
  totalScored: number;
  avgScore: number;
  avgSuccessRate: number;
  avgTokenEfficiency: number;
} {
  const all = [..._scores.values()];
  if (all.length === 0) {
    return { totalScored: 0, avgScore: 0, avgSuccessRate: 0, avgTokenEfficiency: 0 };
  }

  const sum = all.reduce(
    (acc, s) => ({
      score: acc.score + s.overallScore,
      success: acc.success + s.successRate,
      token: acc.token + s.tokenEfficiency,
    }),
    { score: 0, success: 0, token: 0 }
  );

  return {
    totalScored: all.length,
    avgScore: Math.round((sum.score / all.length) * 100) / 100,
    avgSuccessRate: Math.round((sum.success / all.length) * 100) / 100,
    avgTokenEfficiency: Math.round((sum.token / all.length) * 100) / 100,
  };
}

// ── Phase 3: Abstract ───────────────────────────────────────

/** 按工具组合分组的频次统计 */
interface ToolPattern {
  tools: string;
  count: number;
  traces: string[];
  successRate: number;
  avgToken: number;
}

/**
 * 从执行轨迹中提取模式（降级：频率统计）
 *
 * 实际应用中会调用 LLM 分析 traces → 提取通用模式。
 * 当前使用频率统计作为降级方案。
 */
export function extractPatterns(traces: ExecutionTrace[]): ToolPattern[] {
  const patternMap = new Map<string, ToolPattern>();

  for (const trace of traces) {
    const tools = [...trace.toolsUsed].sort().join('+');
    const existing = patternMap.get(tools);

    if (existing) {
      existing.count++;
      existing.traces.push(trace.id);
      existing.successRate = (existing.successRate * (existing.count - 1) + (trace.isSuccess ? 1 : 0)) / existing.count;
      existing.avgToken = (existing.avgToken * (existing.count - 1) + trace.tokenCount) / existing.count;
    } else {
      patternMap.set(tools, {
        tools,
        count: 1,
        traces: [trace.id],
        successRate: trace.isSuccess ? 1 : 0,
        avgToken: trace.tokenCount,
      });
    }
  }

  // 只保留出现 >= 2 次的模式
  return [...patternMap.values()].filter((p) => p.count >= 2);
}

/**
 * 从工具模式生成候选 Skill
 */
export function generateCandidateSkills(
  patterns: ToolPattern[],
  traces: ExecutionTrace[]
): CandidateSkill[] {
  const traceMap = new Map(traces.map((t) => [t.id, t]));
  const candidates: CandidateSkill[] = [];

  for (const pattern of patterns) {
    const confidence = Math.min(0.95, 0.3 + pattern.count * 0.1 + pattern.successRate * 0.3);
    const sampleTraces = pattern.traces.slice(0, 5).map((id) => traceMap.get(id)).filter(Boolean) as ExecutionTrace[];

    const description = `工具组合 [${pattern.tools}] 被成功使用 ${pattern.count} 次，` +
      `成功率 ${(pattern.successRate * 100).toFixed(0)}%，` +
      `平均 Token ${Math.round(pattern.avgToken)}`;

    const content = JSON.stringify({
      tools: pattern.tools.split('+'),
      avgToken: Math.round(pattern.avgToken),
      successRate: pattern.successRate,
      examples: sampleTraces.map((t) => t.taskDescription).slice(0, 3),
    });

    const candidate: CandidateSkill = {
      id: generateId(),
      name: `skill_${pattern.tools.replace(/\+/g, '_')}`,
      description,
      content,
      source: 'frequency_pattern',
      confidence: Math.round(confidence * 100) / 100,
      createdAt: Date.now(),
      traces: pattern.traces,
    };

    candidates.push(candidate);
    _candidateSkills.set(candidate.id, candidate);
  }

  return candidates;
}

// ── Phase 4: Refine ─────────────────────────────────────────

/**
 * 置信度衰减（每个进化周期调用）
 *
 * 低使用率的 Skill 置信度逐渐降低，最终被淘汰。
 */
export function decayConfidence(): number {
  let decayed = 0;
  for (const [id, skill] of _candidateSkills) {
    const newConfidence = skill.confidence * EVOLUTION_CONFIG.confidenceDecayFactor;
    _candidateSkills.set(id, { ...skill, confidence: Math.round(newConfidence * 100) / 100 });
    decayed++;
  }
  return decayed;
}

/**
 * 淘汰低置信度 Skill
 */
export function eliminateLowConfidenceSkills(): CandidateSkill[] {
  const eliminated: CandidateSkill[] = [];

  for (const [id, skill] of _candidateSkills) {
    if (skill.confidence < EVOLUTION_CONFIG.skillConfidenceThreshold) {
      eliminated.push(skill);
      _candidateSkills.delete(id);
    }
  }

  return eliminated;
}

/**
 * 获取所有候选 Skill
 */
export function getCandidateSkills(): CandidateSkill[] {
  return [..._candidateSkills.values()];
}

// ── 完整周期 ────────────────────────────────────────────────

/**
 * 执行一次完整的进化周期
 *
 * Execute → Evaluate → Abstract → Refine
 */
export async function runCycle(workspaceId: string): Promise<CycleResult> {
  const traces = _pendingTraces.filter((t) => t.workspaceId === workspaceId);

  if (traces.length < EVOLUTION_CONFIG.minTracesForCycle) {
    return {
      phase: 'skipped',
      tracesProcessed: 0,
      scoresGenerated: 0,
      candidatesExtracted: 0,
      candidatesRefined: 0,
      skillsMerged: 0,
      skillsEliminated: 0,
    };
  }

  const batch = traces.slice(0, EVOLUTION_CONFIG.maxTracesPerCycle);

  // Phase 2: Evaluate
  const scores = evaluateTraces(batch);

  // Phase 3: Abstract
  const patterns = extractPatterns(batch);
  const candidates = generateCandidateSkills(patterns, batch);

  // Phase 4: Refine
  decayConfidence();
  const eliminated = eliminateLowConfidenceSkills();

  _cycleCount++;

  // 清除已处理的轨迹
  const processedIds = new Set(batch.map((t) => t.id));
  for (let i = _pendingTraces.length - 1; i >= 0; i--) {
    if (processedIds.has(_pendingTraces[i].id)) {
      _pendingTraces.splice(i, 1);
    }
  }

  return {
    phase: 'complete',
    tracesProcessed: batch.length,
    scoresGenerated: scores.length,
    candidatesExtracted: candidates.length,
    candidatesRefined: candidates.length,
    skillsMerged: 0,
    skillsEliminated: eliminated.length,
  };
}

/**
 * 获取进化循环状态
 */
export function getEvolutionStatus() {
  return {
    cycleCount: _cycleCount,
    pendingTraces: _pendingTraces.length,
    totalScores: _scores.size,
    totalCandidates: _candidateSkills.size,
    config: EVOLUTION_CONFIG,
  };
}

/**
 * 重置所有状态（测试用）
 */
export function resetEvolutionState(): void {
  _pendingTraces.length = 0;
  _scores.clear();
  _candidateSkills.clear();
  _cycleCount = 0;
}
