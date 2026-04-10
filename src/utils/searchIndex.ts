/**
 * 搜索索引模块
 * 提供跨会话的全文搜索能力，基于词项倒排索引
 */

import { db } from '@/lib/db';
import type { QueryRecord } from '@/lib/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** 索引中的文档 */
export interface IndexedDocument {
  id: string;
  sessionId: string;
  query: string;
  summary?: string;
  analysis?: string;
  timestamp: number;
  /** 提取的词项集合（用于快速匹配） */
  terms: Set<string>;
  /** 原始记录引用 */
  record: QueryRecord;
}

/** 倒排索引项 */
interface InvertedIndexEntry {
  docId: string;
  positions: number[];
}

// ---------------------------------------------------------------------------
// Inverted Index
// ---------------------------------------------------------------------------

/** 内存倒排索引 */
const invertedIndex = new Map<string, InvertedIndexEntry[]>();

/** 已索引的文档映射 */
const docMap = new Map<string, IndexedDocument>();

/** 是否已构建过索引 */
let isIndexed = false;

// ---------------------------------------------------------------------------
// Tokenization
// ---------------------------------------------------------------------------

/**
 * 将文本拆分为词项（简单中英文分词 + 小写化）
 */
function tokenize(text: string): string[] {
  if (!text) return [];

  // 移除 HTML 标签和特殊字符，转小写
  const cleaned = text
    .replace(/<[^>]+>/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .toLowerCase()
    .trim();

  if (!cleaned) return [];

  // 英文/数字词项
  const englishWords = cleaned.match(/[a-z0-9]{2,}/g) ?? [];

  // 中文词项（按字符 N-gram，bigram 提升召回）
  const chineseChars = cleaned.match(/[\u4e00-\u9fff]/g) ?? [];
  const chineseTerms: string[] = [];
  for (let i = 0; i < chineseChars.length - 1; i++) {
    chineseTerms.push(chineseChars[i] + chineseChars[i + 1]);
  }

  return [...englishWords, ...chineseTerms];
}

// ---------------------------------------------------------------------------
// Index operations
// ---------------------------------------------------------------------------

/**
 * 添加文档到索引
 */
function addToIndex(doc: IndexedDocument): void {
  docMap.set(doc.id, doc);

  for (const term of doc.terms) {
    if (!invertedIndex.has(term)) {
      invertedIndex.set(term, []);
    }
    invertedIndex.get(term)!.push({ docId: doc.id, positions: [] });
  }
}

/**
 * 从索引中移除文档
 */
function removeFromIndex(docId: string): void {
  const doc = docMap.get(docId);
  if (!doc) return;

  for (const term of doc.terms) {
    const entries = invertedIndex.get(term);
    if (entries) {
      const filtered = entries.filter(e => e.docId !== docId);
      if (filtered.length === 0) {
        invertedIndex.delete(term);
      } else {
        invertedIndex.set(term, filtered);
      }
    }
  }

  docMap.delete(docId);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * 构建全量搜索索引（异步，从 IndexedDB 加载所有历史记录）
 * 索引在页面生命周期内持久化，重建开销较大时增量更新
 */
export async function buildSearchIndex(): Promise<void> {
  if (isIndexed) return;

  try {
    const allQueries = await db.queries.toArray();

    for (const record of allQueries) {
      const terms = new Set([
        ...tokenize(record.query),
        ...tokenize(record.summary ?? ''),
        ...tokenize(record.analysis ?? ''),
      ]);

      const doc: IndexedDocument = {
        id: record.id,
        sessionId: record.sessionId,
        query: record.query,
        summary: record.summary,
        analysis: record.analysis,
        timestamp: record.timestamp,
        terms,
        record,
      };

      addToIndex(doc);
    }

    isIndexed = true;
    console.info('[SearchIndex] Built index with', allQueries.length, 'documents');
  } catch (err) {
    console.error('[SearchIndex] Failed to build index:', err);
  }
}

/**
 * 增量更新索引（新增单个记录）
 */
export function indexDocument(record: QueryRecord): void {
  const terms = new Set([
    ...tokenize(record.query),
    ...tokenize(record.summary ?? ''),
    ...tokenize(record.analysis ?? ''),
  ]);

  const doc: IndexedDocument = {
    id: record.id,
    sessionId: record.sessionId,
    query: record.query,
    summary: record.summary,
    analysis: record.analysis,
    timestamp: record.timestamp,
    terms,
    record,
  };

  addToIndex(doc);
}

/**
 * 增量移除索引（删除单个记录）
 */
export function unindexDocument(docId: string): void {
  removeFromIndex(docId);
}

/**
 * 获取所有已索引的文档
 */
export function getAllDocuments(): IndexedDocument[] {
  return Array.from(docMap.values());
}

/**
 * 获取索引统计信息
 */
export function getIndexStats(): { documentCount: number; termCount: number } {
  return {
    documentCount: docMap.size,
    termCount: invertedIndex.size,
  };
}

/**
 * 根据关键词搜索文档（返回匹配的文档 ID 集合）
 * 支持 AND 逻辑：所有词项都匹配才返回
 */
export function searchByKeyword(keywords: string[]): string[] {
  if (keywords.length === 0) return [];

  const matchedDocIds = new Set<string>();

  for (const kw of keywords) {
    const tokens = tokenize(kw);
    if (tokens.length === 0) continue;

    const tokenDocIds = new Set<string>();

    for (const token of tokens) {
      const entries = invertedIndex.get(token);
      if (!entries) {
        // 任意词项无匹配，整体不匹配
        tokenDocIds.clear();
        break;
      }
      for (const entry of entries) {
        tokenDocIds.add(entry.docId);
      }
    }

    // AND：取交集
    if (keywords.indexOf(kw) === 0) {
      for (const id of tokenDocIds) matchedDocIds.add(id);
    } else {
      for (const id of matchedDocIds) {
        if (!tokenDocIds.has(id)) matchedDocIds.delete(id);
      }
    }
  }

  return Array.from(matchedDocIds);
}

/**
 * 根据关键词获取文档（返回完整文档对象列表）
 */
export function searchDocuments(keywords: string[]): IndexedDocument[] {
  const ids = searchByKeyword(keywords);
  return ids.map(id => docMap.get(id)!).filter(Boolean);
}
