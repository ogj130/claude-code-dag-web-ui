/**
 * 执行统计工具
 * 提供工具调用分布、平均响应时间、错误率趋势等统计功能
 */

import { db } from '@/stores/db';
import type { ToolCall } from '@/types/storage';

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

/** 工具调用分布数据 */
export interface ToolDistributionData {
  toolName: string;
  count: number;
  percentage: number;
}

/** 平均响应时间 */
export interface AverageResponseTime {
  toolName: string;
  avgTime: number; // 毫秒
  count: number;
}

/** 错误率趋势 */
export interface ErrorRateTrend {
  date: string;
  totalCalls: number;
  errorCalls: number;
  errorRate: number; // 百分比
}

/** 热点工具排行 */
export interface HotToolEntry {
  toolName: string;
  count: number;
  avgTime: number;
  errorRate: number;
  rank: number;
}

/** 时间范围类型 */
export type TimeRange = 7 | 30 | 'all';

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

/**
 * 计算时间范围的起始时间戳
 * @param days 天数或 'all'
 * @returns 起始时间戳（毫秒）
 */
function getStartTime(days?: TimeRange): number | undefined {
  if (!days || days === 'all') return undefined;
  const now = Date.now();
  return now - days * 24 * 60 * 60 * 1000;
}

/**
 * 获取日期字符串 YYYY-MM-DD
 */
function getDateString(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toISOString().split('T')[0];
}

/**
 * 获取指定时间范围内和工作路径的工具调用记录
 * 直接从 db.queries 表读取，跳过 sessions 依赖
 */
async function getToolCallsInRange(days?: TimeRange, workspacePath?: string): Promise<ToolCall[]> {
  let allQueries = await db.queries.toArray();
  console.info('[executionStats] getToolCallsInRange: total queries in DB:', allQueries.length, 'workspacePath:', workspacePath);

  // 按工作路径过滤
  if (workspacePath) {
    allQueries = allQueries.filter(q => q.workspacePath === workspacePath);
    console.info('[executionStats] after workspacePath filter:', allQueries.length);
  }

  const allToolCalls: ToolCall[] = [];
  for (const q of allQueries) {
    allToolCalls.push(...(q.toolCalls || []));
  }

  // 按时间范围过滤
  const startTime = getStartTime(days);
  if (startTime !== undefined) {
    return allToolCalls.filter(tc => tc.startTime >= startTime);
  }

  return allToolCalls;
}

// ---------------------------------------------------------------------------
// 统计函数
// ---------------------------------------------------------------------------

/**
 * 获取工具调用分布数据
 * @param days 可选天数，默认全部
 * @param workspacePath 可选工作路径，默认全部
 * @returns 按调用次数降序排列的工具分布
 */
export async function getToolDistribution(days?: TimeRange, workspacePath?: string): Promise<ToolDistributionData[]> {
  const toolCalls = await getToolCallsInRange(days, workspacePath);
  const total = toolCalls.length;

  if (total === 0) return [];

  // 按工具名称分组统计
  const distribution = new Map<string, number>();

  for (const tc of toolCalls) {
    const name = tc.name || 'unknown';
    distribution.set(name, (distribution.get(name) || 0) + 1);
  }

  // 转换为数组并计算百分比
  const result: ToolDistributionData[] = Array.from(distribution.entries())
    .map(([toolName, count]) => ({
      toolName,
      count,
      percentage: Math.round((count / total) * 100 * 10) / 10,
    }))
    .sort((a, b) => b.count - a.count);

  return result;
}

/**
 * 获取各工具的平均响应时间
 * @param days 可选天数，默认全部
 * @param workspacePath 可选工作路径，默认全部
 * @returns 按平均响应时间降序排列的工具列表
 */
export async function getAverageResponseTime(days?: TimeRange, workspacePath?: string): Promise<AverageResponseTime[]> {
  const toolCalls = await getToolCallsInRange(days, workspacePath);

  if (toolCalls.length === 0) return [];

  // 按工具名称分组计算总时间和次数
  const timeStats = new Map<string, { totalTime: number; count: number }>();

  for (const tc of toolCalls) {
    const name = tc.name || 'unknown';
    const duration = tc.endTime - tc.startTime;

    if (duration < 0) continue; // 跳过异常数据

    const current = timeStats.get(name) || { totalTime: 0, count: 0 };
    timeStats.set(name, {
      totalTime: current.totalTime + duration,
      count: current.count + 1,
    });
  }

  // 转换为数组并计算平均值
  const result: AverageResponseTime[] = Array.from(timeStats.entries())
    .map(([toolName, { totalTime, count }]) => ({
      toolName,
      avgTime: Math.round(totalTime / count),
      count,
    }))
    .sort((a, b) => b.avgTime - a.avgTime);

  return result;
}

