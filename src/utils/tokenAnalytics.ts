/**
 * Token 统计分析模块
 *
 * 功能：
 * - 单次查询 Token 消耗显示
 * - 会话总 Token 消耗统计
 * - 7 天/30 天 Token 趋势图
 * - 模型定价配置（仅展示，不做 USD 换算）
 */

import { db } from '@/stores/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TokenUsageStats {
  /** 总 Token 数 */
  total: number;
  /** 输入 Token 数 */
  input: number;
  /** 输出 Token 数 */
  output: number;
}

export interface DailyTokenUsage {
  /** 日期（YYYY-MM-DD） */
  date: string;
  /** 该日 Token 总数 */
  tokens: number;
  /** 查询次数 */
  queryCount: number;
}

export interface TokenTrendData {
  /** 日期范围 */
  dateRange: { from: number; to: number };
  /** 每日数据 */
  daily: DailyTokenUsage[];
  /** 总计 */
  total: number;
  /** 平均每日 */
  avgPerDay: number;
}

// ---------------------------------------------------------------------------
// Query Token Stats
// ---------------------------------------------------------------------------

/**
 * 获取单个查询的 Token 使用情况
 */
export async function getQueryTokenUsage(queryId: string): Promise<TokenUsageStats | null> {
  try {
    const query = await db.queries.get(queryId);
    if (!query) return null;

    return {
      total: query.tokenUsage,
      input: 0, // 暂时不区分输入输出
      output: query.tokenUsage,
    };
  } catch (error) {
    console.error('[TokenAnalytics] Failed to get query token usage:', error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Session Token Stats
// ---------------------------------------------------------------------------

/**
 * 获取会话的总 Token 使用情况
 */
export async function getSessionTokenUsage(sessionId: string): Promise<TokenUsageStats> {
  try {
    const session = await db.sessions.get(sessionId);
    if (!session) {
      return { total: 0, input: 0, output: 0 };
    }

    return {
      total: session.tokenUsage,
      input: 0,
      output: session.tokenUsage,
    };
  } catch (error) {
    console.error('[TokenAnalytics] Failed to get session token usage:', error);
    return { total: 0, input: 0, output: 0 };
  }
}

/**
 * 获取所有会话的 Token 统计
 */
export async function getAllSessionsTokenUsage(): Promise<TokenUsageStats> {
  try {
    const sessions = await db.sessions.toArray();
    const total = sessions.reduce((sum, s) => sum + s.tokenUsage, 0);

    return {
      total,
      input: 0,
      output: total,
    };
  } catch (error) {
    console.error('[TokenAnalytics] Failed to get all sessions token usage:', error);
    return { total: 0, input: 0, output: 0 };
  }
}

// ---------------------------------------------------------------------------
// Token Trend Analysis
// ---------------------------------------------------------------------------

/**
 * 获取指定天数的 Token 趋势数据
 */
export async function getTokenTrend(days: 7 | 30 | 'all'): Promise<TokenTrendData> {
  try {
    const now = Date.now();
    const msPerDay = 24 * 60 * 60 * 1000;

    let fromTimestamp: number;
    if (days === 'all') {
      fromTimestamp = 0;
    } else {
      fromTimestamp = now - days * msPerDay;
    }

    // 获取时间范围内的所有查询
    const queries = await db.queries
      .where('createdAt')
      .above(fromTimestamp)
      .toArray();

    // 按日期分组统计
    const dailyMap = new Map<string, { tokens: number; count: number }>();

    for (const query of queries) {
      const date = new Date(query.createdAt).toISOString().slice(0, 10);
      const existing = dailyMap.get(date) ?? { tokens: 0, count: 0 };
      existing.tokens += query.tokenUsage;
      existing.count += 1;
      dailyMap.set(date, existing);
    }

    // 转换为数组并排序
    const daily: DailyTokenUsage[] = Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date,
        tokens: data.tokens,
        queryCount: data.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // 计算总计和平均
    const total = daily.reduce((sum, d) => sum + d.tokens, 0);
    const avgPerDay = daily.length > 0 ? total / daily.length : 0;

    return {
      dateRange: { from: fromTimestamp, to: now },
      daily,
      total,
      avgPerDay,
    };
  } catch (error) {
    console.error('[TokenAnalytics] Failed to get token trend:', error);
    return {
      dateRange: { from: 0, to: Date.now() },
      daily: [],
      total: 0,
      avgPerDay: 0,
    };
  }
}

// ---------------------------------------------------------------------------
// Model Pricing Configuration
// ---------------------------------------------------------------------------

const PRICING_STORAGE_KEY = 'cc-web-ui-model-pricing';

export interface ModelPricing {
  /** 模型名称 */
  modelName: string;
  /** 每百万输入 Token 价格（USD） */
  inputPricePerMillion: number;
  /** 每百万输出 Token 价格（USD） */
  outputPricePerMillion: number;
}

/**
 * 获取模型定价配置
 */
export function getModelPricing(): ModelPricing | null {
  try {
    const stored = localStorage.getItem(PRICING_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as ModelPricing;
    }
  } catch (error) {
    console.error('[TokenAnalytics] Failed to get model pricing:', error);
  }
  return null;
}

/**
 * 保存模型定价配置
 */
export function saveModelPricing(pricing: ModelPricing): void {
  try {
    localStorage.setItem(PRICING_STORAGE_KEY, JSON.stringify(pricing));
  } catch (error) {
    console.error('[TokenAnalytics] Failed to save model pricing:', error);
  }
}

/**
 * 清除模型定价配置
 */
export function clearModelPricing(): void {
  try {
    localStorage.removeItem(PRICING_STORAGE_KEY);
  } catch (error) {
    console.error('[TokenAnalytics] Failed to clear model pricing:', error);
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * 格式化 Token 数量为可读字符串
 */
export function formatTokenCount(tokens: number): string {
  if (tokens < 1000) {
    return `${tokens}`;
  } else if (tokens < 1000000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  } else {
    return `${(tokens / 1000000).toFixed(2)}M`;
  }
}

/**
 * 计算 Token 成本（仅在配置了定价时使用）
 */
export function calculateTokenCost(
  tokens: TokenUsageStats,
  pricing: ModelPricing
): number {
  const inputCost = (tokens.input / 1000000) * pricing.inputPricePerMillion;
  const outputCost = (tokens.output / 1000000) * pricing.outputPricePerMillion;
  return inputCost + outputCost;
}
