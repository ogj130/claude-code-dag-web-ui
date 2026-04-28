/**
 * 全文索引管理 — SQLite FTS5 主路径 + FlexSearch 降级
 *
 * V3 升级：优先使用 SQLite FTS5（BM25 排序 + snippet 高亮），
 * SQLite 不可用时降级到 FlexSearch 内存索引。
 *
 * 索引字段：
 * - id: 唯一标识
 * - type: 'session' | 'query'
 * - title: 会话标题（session 专用）
 * - question: 用户问题（query 专用）
 * - answer: AI 回答（query 专用）
 * - tags: 标签列表
 * - createdAt: 创建时间戳
 * - sessionId: 所属会话 ID（query 专用）
 * - toolNames: 工具名称列表（query 专用，用于高级筛选）
 */

import FlexSearch from 'flexsearch';
import { db } from './db';
import type { DBSession, DBQuery } from '@/types/storage';
import { decompress } from '@/utils/compression';
import { checkSQLiteAvailable } from '@/services/sqliteFallback';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SearchDocument {
  id: string;
  type: 'session' | 'query';
  title?: string;
  question?: string;
  answer?: string;
  tags: string[];
  createdAt: number;
  sessionId?: string;
  toolNames?: string[];
  [key: string]: any;
}

/** 搜索结果 */
export interface SearchResult {
  doc: SearchDocument;
  score: number;
  matches?: Array<{
    field: string;
    value: string;
  }>;
}

// ---------------------------------------------------------------------------
// FlexSearch Index (Document index for multi-field support)
// ---------------------------------------------------------------------------

// 使用 FlexSearch.Document 来支持多字段索引和结果丰富
const index = new FlexSearch.Document<SearchDocument>({
  document: {
    id: 'id',
    index: [
      { field: 'title', tokenize: 'forward', resolution: 9 },
      { field: 'question', tokenize: 'forward', resolution: 9 },
      { field: 'answer', tokenize: 'forward', resolution: 5 },
      { field: 'tags', tokenize: 'full', resolution: 5 },
    ],
    store: true,
  },
  tokenize: 'forward',
  resolution: 9,
  cache: 100,
});

// ---------------------------------------------------------------------------
// In-memory doc map (for score + field matching)
// ---------------------------------------------------------------------------

const docMap = new Map<string, SearchDocument>();

// ---------------------------------------------------------------------------
// Build Index
// ---------------------------------------------------------------------------

/**
 * 从 IndexedDB 加载所有会话和问答，构建 FlexSearch 索引
 */
export async function buildSearchIndex(): Promise<void> {
  // 清空已有索引
  index.clear();
  docMap.clear();

  // 加载所有未删除的会话
  const sessions = await db.sessions
    .where('status')
    .notEqual('deleted')
    .toArray();

  // 加载所有查询
  const queries = await db.queries.toArray();

  // 构建 session 索引
  for (const session of sessions) {
    const doc: SearchDocument = {
      id: session.id,
      type: 'session',
      title: session.title,
      tags: session.tags,
      createdAt: session.createdAt,
    };
    addDocToIndex(doc);
  }

  // 构建 query 索引
  for (const query of queries) {
    const toolNames = query.toolCalls.map(tc => tc.name);
    const doc: SearchDocument = {
      id: query.id,
      type: 'query',
      question: decompress(query.question),
      answer: decompress(query.answer),
      tags: [],
      createdAt: query.createdAt,
      sessionId: query.sessionId,
      toolNames,
    };
    addDocToIndex(doc);
  }

  console.info('[SearchIndex] Built index with', sessions.length, 'sessions and', queries.length, 'queries');
}

/**
 * 添加单个文档到索引
 */
function addDocToIndex(doc: SearchDocument): void {
  docMap.set(doc.id, doc);
  index.add(doc);
}

/**
 * 增量更新：添加或替换会话文档
 */