/**
 * 获取错误率趋势数据
 * @param days 时间范围：7天、30天或全部
 * @param workspacePath 可选工作路径，默认全部
 * @returns 按日期升序排列的错误率趋势
 */
export async function getErrorRateTrend(days: TimeRange = 7, workspacePath?: string): Promise<ErrorRateTrend[]> {
  const toolCalls = await getToolCallsInRange(days, workspacePath);

  if (toolCalls.length === 0) return [];

  // 按日期分组统计
  const dailyStats = new Map<string, { total: number; errors: number }>();

  for (const tc of toolCalls) {
    const date = getDateString(tc.startTime);
    const stats = dailyStats.get(date) || { total: 0, errors: 0 };

    stats.total += 1;
    if (!tc.success) {
      stats.errors += 1;
    }

    dailyStats.set(date, stats);
  }

  // 转换为数组并排序
  const result: ErrorRateTrend[] = Array.from(dailyStats.entries())
    .map(([date, { total, errors }]) => ({
      date,
      totalCalls: total,
      errorCalls: errors,
      errorRate: Math.round((errors / total) * 100 * 10) / 10,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return result;
}

/**
 * 获取热点工具排行榜（Top N）
 * @param limit 返回数量，默认10
 * @param days 可选天数，默认全部
 * @param workspacePath 可选工作路径，默认全部
 * @returns 按调用次数降序排列的工具列表
 */
export async function getHotToolRanking(
  limit: number = 10,
  days?: TimeRange,
  workspacePath?: string,
): Promise<HotToolEntry[]> {
  const toolCalls = await getToolCallsInRange(days, workspacePath);

  if (toolCalls.length === 0) return [];

  // 按工具名称分组统计
  const statsMap = new Map<string, {
    count: number;
    totalTime: number;
    errors: number;
  }>();

  for (const tc of toolCalls) {
    const name = tc.name || 'unknown';
    const duration = tc.endTime - tc.startTime;
    const current = statsMap.get(name) || { count: 0, totalTime: 0, errors: 0 };

    statsMap.set(name, {
      count: current.count + 1,
      totalTime: current.totalTime + (duration >= 0 ? duration : 0),
      errors: current.errors + (tc.success ? 0 : 1),
    });
  }

  // 转换为数组并排序
  const sorted = Array.from(statsMap.entries())
    .map(([toolName, { count, totalTime, errors }]) => ({
      toolName,
      count,
      avgTime: count > 0 ? Math.round(totalTime / count) : 0,
      errorRate: count > 0 ? Math.round((errors / count) * 100 * 10) / 10 : 0,
      rank: 0, // 后面设置
    }))
    .sort((a, b) => b.count - a.count);

  // 设置排名并截取前 N 个
  return sorted.slice(0, limit).map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));
}

/**
 * 获取总体执行统计摘要
 * @param days 可选天数，默认全部
 * @param workspacePath 可选工作路径，默认全部
 * @returns 统计摘要
 */
export async function getExecutionSummary(days?: TimeRange, workspacePath?: string): Promise<{
  totalCalls: number;
  successCalls: number;
  errorCalls: number;
  errorRate: number;
  avgDuration: number;
  uniqueTools: number;
}> {
  const toolCalls = await getToolCallsInRange(days, workspacePath);

  const totalCalls = toolCalls.length;

  if (totalCalls === 0) {
    return {
      totalCalls: 0,
      successCalls: 0,
      errorCalls: 0,
      errorRate: 0,
      avgDuration: 0,
      uniqueTools: 0,
    };
  }

  let successCalls = 0;
  let errorCalls = 0;
  let totalDuration = 0;
  const tools = new Set<string>();

  for (const tc of toolCalls) {
    if (tc.success) {
      successCalls += 1;
    } else {
      errorCalls += 1;
    }

    const duration = tc.endTime - tc.startTime;
    if (duration >= 0) {
      totalDuration += duration;
    }

    tools.add(tc.name || 'unknown');
  }

  return {
    totalCalls,
    successCalls,
    errorCalls,
    errorRate: Math.round((errorCalls / totalCalls) * 100 * 10) / 10,
    avgDuration: Math.round(totalDuration / totalCalls),
    uniqueTools: tools.size,
  };
}
