/**
 * 历史召回算法模块
 *
 * 实现加权排序算法：
 * - 关键词匹配分数（权重 0.4）
 * - 时间衰减分数（权重 0.3）
 * - 使用频率分数（权重 0.3）
 */

import { search, type SearchDocument, type SearchOptions as FlexSearchOptions } from '@/stores/searchIndex';
import { db } from '@/stores/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RecallResult {
  doc: SearchDocument;
  /** 综合评分（0-1） */
  finalScore: number;
  /** 关键词匹配分数（0-1） */
  keywordScore: number;
  /** 时间衰减分数（0-1） */
  timeScore: number;
  /** 使用频率分数（0-1） */
  frequencyScore: number;
}

export interface SimilarQuestion {
  queryId: string;
  question: string;
  answer: string;
  similarity: number;
  sessionId: string;
  createdAt: number;
}

export interface ErrorSolution {
  queryId: string;
  errorMessage: string;
  solution: string;
  toolName: string;
  sessionId: string;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 权重配置 */
const WEIGHTS = {
  keyword: 0.4,
  time: 0.3,
  frequency: 0.3,
} as const;

/** 时间衰减参数（30 天半衰期） */
const TIME_DECAY_HALF_LIFE = 30 * 24 * 60 * 60 * 1000; // 30 天

/** 相似度阈值 */
const SIMILARITY_THRESHOLD = 0.8;

// ---------------------------------------------------------------------------
// Scoring Functions
// ---------------------------------------------------------------------------

/**
 * 计算时间衰减分数
 * 使用指数衰减：score = exp(-λt)，其中 λ = ln(2) / half_life
 */
function calculateTimeScore(timestamp: number): number {
  const now = Date.now();
  const age = now - timestamp;
  const lambda = Math.log(2) / TIME_DECAY_HALF_LIFE;
  return Math.exp(-lambda * age);
}

/**
 * 计算使用频率分数
 * 基于访问次数的对数归一化
 */
function calculateFrequencyScore(accessCount: number): number {
  if (accessCount <= 0) return 0;
  // 使用对数归一化，避免高频项过度占优
  // log10(1) = 0, log10(10) ≈ 1, log10(100) = 2
  const normalized = Math.log10(accessCount + 1) / 2; // 除以 2 使得 100 次访问约为 1.0
  return Math.min(normalized, 1.0);
}

/**
 * 计算关键词匹配分数
 * 基于 FlexSearch 返回的原始分数归一化
 */
function calculateKeywordScore(rawScore: number, maxScore: number): number {
  if (maxScore === 0) return 0;
  return rawScore / maxScore;
}

// ---------------------------------------------------------------------------
// Main Recall Algorithm
// ---------------------------------------------------------------------------

export interface RecallOptions {
  /** 搜索关键词 */
  query: string;
  /** 时间范围起点 */
  dateFrom?: number;
  /** 时间范围终点 */
  dateTo?: number;
  /** 标签过滤 */
  tags?: string[];
  /** 工具类型过滤 */
  toolTypes?: string[];
  /** 最大结果数 */
  limit?: number;
}

/**
 * 历史召回排序算法
 *
 * 综合评分 = 关键词分数 × 0.4 + 时间分数 × 0.3 + 频率分数 × 0.3
 */
export async function recallHistory(options: RecallOptions): Promise<RecallResult[]> {
  const { query, dateFrom, dateTo, tags, toolTypes, limit = 20 } = options;

  // 1. 使用 FlexSearch 进行关键词搜索
  const searchResults = search({
    query,
    dateFrom,
    dateTo,
    tags,
    toolTypes,
    limit: limit * 2, // 多取一些，后面重新排序
  } as FlexSearchOptions);

  if (searchResults.length === 0) {
    return [];
  }

  // 2. 获取最大关键词分数（用于归一化）
  const maxRawScore = Math.max(...searchResults.map(r => r.score));

  // 3. 计算综合评分
  const results: RecallResult[] = [];

  for (const result of searchResults) {
    const doc = result.doc;

    // 关键词分数
    const keywordScore = calculateKeywordScore(result.score, maxRawScore);

    // 时间分数
    const timeScore = calculateTimeScore(doc.createdAt);

    // 频率分数（从数据库获取访问次数）
    let accessCount = 0;
    if (doc.type === 'query') {
      const queryRecord = await db.queries.get(doc.id);
      accessCount = queryRecord?.accessCount ?? 0;
    } else if (doc.type === 'session') {
      const sessionRecord = await db.sessions.get(doc.id);
      accessCount = sessionRecord?.accessCount ?? 0;
    }
    const frequencyScore = calculateFrequencyScore(accessCount);

    // 综合评分
    const finalScore =
      keywordScore * WEIGHTS.keyword +
      timeScore * WEIGHTS.time +
      frequencyScore * WEIGHTS.frequency;

    results.push({
      doc,
      finalScore,
      keywordScore,
      timeScore,
      frequencyScore,
    });
  }

  // 4. 按综合评分降序排序
  results.sort((a, b) => b.finalScore - a.finalScore);

  return results.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Similar Question Detection
// ---------------------------------------------------------------------------

/**
 * 计算两个文本的相似度（简单的 Jaccard 相似度）
 */
function calculateSimilarity(text1: string, text2: string): number {
  const tokens1 = new Set(tokenize(text1));
  const tokens2 = new Set(tokenize(text2));

  if (tokens1.size === 0 && tokens2.size === 0) return 1.0;
  if (tokens1.size === 0 || tokens2.size === 0) return 0.0;

  // Jaccard 相似度：交集 / 并集
  const intersection = new Set([...tokens1].filter(t => tokens2.has(t)));
  const union = new Set([...tokens1, ...tokens2]);

  return intersection.size / union.size;
}

/**
 * 简单分词（复用搜索索引的分词逻辑）
 */
function tokenize(text: string): string[] {
  if (!text) return [];

  const cleaned = text
    .replace(/<[^>]+>/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .toLowerCase()
    .trim();

  if (!cleaned) return [];

  // 英文/数字词项
  const englishWords = cleaned.match(/[a-z0-9]{2,}/g) ?? [];

  // 中文词项（bigram）
  const chineseChars = cleaned.match(/[\u4e00-\u9fff]/g) ?? [];
  const chineseTerms: string[] = [];
  for (let i = 0; i < chineseChars.length - 1; i++) {
    chineseTerms.push(chineseChars[i] + chineseChars[i + 1]);
  }

  return [...englishWords, ...chineseTerms];
}

/**
 * 检测相似问题
 *
 * 当用户输入新问题时，检查历史中是否有相似度 > 0.8 的问题
 */
export async function detectSimilarQuestions(
  newQuestion: string,
  limit: number = 5
): Promise<SimilarQuestion[]> {
  // 1. 从数据库获取最近的问题（最近 100 条）
  const recentQueries = await db.queries
    .orderBy('createdAt')
    .reverse()
    .limit(100)
    .toArray();

  // 2. 计算相似度
  const similarities: SimilarQuestion[] = [];

  for (const query of recentQueries) {
    const similarity = calculateSimilarity(newQuestion, query.question);

    if (similarity >= SIMILARITY_THRESHOLD) {
      similarities.push({
        queryId: query.id,
        question: query.question,
        answer: query.answer,
        similarity,
        sessionId: query.sessionId,
        createdAt: query.createdAt,
      });
    }
  }

  // 3. 按相似度降序排序
  similarities.sort((a, b) => b.similarity - a.similarity);

  return similarities.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Error Solution Recommendation
// ---------------------------------------------------------------------------

/**
 * 推荐错误解决方案
 *
 * 当工具调用失败时，搜索历史中相似的错误及其解决方案
 */
export async function recommendErrorSolutions(
  errorMessage: string,
  toolName: string,
  limit: number = 3
): Promise<ErrorSolution[]> {
  // 1. 从数据库获取所有包含该工具的查询
  const allQueries = await db.queries.toArray();

  const errorSolutions: ErrorSolution[] = [];

  for (const query of allQueries) {
    // 查找包含该工具且有错误的 toolCall
    const failedCalls = query.toolCalls.filter(
      tc => tc.name === toolName && tc.status === 'error' && tc.error
    );

    if (failedCalls.length === 0) continue;

    // 计算错误消息的相似度
    for (const call of failedCalls) {
      const similarity = calculateSimilarity(errorMessage, call.error ?? '');

      if (similarity >= 0.6) {
        // 错误相似度阈值稍低（0.6）
        // 解决方案：查找该查询后续是否有成功的相同工具调用
        const successfulCalls = query.toolCalls.filter(
          tc => tc.name === toolName && tc.status === 'success'
        );

        if (successfulCalls.length > 0) {
          errorSolutions.push({
            queryId: query.id,
            errorMessage: call.error ?? '',
            solution: query.answer, // 使用整个回答作为解决方案
            toolName,
            sessionId: query.sessionId,
            createdAt: query.createdAt,
          });
        }
      }
    }
  }

  // 2. 按时间降序排序（最近的解决方案优先）
  errorSolutions.sort((a, b) => b.createdAt - a.createdAt);

  return errorSolutions.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Access Count Update
// ---------------------------------------------------------------------------

/**
 * 增加查询的访问次数
 */
export async function incrementQueryAccessCount(queryId: string): Promise<void> {
  const query = await db.queries.get(queryId);
  if (!query) return;

  await db.queries.update(queryId, {
    accessCount: (query.accessCount ?? 0) + 1,
  });
}

/**
 * 增加会话的访问次数
 */
export async function incrementSessionAccessCount(sessionId: string): Promise<void> {
  const session = await db.sessions.get(sessionId);
  if (!session) return;

  await db.sessions.update(sessionId, {
    accessCount: (session.accessCount ?? 0) + 1,
  });
}
