/**
 * episodeRecorder — 情景记忆自动记录器
 *
 * 在任务完成（PostTaskComplete）时自动创建情景记忆条目。
 * 记录内容包括：任务描述、执行结果、使用工具、情绪标签。
 *
 * 调用方式：
 *   import { recordEpisode } from '@/services/episodeRecorder';
 *   recordEpisode({ workspaceId, taskDescription, ... });
 */

import { episodeStore } from '../stores/memoryStore';
import { inferEmotionTag, type EmotionContext, type EmotionTag } from './emotionTagger';

// ── 类型定义 ──────────────────────────────────────────────

export interface RecordEpisodeParams {
  /** 工作区 ID */
  workspaceId: string;
  /** 任务描述（用户输入或 Agent 任务标题） */
  taskDescription: string;
  /** 执行结果摘要 */
  resultSummary?: string;
  /** 使用的工具列表 */
  toolNames?: string[];
  /** 是否成功 */
  isSuccess?: boolean;
  /** 错误信息 */
  errorMessage?: string;
  /** 用户反馈文本 */
  userFeedback?: string;
  /** 重试次数 */
  retryCount?: number;
  /** 执行时长（ms） */
  durationMs?: number;
  /** 自定义情绪标签（覆盖自动推断） */
  emotionTag?: EmotionTag;
  /** 额外标签 */
  tags?: string[];
}

// ── Episode 类型映射 ──────────────────────────────────────

function inferEpisodeType(params: RecordEpisodeParams): string {
  const desc = params.taskDescription.toLowerCase();

  if (params.errorMessage || params.isSuccess === false) return 'bug_fix';
  if (desc.includes('重构') || desc.includes('refactor') || desc.includes('优化')) return 'config_change';
  if (desc.includes('review') || desc.includes('审查') || desc.includes('代码评审')) return 'code_review';
  if (desc.includes('架构') || desc.includes('设计') || desc.includes('architecture')) return 'architecture_decision';
  if (desc.includes('debug') || desc.includes('调试') || desc.includes('排查')) return 'debug_session';

  return 'feature_impl';
}

// ── 标签自动生成 ──────────────────────────────────────────

function generateTags(params: RecordEpisodeParams): string[] {
  const tags: string[] = [];

  // 从工具名生成标签
  if (params.toolNames) {
    for (const tool of params.toolNames.slice(0, 5)) {
      tags.push(`tool:${tool.toLowerCase()}`);
    }
  }

  // 从结果生成标签
  if (params.isSuccess === false || params.errorMessage) {
    tags.push('error');
  }

  // 合并用户自定义标签
  if (params.tags) {
    tags.push(...params.tags);
  }

  return [...new Set(tags)]; // 去重
}

// ── 主记录函数 ────────────────────────────────────────────

/**
 * 记录一条情景记忆
 *
 * 在 PostTaskComplete Hook 中调用，自动推断情绪标签和 episode 类型。
 */
export async function recordEpisode(params: RecordEpisodeParams): Promise<string | null> {
  try {
    // 1. 推断情绪标签
    const emotionContext: EmotionContext = {
      isSuccess: params.isSuccess,
      hasError: !!params.errorMessage,
      errorMessage: params.errorMessage,
      userFeedback: params.userFeedback,
      retryCount: params.retryCount,
      durationMs: params.durationMs,
    };
    const emotionTag = params.emotionTag ?? inferEmotionTag(emotionContext);

    // 2. 构建内容描述
    const contentParts = [
      `任务: ${params.taskDescription}`,
      params.resultSummary ? `结果: ${params.resultSummary}` : null,
      params.toolNames?.length ? `工具: ${params.toolNames.join(', ')}` : null,
      params.errorMessage ? `错误: ${params.errorMessage}` : null,
      params.durationMs ? `耗时: ${(params.durationMs / 1000).toFixed(1)}s` : null,
    ].filter(Boolean);

    // 3. 推断类型和标签
    const type = inferEpisodeType(params);
    const tags = generateTags(params);

    // 4. 写入存储
    const id = await episodeStore.create({
      workspaceId: params.workspaceId,
      type,
      content: contentParts.join('\n'),
      tags,
      emotionTag,
    });

    console.info(`[EpisodeRecorder] Recorded episode ${id} (type=${type}, emotion=${emotionTag})`);
    return id;
  } catch (err) {
    console.error('[EpisodeRecorder] Failed to record episode:', err);
    return null;
  }
}

/**
 * 便捷方法：记录成功任务
 */
export async function recordSuccess(
  workspaceId: string,
  taskDescription: string,
  resultSummary?: string,
  toolNames?: string[]
): Promise<string | null> {
  return recordEpisode({
    workspaceId,
    taskDescription,
    resultSummary,
    toolNames,
    isSuccess: true,
  });
}

/**
 * 便捷方法：记录失败任务
 */
export async function recordFailure(
  workspaceId: string,
  taskDescription: string,
  errorMessage: string,
  toolNames?: string[]
): Promise<string | null> {
  return recordEpisode({
    workspaceId,
    taskDescription,
    errorMessage,
    toolNames,
    isSuccess: false,
  });
}
