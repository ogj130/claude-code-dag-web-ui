/**
 * 历史召回算法
 *
 * 提供三大召回能力：
 * 1. 加权排序召回（关键词 0.4 + 时间衰减 0.3 + 使用频率 0.3）
 * 2. 相似问题检测（相似度 > 0.8 提示"你之前问过类似问题"）
 * 3. 错误解决方案推荐（基于相似错误信息搜索）
 */

import { getErrorLogs } from './errorLogger';
import {
  searchDocuments,
  getAllDocuments,
} from './searchIndex';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** 搜索文档（与 searchIndex 对齐） */
export interface RecallDocument {
  id: string;
  sessionId: string;
  query: string;
  summary?: string;
  analysis?: string;
  timestamp: number;
  errorMessage?: string;
}

/** 排序结果 */
export interface RankedResult extends RecallDocument {
  score: number;
  keywordScore: number;
  timeDecay: number;
  usageScore: number;
}

/** 相似问题 */
export interface SimilarQuery {
  document: RecallDocument;
  similarity: number;
}

/** 错误解决方案推荐 */
export interface ErrorSolution {
  document: RecallDocument;
  errorSimilarity: number;
}

// ---------------------------------------------------------------------------
// Term extraction
// ---------------------------------------------------------------------------

/** 中英文分词（与 searchIndex 保持一致） */
function tokenize(text: string): string[] {
  if (!text) return [];
  const cleaned = text
    .replace(/<[^>]+>/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .toLowerCase()
    .trim();
  if (!cleaned) return [];
  const englishWords = cleaned.match(/[a-z0-9]{2,}/g) ?? [];
  const chineseChars = cleaned.match(/[\u4e00-\u9fff]/g) ?? [];
  const chineseTerms: string[] = [];
  for (let i = 0; i < chineseChars.length - 1; i++) {
    chineseTerms.push(chineseChars[i] + chineseChars[i + 1]);
  }
  return [...englishWords, ...chineseTerms];
}

/** 提取文本词项集合 */
function extractTerms(text: string): Set<string> {
  return new Set(tokenize(text));
}

// ---------------------------------------------------------------------------
// Jaccard similarity
// ---------------------------------------------------------------------------

/**
 * 计算 Jaccard 相似度
 * similarity = |A ∩ B| / |A ∪ B|
 */
export function calculateJaccardSimilarity(textA: string, textB: string): number {
  const termsA = extractTerms(textA);
  const termsB = extractTerms(textB);

  if (termsA.size === 0 && termsB.size === 0) return 0;
  if (termsA.size === 0 || termsB.size === 0) return 0;

  let intersection = 0;
  for (const term of termsA) {
    if (termsB.has(term)) intersection++;
  }

  const union = termsA.size + termsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * 计算编辑距离（Levenshtein），用于短文本精确相似度
 */
export function calculateEditDistance(textA: string, textB: string): number {
  const a = textA.toLowerCase();
  const b = textB.toLowerCase();

  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[a.length][b.length];
}

/**
 * 综合相似度：Jaccard（权重 0.6）+ 归一化编辑距离（权重 0.4）
 */
export function calculateSimilarity(textA: string, textB: string): number {
  if (textA === textB) return 1;
  if (!textA.trim() || !textB.trim()) return 0;

  const jaccard = calculateJaccardSimilarity(textA, textB);

  // 归一化编辑距离（0 = 完全相同，1 = 完全不同）
  const maxLen = Math.max(textA.length, textB.length);
  const editDist = calculateEditDistance(textA, textB);
  const normalizedEdit = maxLen === 0 ? 0 : 1 - editDist / maxLen;

  return 0.6 * jaccard + 0.4 * normalizedEdit;
}

// ---------------------------------------------------------------------------
// Score components
// ---------------------------------------------------------------------------

const MS_IN_DAY = 24 * 60 * 60 * 1000;

/**
 * 计算时间衰减分数（指数衰减，半衰期 7 天）
 * score = e^(-λ * daysAgo)，λ = ln(2) / 7
 */
export function calculateTimeDecay(timestamp: number, halfLifeDays = 7): number {
  const daysAgo = (Date.now() - timestamp) / MS_IN_DAY;
  const lambda = Math.LN2 / halfLifeDays;
  return Math.exp(-lambda * daysAgo);
}

/**
 * 计算关键词匹配分数（Jaccard）
 */
export function calculateKeywordScore(doc: RecallDocument, currentQuery: string): number {
  return calculateJaccardSimilarity(doc.query, currentQuery);
}

/** 访问频率缓存（内存，非持久化） */
const usageCountMap = new Map<string, number>();

/**
 * 增加访问计数
 */
export function incrementUsageCount(docId: string): void {
  usageCountMap.set(docId, (usageCountMap.get(docId) ?? 0) + 1);
}

/**
 * 计算使用频率分数（归一化到 [0, 1]）
 */
export function calculateUsageScore(docId: string): number {
  const count = usageCountMap.get(docId) ?? 0;
  if (count === 0) return 0;
  // 对数归一化：访问次数越多，分数增幅越小
  return Math.min(1, Math.log1p(count) / Math.log1p(20));
}

// ---------------------------------------------------------------------------
// Weighted ranking
// ---------------------------------------------------------------------------

const WEIGHT_KEYWORD = 0.4;
const WEIGHT_TIME = 0.3;
const WEIGHT_USAGE = 0.3;

/**
 * 加权排序（关键词 0.4 + 时间衰减 0.3 + 使用频率 0.3）
 */
export function rankResults(documents: RecallDocument[], currentQuery: string): RankedResult[] {
  return documents
    .map(doc => {
      const keywordScore = calculateKeywordScore(doc, currentQuery);
      const timeDecay = calculateTimeDecay(doc.timestamp);
      const usageScore = calculateUsageScore(doc.id);

      const score = WEIGHT_KEYWORD * keywordScore
        + WEIGHT_TIME * timeDecay
        + WEIGHT_USAGE * usageScore;

      return {
        ...doc,
        score,
        keywordScore,
        timeDecay,
        usageScore,
      };
    })
    .sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------------
// Similar question detection
// ---------------------------------------------------------------------------

/**
 * 检测与当前问题相似的问题（相似度 > threshold）
 */
export function findSimilarQueries(
  documents: RecallDocument[],
  currentQuery: string,
  threshold = 0.8,
  limit = 5
): SimilarQuery[] {
  return documents
    .map(doc => ({
      document: doc,
      similarity: calculateSimilarity(doc.query, currentQuery),
    }))
    .filter(item => item.similarity >= threshold && item.document.query !== currentQuery)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Error solution recommendation
// ---------------------------------------------------------------------------

/**
 * 从错误日志和历史记录中推荐相似错误的解决方案
 */
export function recommendErrorSolutions(
  currentError: string,
  documents: RecallDocument[],
  threshold = 0.6,
  limit = 3
): ErrorSolution[] {
  if (!currentError.trim()) return [];

  const lowerError = currentError.toLowerCase();

  return documents
    .map(doc => {
      // 基于 errorMessage 字段匹配
      const errorText = doc.errorMessage ?? '';
      const similarity = errorText
        ? calculateSimilarity(errorText, lowerError)
        : calculateSimilarity(doc.query, lowerError) * 0.5; // 无 errorMessage 时降低权重

      return { document: doc, errorSimilarity: similarity };
    })
    .filter(item => item.errorSimilarity >= threshold && !!item.document.summary)
    .sort((a, b) => b.errorSimilarity - a.errorSimilarity)
    .slice(0, limit);
}

/**
 * 从 localStorage 错误日志中搜索相似错误
 */
export function findSimilarErrorLogs(
  currentError: string,
  threshold = 0.6,
  limit = 3
): { id: string; message: string; timestamp: number; similarity: number }[] {
  const logs = getErrorLogs();
  if (logs.length === 0) return [];

  return logs
    .map(log => ({
      ...log,
      similarity: calculateSimilarity(log.message, currentError),
    }))
    .filter(log => log.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Main recall function
// ---------------------------------------------------------------------------

/**
 * 主召回函数：基于关键词搜索 + 加权排序
 */
export function recallByQuery(
  currentQuery: string,
  options: {
    limit?: number;
    excludeIds?: string[];
  } = {}
): RankedResult[] {
  const { limit = 20, excludeIds = [] } = options;

  const keywords = tokenize(currentQuery);
  const matchedDocs = searchDocuments(keywords);

  const documents: RecallDocument[] = matchedDocs
    .map(doc => ({
      id: doc.id,
      sessionId: doc.sessionId,
      query: doc.query,
      summary: doc.summary,
      analysis: doc.analysis,
      timestamp: doc.timestamp,
    }))
    .filter(doc => !excludeIds.includes(doc.id));

  const ranked = rankResults(documents, currentQuery);
  return ranked.slice(0, limit);
}

/**
 * 获取所有历史文档（按时间降序）
 */
export function getHistoryDocuments(): RecallDocument[] {
  return getAllDocuments().map(doc => ({
    id: doc.id,
    sessionId: doc.sessionId,
    query: doc.query,
    summary: doc.summary,
    analysis: doc.analysis,
    timestamp: doc.timestamp,
  }));
}
