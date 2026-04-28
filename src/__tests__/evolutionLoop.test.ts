/**
 * evolutionLoop + skillDefense 集成测试
 *
 * 覆盖完整 4 阶段流程：Execute → Evaluate → Abstract → Refine
 * 加上 Skill 防爆炸三层防线
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordExecution,
  getPendingTraces,
  evaluateTrace,
  evaluateTraces,
  getScoreSummary,
  extractPatterns,
  generateCandidateSkills,
  decayConfidence,
  eliminateLowConfidenceSkills,
  getCandidateSkills,
  runCycle,
  getEvolutionStatus,
  resetEvolutionState,
  type ExecutionTrace,
} from '../services/evolutionLoop';
import { runDefense, getDefenseConfig } from '../services/skillDefense';

// ── 辅助 ────────────────────────────────────────────────────

function makeTrace(overrides: Partial<ExecutionTrace> = {}): ExecutionTrace {
  return {
    id: `trace_${Math.random().toString(36).slice(2)}`,
    workspaceId: 'ws1',
    timestamp: Date.now(),
    taskDescription: 'Fix TypeScript error',
    toolsUsed: ['read', 'edit'],
    isSuccess: true,
    tokenCount: 1500,
    durationMs: 3000,
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────

describe('evolutionLoop', () => {
  beforeEach(() => {
    resetEvolutionState();
  });

  // ── Execute 阶段 ─────────────────────────────────────────

  describe('Execute: recordExecution', () => {
    it('记录执行轨迹并返回 ID', () => {
      const id = recordExecution({
        workspaceId: 'ws1',
        taskDescription: 'Fix bug',
        toolsUsed: ['read', 'edit'],
        isSuccess: true,
        tokenCount: 1000,
        durationMs: 2000,
      });
      expect(id).toBeTruthy();
      expect(getPendingTraces()).toHaveLength(1);
    });

    it('按工作区过滤轨迹', () => {
      recordExecution({ workspaceId: 'ws1', taskDescription: 'A', toolsUsed: [], isSuccess: true, tokenCount: 100, durationMs: 100 });
      recordExecution({ workspaceId: 'ws2', taskDescription: 'B', toolsUsed: [], isSuccess: true, tokenCount: 100, durationMs: 100 });
      expect(getPendingTraces('ws1')).toHaveLength(1);
      expect(getPendingTraces('ws2')).toHaveLength(1);
    });
  });

  // ── Evaluate 阶段 ────────────────────────────────────────

  describe('Evaluate: evaluateTrace', () => {
    it('成功轨迹评分高于失败轨迹', () => {
      const successTrace = makeTrace({ isSuccess: true, tokenCount: 1000 });
      const failTrace = makeTrace({ isSuccess: false, tokenCount: 1000 });

      const sScore = evaluateTrace(successTrace);
      const fScore = evaluateTrace(failTrace);

      expect(sScore.overallScore).toBeGreaterThan(fScore.overallScore);
    });

    it('低 Token 消耗效率更高', () => {
      const efficient = makeTrace({ tokenCount: 500 });
      const wasteful = makeTrace({ tokenCount: 5000 });

      const eScore = evaluateTrace(efficient);
      const wScore = evaluateTrace(wasteful);

      expect(eScore.tokenEfficiency).toBeGreaterThan(wScore.tokenEfficiency);
    });

    it('用户满意度影响评分', () => {
      const happy = makeTrace({ userSatisfaction: 5 });
      const unhappy = makeTrace({ userSatisfaction: 1 });

      const hScore = evaluateTrace(happy);
      const uScore = evaluateTrace(unhappy);

      expect(hScore.satisfactionScore).toBeGreaterThan(uScore.satisfactionScore);
    });

    it('getScoreSummary 统计正确', () => {
      evaluateTrace(makeTrace({ isSuccess: true, tokenCount: 1000 }));
      evaluateTrace(makeTrace({ isSuccess: false, tokenCount: 3000 }));

      const summary = getScoreSummary();
      expect(summary.totalScored).toBe(2);
      expect(summary.avgScore).toBeGreaterThan(0);
      expect(summary.avgSuccessRate).toBe(0.5);
    });
  });

  // ── Abstract 阶段 ────────────────────────────────────────

  describe('Abstract: extractPatterns', () => {
    it('相同工具组合被分组', () => {
      const traces = [
        makeTrace({ toolsUsed: ['read', 'edit'] }),
        makeTrace({ toolsUsed: ['read', 'edit'] }),
        makeTrace({ toolsUsed: ['read', 'edit'] }),
      ];

      const patterns = extractPatterns(traces);
      expect(patterns).toHaveLength(1);
      expect(patterns[0].count).toBe(3);
    });

    it('只出现 1 次的模式被过滤', () => {
      const traces = [
        makeTrace({ toolsUsed: ['read', 'edit'] }),
        makeTrace({ toolsUsed: ['bash'] }),
      ];

      const patterns = extractPatterns(traces);
      expect(patterns).toHaveLength(0);
    });

    it('不同工具组合分别统计', () => {
      const traces = [
        makeTrace({ toolsUsed: ['read', 'edit'] }),
        makeTrace({ toolsUsed: ['read', 'edit'] }),
        makeTrace({ toolsUsed: ['bash', 'grep'] }),
        makeTrace({ toolsUsed: ['bash', 'grep'] }),
      ];

      const patterns = extractPatterns(traces);
      expect(patterns).toHaveLength(2);
    });
  });

  describe('Abstract: generateCandidateSkills', () => {
    it('从模式生成候选 Skill', () => {
      const traces = [
        makeTrace({ toolsUsed: ['read', 'edit'] }),
        makeTrace({ toolsUsed: ['read', 'edit'] }),
        makeTrace({ toolsUsed: ['read', 'edit'] }),
      ];

      const patterns = extractPatterns(traces);
      const candidates = generateCandidateSkills(patterns, traces);

      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates[0].name).toContain('edit_read');
      expect(candidates[0].traces).toHaveLength(3);
    });

    it('置信度随频次增加', () => {
      const lowFreq = [
        makeTrace({ toolsUsed: ['a', 'b'] }),
        makeTrace({ toolsUsed: ['a', 'b'] }),
      ];
      const highFreq = [
        makeTrace({ toolsUsed: ['c', 'd'] }),
        makeTrace({ toolsUsed: ['c', 'd'] }),
        makeTrace({ toolsUsed: ['c', 'd'] }),
        makeTrace({ toolsUsed: ['c', 'd'] }),
        makeTrace({ toolsUsed: ['c', 'd'] }),
      ];

      const lowPatterns = extractPatterns(lowFreq);
      const highPatterns = extractPatterns(highFreq);
      const lowCand = generateCandidateSkills(lowPatterns, lowFreq);
      const highCand = generateCandidateSkills(highPatterns, highFreq);

      expect(highCand[0].confidence).toBeGreaterThan(lowCand[0].confidence);
    });
  });

  // ── Refine 阶段 ──────────────────────────────────────────

  describe('Refine: decayConfidence', () => {
    it('置信度随衰减降低', () => {
      const traces = [
        makeTrace({ toolsUsed: ['read'] }),
        makeTrace({ toolsUsed: ['read'] }),
      ];
      const patterns = extractPatterns(traces);
      generateCandidateSkills(patterns, traces);

      const before = getCandidateSkills()[0].confidence;
      decayConfidence();
      const after = getCandidateSkills()[0].confidence;

      expect(after).toBeLessThan(before);
    });

    it('多轮衰减后低置信度 Skill 被淘汰', () => {
      const traces = [
        makeTrace({ toolsUsed: ['x'] }),
        makeTrace({ toolsUsed: ['x'] }),
      ];
      const patterns = extractPatterns(traces);
      generateCandidateSkills(patterns, traces);

      // 多轮衰减
      for (let i = 0; i < 20; i++) {
        decayConfidence();
      }

      const eliminated = eliminateLowConfidenceSkills();
      expect(eliminated.length).toBeGreaterThan(0);
      expect(getCandidateSkills()).toHaveLength(0);
    });
  });

  // ── 完整周期 ─────────────────────────────────────────────

  describe('runCycle: 完整 4 阶段', () => {
    it('轨迹不足时跳过', async () => {
      recordExecution({ workspaceId: 'ws1', taskDescription: 'A', toolsUsed: [], isSuccess: true, tokenCount: 100, durationMs: 100 });
      const result = await runCycle('ws1');
      expect(result.phase).toBe('skipped');
    });

    it('完整周期处理轨迹并生成结果', async () => {
      for (let i = 0; i < 6; i++) {
        recordExecution({
          workspaceId: 'ws1',
          taskDescription: `Task ${i}`,
          toolsUsed: ['read', 'edit'],
          isSuccess: i % 2 === 0,
          tokenCount: 1000 + i * 100,
          durationMs: 2000,
        });
      }

      const result = await runCycle('ws1');
      expect(result.phase).toBe('complete');
      expect(result.tracesProcessed).toBe(6);
      expect(result.scoresGenerated).toBe(6);
    });

    it('周期后轨迹被清除', async () => {
      for (let i = 0; i < 5; i++) {
        recordExecution({ workspaceId: 'ws1', taskDescription: `T${i}`, toolsUsed: ['a'], isSuccess: true, tokenCount: 100, durationMs: 100 });
      }

      await runCycle('ws1');
      expect(getPendingTraces('ws1')).toHaveLength(0);
    });

    it('进化状态计数正确', async () => {
      for (let i = 0; i < 5; i++) {
        recordExecution({ workspaceId: 'ws1', taskDescription: `T${i}`, toolsUsed: ['a'], isSuccess: true, tokenCount: 100, durationMs: 100 });
      }

      await runCycle('ws1');
      const status = getEvolutionStatus();
      expect(status.cycleCount).toBe(1);
      expect(status.totalScores).toBe(5);
    });
  });
});

// ── skillDefense 测试 ───────────────────────────────────────

describe('skillDefense', () => {
  const makeSkill = (tools: string[], confidence = 0.5, traceCount = 3) => ({
    id: `skill_${Math.random().toString(36).slice(2)}`,
    name: `skill_${tools.join('_')}`,
    description: `Uses ${tools.join(', ')}`,
    content: JSON.stringify({ tools, examples: [] }),
    source: 'frequency_pattern' as const,
    confidence,
    createdAt: Date.now(),
    traces: Array.from({ length: traceCount }, (_, i) => `t${i}`),
  });

  describe('L1: 合并', () => {
    it('高重叠 Skill 被合并', () => {
      const skills = [
        makeSkill(['read', 'edit', 'bash']),
        makeSkill(['read', 'edit', 'bash']),  // 完全重叠
      ];

      const result = runDefense(skills);
      expect(result.l1Merge.merged).toBe(1);
      expect(result.l1Merge.surviving).toBe(1);
    });

    it('不同工具组合不合并', () => {
      const skills = [
        makeSkill(['read', 'edit']),
        makeSkill(['bash', 'grep']),
      ];

      const result = runDefense(skills);
      expect(result.l1Merge.merged).toBe(0);
      expect(result.l1Merge.surviving).toBe(2);
    });
  });

  describe('L2: 淘汰', () => {
    it('低置信度 Skill 被淘汰', () => {
      const skills = [
        makeSkill(['read'], 0.5, 3),   // 合格
        makeSkill(['bash'], 0.1, 3),   // 置信度太低
      ];

      const result = runDefense(skills);
      expect(result.l2Eliminate.eliminated).toBe(1);
      expect(result.l2Eliminate.surviving).toBe(1);
    });

    it('零 traces Skill 被淘汰', () => {
      const skills = [
        makeSkill(['read'], 0.5, 3),   // 合格
        makeSkill(['bash'], 0.5, 0),   // 零 traces
      ];

      const result = runDefense(skills);
      expect(result.l2Eliminate.eliminated).toBe(1);
    });
  });

  describe('L3: 审查', () => {
    it('少量 Skill 不触发审查', () => {
      const skills = Array.from({ length: 5 }, (_, i) =>
        makeSkill([`tool${i}`], 0.5, 3)
      );

      const result = runDefense(skills);
      expect(result.l3Review.needsReview).toBe(false);
    });

    it('超过阈值触发审查', () => {
      const config = getDefenseConfig();
      const skills = Array.from({ length: config.l3ReviewThreshold + 5 }, (_, i) =>
        makeSkill([`unique_tool_${i}`], 0.5, 3)
      );

      const result = runDefense(skills);
      expect(result.l3Review.needsReview).toBe(true);
      expect(result.l3Review.reviewCount).toBeGreaterThan(config.l3ReviewThreshold);
    });
  });
});
