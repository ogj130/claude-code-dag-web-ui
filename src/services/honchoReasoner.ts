/**
 * honchoReasoner — Honcho 辩证推理引擎
 *
 * 基于行为数据，通过 LLM 推理用户偏好。
 * 实现双 Peer 交叉验证（User Peer vs AI Peer）。
 *
 * 推理流程：
 *   1. 收集行为摘要 → 构建 Prompt
 *   2. LLM 推理 → 得到 User Peer 画像
 *   3. LLM 质疑 → 得到 AI Peer 反画像
 *   4. 交叉验证 → 合并为最终画像
 *
 * 使用方式：
 *   import { honchoReasoner } from '@/services/honchoReasoner';
 *   const profile = await honchoReasoner.infer(workspaceId);
 */

import { summarize, type BehaviorSummary } from './behaviorCollector';

// ── 类型定义 ────────────────────────────────────────────────

export type DimensionKey =
  | 'language'
  | 'framework'
  | 'pattern'
  | 'naming'
  | 'verbosity'
  | 'debugging'
  | 'skill_level'
  | 'testing';

export interface InferredDimension {
  key: DimensionKey;
  value: string;
  confidence: number; // 0-1
  reasoning: string;
  source: 'user_peer' | 'ai_peer' | 'merged';
}

export interface ReasoningResult {
  workspaceId: string;
  timestamp: number;
  dimensions: InferredDimension[];
  userPeerDimensions: InferredDimension[];
  aiPeerDimensions: InferredDimension[];
  convergenceScore: number; // 双 Peer 一致度
}

// ── Prompt 模板 ─────────────────────────────────────────────

export function buildUserPeerPrompt(summary: BehaviorSummary): string {
  return `你是一位资深开发者画像分析师。基于以下用户行为数据，推断用户的编码偏好。

## 行为数据
- 总事件数：${summary.totalEvents}
- 事件类型分布：${JSON.stringify(summary.byType)}
- 语言使用分布：${JSON.stringify(summary.languageDistribution)}
- 检测到的框架：${summary.frameworkHints.join(', ') || '无'}
- 最近行为模式：${summary.recentPatterns.join(', ') || '无'}

## 请推断以下维度（每个维度给出值和置信度 0-1）

1. **language** — 偏好编程语言
2. **framework** — 常用框架
3. **pattern** — 设计模式偏好
4. **naming** — 命名风格（camelCase/snake_case/kebab-case/PascalCase）
5. **verbosity** — 注释风格（minimal/moderate/detailed）
6. **debugging** — 调试习惯（console/logger/debugger/profiler）
7. **skill_level** — 技能水平（beginner/intermediate/advanced/expert）
8. **testing** — 测试偏好（unit/integration/e2e/tdd）

以 JSON 数组格式返回：
[{ "key": "language", "value": "TypeScript", "confidence": 0.85, "reasoning": "..." }]`;
}

export function buildAiPeerPrompt(
  summary: BehaviorSummary,
  userPeerResult: InferredDimension[]
): string {
  return `你是一位严格的代码审查员。以下是对用户偏好的初步推断，请逐一质疑并给出你的反面观点。

## 行为数据
- 事件类型分布：${JSON.stringify(summary.byType)}
- 语言使用分布：${JSON.stringify(summary.languageDistribution)}
- 框架线索：${summary.frameworkHints.join(', ')}

## 初步推断（User Peer 结论）
${JSON.stringify(userPeerResult, null, 2)}

## 质疑要求
对每个维度：
1. 评估推断是否有足够数据支撑
2. 如果证据不足，降低置信度
3. 如果有反面证据，提出修正
4. 标记置信度低于 0.3 的维度为 "待观察"

以 JSON 数组格式返回：
[{ "key": "language", "value": "...", "confidence": 0.6, "reasoning": "质疑理由..." }]`;
}

// ── LLM 调用（降级：基于规则的推理）─────────────────────────

/**
 * 基于规则的推理降级方案
 *
 * 当 LLM 不可用时，从行为摘要直接推断偏好。
 */
