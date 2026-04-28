/**
 * compressionScheduler — 情景记忆→语义记忆压缩调度器
 *
 * 定时（6 小时周期）扫描最近的情景记忆，
 * 使用 LLM 辅助提取模式（pattern），生成结构化语义记忆。
 *
 * 调度策略：
 * - 首次启动延迟 10 分钟执行（避免影响启动性能）
 * - 每 6 小时执行一次
 * - 仅在有 ≥ 5 条未压缩的 episode 时触发
 * - LLM 不可用时跳过本次调度
 */

import { episodeStore, patternStore, type Episode } from '../stores/memoryStore';

// ── 配置 ──────────────────────────────────────────────────

const SCHEDULER_CONFIG = {
  /** 调度间隔（ms）：6 小时 */
  intervalMs: 6 * 60 * 60 * 1000,
  /** 首次延迟（ms）：10 分钟 */
  initialDelayMs: 10 * 60 * 1000,
  /** 最少 episode 数量才触发压缩 */
  minEpisodesToCompress: 5,
  /** 每次最多处理的 episode 数量 */
  maxEpisodesPerBatch: 50,
} as const;

// ── 状态 ──────────────────────────────────────────────────

let _timer: ReturnType<typeof setInterval> | null = null;
let _isRunning = false;
let _lastRunAt: number | null = null;
let _totalRuns = 0;

// ── LLM 调用（占位，实际走 /api/intent 或专用端点）────────

interface ExtractedPattern {
  domain: string;
  pattern: string;
  description: string;
  confidence: number;
}

/**
 * 调用 LLM 从 episode 批次中提取模式
 *
 * TODO: 接入实际 LLM API（OpenAI/Anthropic）
 * 当前返回空数组（LLM 不可用时的降级行为）
 */
async function extractPatternsFromEpisodes(
  _episodes: Episode[]
): Promise<ExtractedPattern[]> {
  // 降级方案：基于频率统计的简单模式提取
  const typeCounts = new Map<string, number>();
  const tagCounts = new Map<string, number>();

  for (const ep of _episodes) {
    typeCounts.set(ep.type, (typeCounts.get(ep.type) ?? 0) + 1);
    for (const tag of ep.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  const patterns: ExtractedPattern[] = [];

  // 从高频类型提取模式
  for (const [type, count] of typeCounts) {
    if (count >= 3) {
      patterns.push({
        domain: 'workflow',
        pattern: `frequent_${type}`,
        description: `用户频繁执行 ${type} 类型任务（${count} 次）`,
        confidence: Math.min(0.5 + count * 0.1, 0.95),
      });
    }
  }

  return patterns;
}

// ── 压缩执行 ──────────────────────────────────────────────

/**
 * 执行一次压缩调度
 */
export async function runCompression(workspaceId: string): Promise<{
  processed: number;
  patternsCreated: number;
  skipped: boolean;
  reason?: string;
}> {
  if (_isRunning) {
    return { processed: 0, patternsCreated: 0, skipped: true, reason: 'Already running' };
  }

  _isRunning = true;

  try {
    // 1. 获取最近的 episodes
    const episodes = await episodeStore.list(workspaceId, SCHEDULER_CONFIG.maxEpisodesPerBatch);

    if (episodes.length < SCHEDULER_CONFIG.minEpisodesToCompress) {
      return {
        processed: 0,
        patternsCreated: 0,
        skipped: true,
        reason: `Only ${episodes.length} episodes (min: ${SCHEDULER_CONFIG.minEpisodesToCompress})`,
      };
    }

    // 2. 提取模式
    const extracted = await extractPatternsFromEpisodes(episodes);

    if (extracted.length === 0) {
      return { processed: episodes.length, patternsCreated: 0, skipped: false };
    }

    // 3. 写入语义记忆
    let created = 0;
    for (const p of extracted) {
      // 检查是否已有相同 pattern（避免重复）
      const existing = await patternStore.list(p.domain, 100);
      const isDuplicate = existing.some(
        (e) => e.pattern === p.pattern && e.domain === p.domain
      );

      if (!isDuplicate) {
        await patternStore.create(p);
        created++;
      }
    }

    _lastRunAt = Date.now();
    _totalRuns++;

    console.info(
      `[CompressionScheduler] Processed ${episodes.length} episodes → ${created} new patterns`
    );

    return {
      processed: episodes.length,
      patternsCreated: created,
      skipped: false,
    };
  } catch (err) {
    console.error('[CompressionScheduler] Error during compression:', err);
    return { processed: 0, patternsCreated: 0, skipped: true, reason: String(err) };
  } finally {
    _isRunning = false;
  }
}

// ── 调度器控制 ────────────────────────────────────────────

/**
 * 启动定时压缩调度器
 */
export function startScheduler(workspaceId: string): void {
  if (_timer) {
    console.warn('[CompressionScheduler] Already started');
    return;
  }

  console.info(
    `[CompressionScheduler] Starting (interval=${SCHEDULER_CONFIG.intervalMs / 3600000}h, initial delay=${SCHEDULER_CONFIG.initialDelayMs / 60000}min)`
  );

  // 首次延迟执行
  setTimeout(() => {
    runCompression(workspaceId);

    // 之后定时执行
    _timer = setInterval(() => {
      runCompression(workspaceId);
    }, SCHEDULER_CONFIG.intervalMs);
  }, SCHEDULER_CONFIG.initialDelayMs);
}

/**
 * 停止调度器
 */
export function stopScheduler(): void {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
    console.info('[CompressionScheduler] Stopped');
  }
}

/**
 * 手动触发一次压缩
 */
export async function triggerManualCompression(workspaceId: string) {
  console.info('[CompressionScheduler] Manual trigger');
  return runCompression(workspaceId);
}

/**
 * 获取调度器状态
 */
export function getSchedulerStatus() {
  return {
    isRunning: _isRunning,
    isScheduled: _timer !== null,
    lastRunAt: _lastRunAt,
    totalRuns: _totalRuns,
    config: SCHEDULER_CONFIG,
  };
}