export function upsertSessionDoc(session: DBSession): void {
  const doc: SearchDocument = {
    id: session.id,
    type: 'session',
    title: session.title,
    tags: session.tags,
    createdAt: session.createdAt,
  };
  // 先删除旧文档（如果存在）
  if (docMap.has(doc.id)) {
    index.remove(doc.id);
    docMap.delete(doc.id);
  }
  addDocToIndex(doc);
}

/**
 * 增量更新：添加或替换查询文档
 */
export function upsertQueryDoc(query: DBQuery): void {
  const toolNames = query.toolCalls.map(tc => tc.name);
  const doc: SearchDocument = {
    id: query.id,
    type: 'query',
    question: decompress(query.question),
    answer: decompress(query.answer),
    tags: [],
    createdAt: query.createdAt,
    sessionId: query.sessionId,
    toolNames,
  };
  if (docMap.has(doc.id)) {
    index.remove(doc.id);
    docMap.delete(doc.id);
  }
  addDocToIndex(doc);
}

/**
 * 从索引中删除文档
 */
export function removeDoc(id: string): void {
  if (docMap.has(id)) {
    index.remove(id);
    docMap.delete(id);
  }
}

// ---------------------------------------------------------------------------
// SQLite FTS5 Search (V3 Primary Path)
// ---------------------------------------------------------------------------

/** FTS5 搜索结果行（来自 IPC） */
interface FTS5ResultRow {
  id: string;
  type: string;
  title: string | null;
  question: string | null;
  answer: string | null;
  tags: string[];
  created_at: number;
  session_id: string | null;
  tool_names: string[] | null;
  rank: number;
  snippet_title?: string;
  snippet_question?: string;
  snippet_answer?: string;
}

/** 判断是否走 FTS5 路径 */
let _useFTS5: boolean | null = null;

async function shouldUseFTS5(): Promise<boolean> {
  if (_useFTS5 !== null) return _useFTS5;
  _useFTS5 = await checkSQLiteAvailable();
  if (_useFTS5) {
    console.info('[SearchIndex] Using SQLite FTS5 for search');
  }
  return _useFTS5;
}

/**
 * SQLite FTS5 搜索（通过 IPC 调用主进程）
 */
async function searchFTS5(options: SearchOptions): Promise<SearchResult[]> {
  const { query, dateFrom, dateTo, tags = [], type, limit = 20 } = options;

  if (!query.trim()) return [];

  try {
    const result = await window.electron.invoke('sqlite:search:fts5', {
      query: query.trim(),
      type: type ?? null,
      dateFrom: dateFrom ?? null,
      dateTo: dateTo ?? null,
      tags: tags.length > 0 ? tags : null,
      limit,
    }) as FTS5ResultRow[] | null;

    if (!result) return [];

    return result.map((row) => ({
      doc: {
        id: row.id,
        type: row.type as 'session' | 'query',
        title: row.title ?? undefined,
        question: row.question ?? undefined,
        answer: row.answer ?? undefined,
        tags: row.tags,
        createdAt: row.created_at,
        sessionId: row.session_id ?? undefined,
        toolNames: row.tool_names ?? undefined,
      },
      score: Math.abs(row.rank), // BM25 rank is negative, lower = better
      matches: [
        row.snippet_title && { field: 'title', value: row.snippet_title },
        row.snippet_question && { field: 'question', value: row.snippet_question },
        row.snippet_answer && { field: 'answer', value: row.snippet_answer },
      ].filter(Boolean) as Array<{ field: string; value: string }>,
    }));
  } catch (err) {
    console.warn('[SearchIndex] FTS5 search failed, falling back to FlexSearch:', err);
    _useFTS5 = false;
    return searchFlexSearch(options);
  }
}

// ---------------------------------------------------------------------------
// FlexSearch Search (Fallback Path)
// ---------------------------------------------------------------------------

