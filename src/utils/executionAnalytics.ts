/**
 * 执行分析模块
 *
 * 功能：
 * - 工具调用次数分布（饼图）
 * - 平均响应时间统计
 * - 错误率趋势（折线图）
 * - 热点工具排行榜（Top 10）
 * - 时间范围选择器（7 天/30 天/全部）
 */

import { db } from '@/stores/db';
import type { DBQuery } from '@/types/storage';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ToolCallStats {
  /** 工具名称 */
  toolName: string;
  /** 调用次数 */
  count: number;
  /** 成功次数 */
  successCount: number;
  /** 失败次数 */
  errorCount: number;
  /** 平均执行时长（毫秒） */
  avgDuration: number;
}

export interface ErrorRateData {
  /** 日期（YYYY-MM-DD） */
  date: string;
  /** 错误率（0-100） */
  errorRate: number;
  /** 总查询数 */
  totalQueries: number;
  /** 错误查询数 */
  errorQueries: number;
}

export interface ResponseTimeStats {
  /** 平均响应时间（毫秒） */
  average: number;
  /** 最小响应时间 */
  min: number;
  /** 最大响应时间 */
  max: number;
  /** 中位数 */
  median: number;
}

export type TimeRange = '7d' | '30d' | 'all';

// ---------------------------------------------------------------------------
// Tool Call Distribution
// ---------------------------------------------------------------------------

/**
 * 获取工具调用分布统计
 */
export async function getToolCallDistribution(
  timeRange: TimeRange = 'all'
): Promise<ToolCallStats[]> {
  try {
    const queries = await getQueriesInRange(timeRange);

    // 统计每个工具的调用情况
    const toolMap = new Map<string, {
      count: number;
      successCount: number;
      errorCount: number;
      totalDuration: number;
    }>();

    for (const query of queries) {
      for (const toolCall of query.toolCalls) {
        const existing = toolMap.get(toolCall.name) ?? {
          count: 0,
          successCount: 0,
          errorCount: 0,
          totalDuration: 0,
        };

        existing.count += 1;
        if (toolCall.success) {
          existing.successCount += 1;
        } else {
          existing.errorCount += 1;
        }
        existing.totalDuration += toolCall.endTime - toolCall.startTime;

        toolMap.set(toolCall.name, existing);
      }
    }

    // 转换为数组并计算平均时长
    const stats: ToolCallStats[] = Array.from(toolMap.entries()).map(([toolName, data]) => ({
      toolName,
      count: data.count,
      successCount: data.successCount,
      errorCount: data.errorCount,
      avgDuration: data.count > 0 ? data.totalDuration / data.count : 0,
    }));

    // 按调用次数降序排序
    stats.sort((a, b) => b.count - a.count);

    return stats;
  } catch (error) {
    console.error('[ExecutionAnalytics] Failed to get tool call distribution:', error);
    return [];
  }
}

/**
 * 获取热点工具排行榜（Top 10）
 */
export async function getHotTools(timeRange: TimeRange = 'all'): Promise<ToolCallStats[]> {
  const distribution = await getToolCallDistribution(timeRange);
  return distribution.slice(0, 10);
}

// ---------------------------------------------------------------------------
// Response Time Statistics
// ---------------------------------------------------------------------------

/**
 * 获取平均响应时间统计
 */
export async function getResponseTimeStats(
  timeRange: TimeRange = 'all'
): Promise<ResponseTimeStats> {
  try {
    const queries = await getQueriesInRange(timeRange);

    if (queries.length === 0) {
      return { average: 0, min: 0, max: 0, median: 0 };
    }

    const durations = queries.map(q => q.duration).sort((a, b) => a - b);

    const average = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const min = durations[0];
    const max = durations[durations.length - 1];
    const median = durations[Math.floor(durations.length / 2)];

    return { average, min, max, median };
  } catch (error) {
    console.error('[ExecutionAnalytics] Failed to get response time stats:', error);
    return { average: 0, min: 0, max: 0, median: 0 };
  }
}

// ---------------------------------------------------------------------------
// Error Rate Trend
// ---------------------------------------------------------------------------

/**
 * 获取错误率趋势数据
 */
export async function getErrorRateTrend(timeRange: TimeRange = 'all'): Promise<ErrorRateData[]> {
  try {
    const queries = await getQueriesInRange(timeRange);

    // 按日期分组统计
    const dailyMap = new Map<string, { total: number; errors: number }>();

    for (const query of queries) {
      const date = new Date(query.createdAt).toISOString().slice(0, 10);
      const existing = dailyMap.get(date) ?? { total: 0, errors: 0 };

      existing.total += 1;
      if (query.status === 'error' || query.status === 'partial') {
        existing.errors += 1;
      }

      dailyMap.set(date, existing);
    }

    // 转换为数组并计算错误率
    const trend: ErrorRateData[] = Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date,
        errorRate: data.total > 0 ? (data.errors / data.total) * 100 : 0,
        totalQueries: data.total,
        errorQueries: data.errors,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return trend;
  } catch (error) {
    console.error('[ExecutionAnalytics] Failed to get error rate trend:', error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/**
 * 根据时间范围获取查询列表
 */
async function getQueriesInRange(timeRange: TimeRange): Promise<DBQuery[]> {
  const now = Date.now();
  const msPerDay = 24 * 60 * 60 * 1000;

  let fromTimestamp: number;
  if (timeRange === '7d') {
    fromTimestamp = now - 7 * msPerDay;
  } else if (timeRange === '30d') {
    fromTimestamp = now - 30 * msPerDay;
  } else {
    fromTimestamp = 0;
  }

  return await db.queries
    .where('createdAt')
    .above(fromTimestamp)
    .toArray();
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * 格式化时长为可读字符串
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.round((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}

/**
 * 格式化错误率为可读字符串
 */
export function formatErrorRate(rate: number): string {
  return `${rate.toFixed(1)}%`;
}

/**
 * 获取时间范围的描述文本
 */
export function getTimeRangeLabel(timeRange: TimeRange): string {
  switch (timeRange) {
    case '7d':
      return '最近 7 天';
    case '30d':
      return '最近 30 天';
    case 'all':
      return '全部时间';
  }
}