function inferFromRules(summary: BehaviorSummary): InferredDimension[] {
  const dims: InferredDimension[] = [];

  // 语言：取使用最多的
  const topLang = Object.entries(summary.languageDistribution)
    .sort((a, b) => b[1] - a[1])[0];
  dims.push({
    key: 'language',
    value: topLang ? topLang[0] : 'Unknown',
    confidence: topLang ? Math.min(0.5 + (topLang[1] / Math.max(summary.totalEvents, 1)) * 0.5, 0.95) : 0.1,
    reasoning: topLang ? `语言分布中 ${topLang[0]} 占比最高 (${topLang[1]} 次)` : '数据不足',
    source: 'user_peer',
  });

  // 框架
  const fw = summary.frameworkHints[0] ?? 'Unknown';
  dims.push({
    key: 'framework',
    value: fw,
    confidence: summary.frameworkHints.length > 0 ? 0.6 : 0.1,
    reasoning: summary.frameworkHints.length > 0
      ? `检测到框架: ${summary.frameworkHints.join(', ')}`
      : '无框架线索',
    source: 'user_peer',
  });

  // 命名风格（基于默认假设）
  dims.push({
    key: 'naming',
    value: 'camelCase',
    confidence: 0.3,
    reasoning: '默认假设，需更多数据验证',
    source: 'user_peer',
  });

  // 注释风格
  dims.push({
    key: 'verbosity',
    value: 'moderate',
    confidence: 0.3,
    reasoning: '默认假设',
    source: 'user_peer',
  });

  // 设计模式
  dims.push({
    key: 'pattern',
    value: 'functional',
    confidence: 0.3,
    reasoning: '默认假设',
    source: 'user_peer',
  });

  // 调试习惯
  const debugCount = summary.byType['debug_action'] ?? 0;
  dims.push({
    key: 'debugging',
    value: debugCount > 5 ? 'debugger' : 'console',
    confidence: debugCount > 0 ? 0.5 : 0.2,
    reasoning: debugCount > 0 ? `调试事件 ${debugCount} 次` : '无调试数据',
    source: 'user_peer',
  });

  // 技能水平
  const total = summary.totalEvents;
  dims.push({
    key: 'skill_level',
    value: total > 100 ? 'advanced' : total > 30 ? 'intermediate' : 'beginner',
    confidence: 0.4,
    reasoning: `基于事件总量 ${total} 估算`,
    source: 'user_peer',
  });

  // 测试偏好
  const testCount = summary.byType['test_run'] ?? 0;
  dims.push({
    key: 'testing',
    value: testCount > 10 ? 'tdd' : testCount > 3 ? 'unit' : 'integration',
    confidence: testCount > 0 ? 0.5 : 0.2,
    reasoning: `测试事件 ${testCount} 次`,
    source: 'user_peer',
  });

  return dims;
}

/**
 * AI Peer 质疑：对 User Peer 推断进行交叉验证
 */
function aiPeerChallenge(
  userPeer: InferredDimension[],
  summary: BehaviorSummary
): InferredDimension[] {
  return userPeer.map((dim) => {
    let newConfidence = dim.confidence;
    let reasoning = '';
    let value = dim.value;

    // 数据量不足时降低置信度
    if (summary.totalEvents < 10) {
      newConfidence *= 0.5;
      reasoning = `数据量不足（${summary.totalEvents} 事件），置信度降低`;
    }

    // 如果语言分布不明确
    if (dim.key === 'language') {
      const entries = Object.entries(summary.languageDistribution);
      if (entries.length > 1) {
        const [top, second] = entries.sort((a, b) => b[1] - a[1]);
        if (top && second && top[1] - second[1] < 3) {
          newConfidence *= 0.7;
          reasoning = `${top[0]} 和 ${second[0]} 使用频率接近，偏好不明确`;
        }
      }
    }

    // 置信度低于 0.3 标记为待观察
    if (newConfidence < 0.3) {
      reasoning = reasoning || '证据不足，标记为待观察';
      value = `${value}（待观察）`;
    }

    return {
      ...dim,
      value,
      confidence: Math.round(Math.max(0, Math.min(1, newConfidence)) * 100) / 100,
      reasoning: reasoning || dim.reasoning,
      source: 'ai_peer' as const,
    };
  });
}