export interface SearchOptions {
  /** 关键词 */
  query: string;
  /** 时间范围起点（毫秒时间戳） */
  dateFrom?: number;
  /** 时间范围终点（毫秒时间戳） */
  dateTo?: number;
  /** 标签过滤（为空表示不过滤） */
  tags?: string[];
  /** 工具类型过滤（为空表示不过滤） */
  toolTypes?: string[];
  /** 类型过滤（为空表示全部） */
  type?: 'session' | 'query';
  /** 最大结果数 */
  limit?: number;
}

/**
 * FlexSearch 内存搜索（降级路径）
 */
function searchFlexSearch(options: SearchOptions): SearchResult[] {
  const {
    query,
    dateFrom,
    dateTo,
    tags = [],
    toolTypes = [],
    type,
    limit = 20,
  } = options;

  if (!query.trim()) {
    return [];
  }

  // FlexSearch Document 搜索
  const rawResults = index.search(query, {
    limit: limit * 3, // 多取一些，后面再过滤
    enrich: true,
  });

  // 合并所有字段的搜索结果，按 id 去重
  const seenIds = new Set<string>();
  const scored = new Map<string, number>();

  for (const fieldResult of rawResults) {
    for (const item of fieldResult.result) {
      const id = String(item.id);
      if (!seenIds.has(id)) {
        seenIds.add(id);
        scored.set(id, 1);
      } else {
        // 多个字段匹配，提高评分
        scored.set(id, (scored.get(id) ?? 1) + 1);
      }
    }
  }

  // 转换为结果并应用过滤
  const results: SearchResult[] = [];

  for (const [id, score] of scored) {
    const doc = docMap.get(id);
    if (!doc) continue;

    // 类型过滤
    if (type && doc.type !== type) continue;

    // 时间范围过滤
    if (dateFrom !== undefined && doc.createdAt < dateFrom) continue;
    if (dateTo !== undefined && doc.createdAt > dateTo) continue;

    // 标签过滤（文档标签包含任意一个过滤标签即可）
    if (tags.length > 0) {
      const hasTag = tags.some(tag => doc.tags.includes(tag));
      if (!hasTag) continue;
    }

    // 工具类型过滤
    if (toolTypes.length > 0 && doc.toolNames) {
      const hasTool = toolTypes.some(t => doc.toolNames!.includes(t));
      if (!hasTool) continue;
    }

    results.push({ doc, score });
  }

  // 按评分降序排序
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, limit);
}

/**
 * 执行搜索（V3：FTS5 优先，FlexSearch 降级）
 *
 * - 主路径：SQLite FTS5（BM25 排序 + snippet 高亮，< 50ms）
 * - 降级路径：FlexSearch 内存索引（FTS5 不可用或调用失败时）
 */
export async function search(options: SearchOptions): Promise<SearchResult[]> {
  if (await shouldUseFTS5()) {
    return searchFTS5(options);
  }
  return searchFlexSearch(options);
}

/**
 * 获取所有已索引的标签（用于过滤器下拉）
 */
export function getAllTags(): string[] {
  const tagSet = new Set<string>();
  for (const doc of docMap.values()) {
    for (const tag of doc.tags) {
      tagSet.add(tag);
    }
  }
  return Array.from(tagSet).sort();
}

/**
 * 获取所有已索引的工具类型（用于过滤器下拉）
 */
export function getAllToolTypes(): string[] {
  const toolSet = new Set<string>();
  for (const doc of docMap.values()) {
    if (doc.toolNames) {
      for (const tool of doc.toolNames) {
        toolSet.add(tool);
      }
    }
  }
  return Array.from(toolSet).sort();
}

/**
 * 获取索引统计
 */
export function getIndexStats(): { sessionCount: number; queryCount: number } {
  let sessionCount = 0;
  let queryCount = 0;
  for (const doc of docMap.values()) {
    if (doc.type === 'session') sessionCount++;
    else queryCount++;
  }
  return { sessionCount, queryCount };
}
