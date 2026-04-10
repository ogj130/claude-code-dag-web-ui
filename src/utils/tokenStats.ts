/**
 * Token 统计工具
 * 用于查询和分析 Token 使用情况
 */

import { db } from '@/stores/db';

/**
 * Token 趋势数据接口
 */
export interface TokenTrendData {
  /** 日期字符串 (YYYY-MM-DD) */
  date: string;
  /** 总 Token 数 */
  totalTokens: number;
  /** 查询次数 */
  queryCount: number;
}

/**
 * 模型定价信息
 */
export interface ModelPricing {
  /** 模型 ID */
  modelId: string;
  /** 模型显示名称 */
  displayName: string;
  /** 输入价格 (USD per 1M tokens) */
  inputPrice: number;
  /** 输出价格 (USD per 1M tokens) */
  outputPrice: number;
  /** 是否为默认模型 */
  isDefault?: boolean;
}

/**
 * 默认模型定价配置
 */
export const DEFAULT_MODEL_PRICING: ModelPricing[] = [
  {
    modelId: 'claude-sonnet-4-20250514',
    displayName: 'Claude Sonnet 4',
    inputPrice: 3.0,
    outputPrice: 15.0,
    isDefault: true,
  },
  {
    modelId: 'claude-opus-4-20250514',
    displayName: 'Claude Opus 4',
    inputPrice: 15.0,
    outputPrice: 75.0,
  },
  {
    modelId: 'claude-haiku-35-20241022',
    displayName: 'Claude 3.5 Haiku',
    inputPrice: 0.80,
    outputPrice: 4.0,
  },
];

/**
 * 获取指定日期范围的起始时间戳
 */
function getStartOfDay(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * 获取指定日期范围的结束时间戳
 */
function getEndOfDay(date: Date): number {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/**
 * 格式化日期为 YYYY-MM-DD
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 获取 Token 趋势数据
 * @param days 天数 (7 或 30)
 * @returns 趋势数据数组
 */
export async function getTokenTrend(days: 7 | 30): Promise<TokenTrendData[]> {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - days + 1);

  // 初始化每一天的数据
  const trendMap = new Map<string, TokenTrendData>();
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dateStr = formatDate(date);
    trendMap.set(dateStr, {
      date: dateStr,
      totalTokens: 0,
      queryCount: 0,
    });
  }

  // 查询指定时间范围内的所有 queries
  const startTimestamp = getStartOfDay(startDate);
  const endTimestamp = getEndOfDay(now);

  const queries = await db.queries
    .where('createdAt')
    .between(startTimestamp, endTimestamp, true, true)
    .toArray();

  // 按日期聚合数据
  for (const query of queries) {
    const queryDate = new Date(query.createdAt);
    const dateStr = formatDate(queryDate);
    const dayData = trendMap.get(dateStr);
    if (dayData) {
      dayData.totalTokens += query.tokenUsage;
      dayData.queryCount += 1;
    }
  }

  // 转换为数组并按日期排序
  return Array.from(trendMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * 获取会话总 Token 消耗
 * @param sessionId 会话 ID
 * @returns 总 Token 数
 */
export async function getSessionTotalTokens(sessionId: string): Promise<number> {
  const queries = await db.queries
    .where('sessionId')
    .equals(sessionId)
    .toArray();

  return queries.reduce((sum, q) => sum + q.tokenUsage, 0);
}

/**
 * 获取会话查询次数
 * @param sessionId 会话 ID
 * @returns 查询次数
 */
export async function getSessionQueryCount(sessionId: string): Promise<number> {
  return db.queries
    .where('sessionId')
    .equals(sessionId)
    .count();
}

/**
 * 格式化 Token 数量显示
 * @param tokens Token 数量
 * @returns 格式化后的字符串
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return tokens.toString();
}

/**
 * 获取所有会话的 Token 统计
 * @returns 总 Token 数、总查询数、平均 Token/查询
 */
export async function getOverallStats(): Promise<{
  totalTokens: number;
  totalQueries: number;
  avgTokensPerQuery: number;
}> {
  const queries = await db.queries.toArray();
  const totalTokens = queries.reduce((sum, q) => sum + q.tokenUsage, 0);
  const totalQueries = queries.length;
  const avgTokensPerQuery = totalQueries > 0 ? Math.round(totalTokens / totalQueries) : 0;

  return {
    totalTokens,
    totalQueries,
    avgTokensPerQuery,
  };
}

/**
 * 获取最近 N 天的 Token 使用统计
 * @param days 天数
 * @returns 统计数据
 */
export async function getRecentStats(days: 7 | 30): Promise<{
  totalTokens: number;
  totalQueries: number;
  avgTokensPerQuery: number;
  dailyAvg: number;
}> {
  const trend = await getTokenTrend(days);
  const totalTokens = trend.reduce((sum, d) => sum + d.totalTokens, 0);
  const totalQueries = trend.reduce((sum, d) => sum + d.queryCount, 0);
  const avgTokensPerQuery = totalQueries > 0 ? Math.round(totalTokens / totalQueries) : 0;
  const dailyAvg = Math.round(totalTokens / days);

  return {
    totalTokens,
    totalQueries,
    avgTokensPerQuery,
    dailyAvg,
  };
}

/**
 * 从本地存储获取模型定价配置
 * @returns 模型定价数组
 */
export function getModelPricing(): ModelPricing[] {
  try {
    const stored = localStorage.getItem('cc-model-pricing');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.warn('[TokenStats] Failed to load model pricing from localStorage:', error);
  }
  return DEFAULT_MODEL_PRICING;
}

/**
 * 保存模型定价配置到本地存储
 * @param pricing 模型定价数组
 */
export function saveModelPricing(pricing: ModelPricing[]): void {
  try {
    localStorage.setItem('cc-model-pricing', JSON.stringify(pricing));
  } catch (error) {
    console.warn('[TokenStats] Failed to save model pricing to localStorage:', error);
  }
}

/**
 * 重置模型定价为默认值
 */
export function resetModelPricing(): void {
  localStorage.removeItem('cc-model-pricing');
}