/**
 * 合并双 Peer 结果
 *
 * 策略：取置信度较高的值，计算收敛度。
 */
function mergePeers(
  userPeer: InferredDimension[],
  aiPeer: InferredDimension[]
): {
  merged: InferredDimension[];
  convergenceScore: number;
} {
  const merged: InferredDimension[] = [];
  let matchCount = 0;

  for (const up of userPeer) {
    const ap = aiPeer.find((a) => a.key === up.key);
    if (!ap) {
      merged.push({ ...up, source: 'merged' });
      continue;
    }

    // 如果值相同，取较高置信度
    if (up.value === ap.value || ap.value.includes('（待观察）')) {
      merged.push({
        ...up,
        confidence: Math.max(up.confidence, ap.confidence),
        source: 'merged',
      });
      matchCount++;
    } else {
      // 值不同时，取置信度高的
      const winner = up.confidence >= ap.confidence ? up : ap;
      merged.push({ ...winner, source: 'merged' });
    }
  }

  return {
    merged,
    convergenceScore: userPeer.length > 0 ? matchCount / userPeer.length : 0,
  };
}

// ── 主推理接口 ──────────────────────────────────────────────

// 频率限制：每日最多 1 次
const _lastInference: Map<string, number> = new Map();
const INFERENCE_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24h

/**
 * 执行完整的 Honcho 推理
 *
 * 1. 收集行为摘要
 * 2. User Peer 推理（降级：规则推断）
 * 3. AI Peer 质疑
 * 4. 合并为最终画像
 */
export async function infer(
  workspaceId: string,
  forceRefresh = false
): Promise<ReasoningResult> {
  // 频率限制检查
  const lastTime = _lastInference.get(workspaceId) ?? 0;
  if (!forceRefresh && Date.now() - lastTime < INFERENCE_COOLDOWN_MS) {
    const hoursLeft = Math.ceil((INFERENCE_COOLDOWN_MS - (Date.now() - lastTime)) / 3600000);
    throw new Error(`推理冷却中，还需等待 ${hoursLeft} 小时`);
  }

  // Step 1: 收集行为数据
  const summary = summarize(workspaceId);

  if (summary.totalEvents === 0) {
    return {
      workspaceId,
      timestamp: Date.now(),
      dimensions: [],
      userPeerDimensions: [],
      aiPeerDimensions: [],
      convergenceScore: 0,
    };
  }

  // Step 2: User Peer 推理
  const userPeer = inferFromRules(summary);

  // Step 3: AI Peer 质疑
  const aiPeer = aiPeerChallenge(userPeer, summary);

  // Step 4: 合并
  const { merged, convergenceScore } = mergePeers(userPeer, aiPeer);

  _lastInference.set(workspaceId, Date.now());

  return {
    workspaceId,
    timestamp: Date.now(),
    dimensions: merged,
    userPeerDimensions: userPeer,
    aiPeerDimensions: aiPeer,
    convergenceScore: Math.round(convergenceScore * 100) / 100,
  };
}

/**
 * 获取推理冷却状态
 */
export function getInferenceCooldown(workspaceId: string): {
  isReady: boolean;
  nextAvailableAt: number | null;
} {
  const lastTime = _lastInference.get(workspaceId) ?? 0;
  const elapsed = Date.now() - lastTime;
  return {
    isReady: elapsed >= INFERENCE_COOLDOWN_MS,
    nextAvailableAt: elapsed < INFERENCE_COOLDOWN_MS ? lastTime + INFERENCE_COOLDOWN_MS : null,
  };
}

/**
 * 重置推理状态（测试用）
 */
export function resetReasoner(): void {
  _lastInference.clear();
}
