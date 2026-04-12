/**
 * Query CRUD 操作（带自动压缩和分片支持）
 */

import { db } from '@/lib/db';
import type { QueryRecord } from '@/lib/db';
// 写入 cc-web-ui DB 用于统计（与 CCWebDB 分开）
import { db as statsDb } from '@/stores/db';
import type { DBQuery } from '@/types/storage';
// 使用 sessionStorage 的 updateSession
import { updateSession } from './sessionStorage';
import type {
  CreateQueryInput,
  QueryStatus,
  PaginatedResult,
  PaginationParams,
} from '@/types/storage';

/** 默认分页参数 */
const DEFAULT_PAGINATION: PaginationParams = {
  page: 1,
  pageSize: 50,
};

// ---------------------------------------------------------------------------
// Compression helpers
// ---------------------------------------------------------------------------

/**
 * 对可能需要压缩的内容进行压缩处理
 */
function generateId(): string {
  return `query_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 创建新 Query（存入 CCWebDB，向量库自动索引）
 *
 * CCWebDB Schema（QueryRecord）：
 *   id, sessionId, query, summary, analysis, timestamp, tokenCount, toolCount, metadata
 *
 * metadata 中存储额外字段（toolCalls, dag, duration, status, errorMessage 等）
 *
 * @param input 创建参数
 * @returns 创建的 Query
 */
export async function createQuery(input: CreateQueryInput): Promise<QueryRecord> {
  const now = Date.now();

  // 先获取 session 以便读取 projectPath（用于后续向量索引和统计过滤）
  const sessionRecord = await db.sessions.get(input.sessionId);

  // CCWebDB 直接存原始文本（供 RAG 检索）
  const record: QueryRecord = {
    id: generateId(),
    sessionId: input.sessionId,
    query: input.question,       // 原始文本，RAG 向量化用
    summary: input.answer,
    analysis: undefined,
    timestamp: now,
    tokenCount: input.tokenUsage,
    toolCount: input.toolCalls?.length ?? 0,
    projectPath: input.workspacePath ?? sessionRecord?.projectPath ?? '',
    metadata: JSON.stringify({
      toolCalls: input.toolCalls ?? [],
      dag: input.dag ?? null,
      duration: input.duration,
      status: input.status,
      errorMessage: input.errorMessage,
    }),
  };

  await db.queries.add(record);

  // ── 同时写入 cc-web-ui DB（供统计面板使用）───────────────────────────────
  try {
    const statsRecord: DBQuery = {
      id: record.id,
      sessionId: input.sessionId,
      question: input.question,
      answer: input.answer,
      toolCalls: input.toolCalls ?? [],
      dag: input.dag ?? null,
      tokenUsage: input.tokenUsage,
      duration: input.duration,
      createdAt: now,
      status: input.status,
      errorMessage: input.errorMessage,
      workspacePath: input.workspacePath ?? sessionRecord?.projectPath ?? '',
    };
    await statsDb.queries.add(statsRecord);
    console.info('[QueryStorage] Stats DB write OK:', statsRecord.id, 'tokenUsage:', statsRecord.tokenUsage);
  } catch (err) {
    // 统计 DB 写入失败不影响主流程
    console.warn('[QueryStorage] Failed to write to stats DB:', err);
  }

  // 更新关联 Session 的统计信息
  await updateSession(input.sessionId, {
    tokenUsageIncrement: input.tokenUsage,
    queryCountIncrement: 1,
  });

  console.info('[QueryStorage] Created query:', record.id, 'for session:', input.sessionId);

  // ── 自动向量索引（静默失败，不影响 Query 创建） ────────────────────────
  // sessionRecord 已在函数开头获取，直接使用
  const workspacePath = sessionRecord?.projectPath;
  if (workspacePath) {
    const { indexQueryChunk } = await import('@/stores/vectorStorage');
    indexQueryChunk(input.sessionId, record.id, workspacePath, record.query, {
      tokenUsage: input.tokenUsage,
      status: input.status,
    }).catch((err: unknown) => {
      console.warn('[QueryStorage] Auto-index failed:', err instanceof Error ? err.message : String(err));
    });

    // 索引 Answer 内容
    if (input.answer) {
      const { indexAnswerChunks } = await import('@/stores/vectorStorage');
      indexAnswerChunks(input.sessionId, record.id, workspacePath, input.answer, {
        sessionTitle: sessionRecord?.name || 'Untitled',
        parentQuery: input.question,
      }).catch((err: unknown) => {
        console.warn('[QueryStorage] Answer auto-index failed:', err instanceof Error ? err.message : String(err));
      });
    }
  } else {
    console.warn('[QueryStorage] Auto-index skipped: session', input.sessionId, 'not found in CCWebDB or has no projectPath');
  }

  return record;
}

/**
 * 获取 Query
 * @param id Query ID
 * @returns Query 或 undefined
 */
export async function getQuery(id: string): Promise<QueryRecord | undefined> {
  return db.queries.get(id);
}

/**
 * 更新 Query（仅支持 summary 和 metadata）
 * @param id Query ID
 * @param updates 更新内容
 * @returns 更新后的 Query
 */
export async function updateQuery(
  id: string,
  updates: Partial<Pick<QueryRecord, 'summary' | 'metadata'>>
): Promise<QueryRecord | undefined> {
  await db.queries.update(id, updates);
  console.info('[QueryStorage] Updated query:', id);
  return db.queries.get(id);
}

/**
 * 更新 stats DB 中的 tokenUsage（query_summary 先到达，token_usage 后到达）
 * @param queryId Query ID
 * @param tokenUsage Token 使用量
 */
export async function updateQueryTokenUsage(queryId: string, tokenUsage: number): Promise<void> {
  try {
    await statsDb.queries.update(queryId, { tokenUsage });
    console.info('[QueryStorage] updateQueryTokenUsage OK:', queryId, 'tokenUsage:', tokenUsage);
  } catch (err) {
    console.warn('[QueryStorage] updateQueryTokenUsage failed:', err);
  }
}

/**
 * 删除 Query
 * @param id Query ID
 */
export async function deleteQuery(id: string): Promise<void> {
  await db.queries.delete(id);
  console.info('[QueryStorage] Deleted query:', id);
}

/**
 * 获取 Session 的所有 Query
 * @param sessionId Session ID
 * @param pagination 分页参数
 * @returns 分页结果
 */
export async function getQueriesBySession(
  sessionId: string,
  pagination: PaginationParams = DEFAULT_PAGINATION
): Promise<PaginatedResult<QueryRecord>> {
  const { page, pageSize } = pagination;
  const offset = (page - 1) * pageSize;

  const total = await db.queries.where('sessionId').equals(sessionId).count();

  // 获取分页数据（按 timestamp 降序）
  const items = await db.queries
    .where('sessionId')
    .equals(sessionId)
    .reverse()
    .sortBy('timestamp')
    .then(items => items.slice(offset, offset + pageSize));

  const totalPages = Math.ceil(total / pageSize);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages,
    hasMore: page < totalPages,
  };
}

/**
 * 获取 Session 的最新 Query
 * @param sessionId Session ID
 * @returns 最新 Query 或 undefined
 */
export async function getLatestQuery(sessionId: string): Promise<QueryRecord | undefined> {
  const queries = await db.queries
    .where('sessionId')
    .equals(sessionId)
    .reverse()
    .sortBy('timestamp');

  return queries[0];
}

/**
 * 删除 Session 的所有 Query
 * @param sessionId Session ID
 * @returns 删除的数量
 */
export async function deleteQueriesBySession(sessionId: string): Promise<number> {
  const queries = await db.queries.where('sessionId').equals(sessionId).toArray();
  const count = queries.length;

  await db.queries.where('sessionId').equals(sessionId).delete();
  console.info('[QueryStorage] Deleted', count, 'queries for session:', sessionId);

  return count;
}

/**
 * 根据状态获取 Query（status 从 metadata 中提取）
 * @param status 查询状态
 * @param pagination 分页参数
 * @returns 分页结果
 */
export async function getQueriesByStatus(
  status: QueryStatus,
  pagination: PaginationParams = DEFAULT_PAGINATION
): Promise<PaginatedResult<QueryRecord>> {
  const { page, pageSize } = pagination;
  const offset = (page - 1) * pageSize;

  // 从 metadata 中提取 status
  const allItems = await db.queries.toArray();
  const filtered = allItems.filter(q => {
    try {
      const meta = q.metadata ? JSON.parse(q.metadata) : {};
      return meta.status === status;
    } catch { return false; }
  });
  filtered.sort((a, b) => b.timestamp - a.timestamp);
  const total = filtered.length;
  const items = filtered.slice(offset, offset + pageSize);
  const totalPages = Math.ceil(total / pageSize);

  return { items, total, page, pageSize, totalPages, hasMore: page < totalPages };
}

/**
 * 搜索 Query（按问题内容）
 * @param keyword 搜索关键词
 * @param pagination 分页参数
 * @returns 分页结果
 */
export async function searchQueries(
  keyword: string,
  pagination: PaginationParams = DEFAULT_PAGINATION
): Promise<PaginatedResult<QueryRecord>> {
  const { page, pageSize } = pagination;
  const offset = (page - 1) * pageSize;
  const lowerKeyword = keyword.toLowerCase();

  const allItems = await db.queries.toArray();
  const filtered = allItems.filter(q => {
    let summary = q.summary || '';
    try {
      const meta = q.metadata ? JSON.parse(q.metadata) : {};
      if (meta.answer) summary = meta.answer;
    } catch {}
    return (
      q.query.toLowerCase().includes(lowerKeyword) ||
      summary.toLowerCase().includes(lowerKeyword)
    );
  });
  filtered.sort((a, b) => b.timestamp - a.timestamp);

  const total = filtered.length;
  const items = filtered.slice(offset, offset + pageSize);
  const totalPages = Math.ceil(total / pageSize);

  return { items, total, page, pageSize, totalPages, hasMore: page < totalPages };
}

/**
 * 获取错误类型的 Query
 * @param pagination 分页参数
 * @returns 分页结果
 */
export async function getErrorQueries(
  pagination: PaginationParams = DEFAULT_PAGINATION
): Promise<PaginatedResult<QueryRecord>> {
  return getQueriesByStatus('error', pagination);
}

/**
 * 获取 Query 统计数据
 * @param sessionId 可选的 Session ID
 * @returns 统计信息
 */
export async function getQueryStats(
  sessionId?: string
): Promise<{
  total: number;
  success: number;
  error: number;
  partial: number;
  totalTokenUsage: number;
  avgDuration: number;
}> {
  let queries: QueryRecord[];
  if (sessionId) {
    queries = await db.queries.where('sessionId').equals(sessionId).toArray();
  } else {
    queries = await db.queries.toArray();
  }

  let success = 0, error = 0, partial = 0;
  let totalDuration = 0;
  for (const q of queries) {
    try {
      const meta = q.metadata ? JSON.parse(q.metadata) : {};
      if (meta.status === 'success') success++;
      else if (meta.status === 'error') error++;
      else if (meta.status === 'partial') partial++;
      if (meta.duration) totalDuration += meta.duration;
    } catch {}
  }

  return {
    total: queries.length,
    success,
    error,
    partial,
    totalTokenUsage: queries.reduce((sum, q) => sum + q.tokenCount, 0),
    avgDuration: queries.length > 0 ? totalDuration / queries.length : 0,
  };
}

/**
 * 批量创建 Query（用于导入数据）
 * @param inputs 创建参数数组
 * @returns 创建的 Query 数组
 */
export async function batchCreateQueries(
  inputs: CreateQueryInput[]
): Promise<QueryRecord[]> {
  const records: QueryRecord[] = inputs.map((input, i) => ({
    id: generateId(),
    sessionId: input.sessionId,
    query: input.question,
    summary: input.answer,
    analysis: undefined,
    timestamp: Date.now() + i,
    tokenCount: input.tokenUsage,
    toolCount: input.toolCalls?.length ?? 0,
    metadata: JSON.stringify({
      toolCalls: input.toolCalls ?? [],
      dag: input.dag ?? null,
      duration: input.duration,
      status: input.status,
      errorMessage: input.errorMessage,
    }),
  }));

  await db.queries.bulkAdd(records);
  console.info('[QueryStorage] Batch created', records.length, 'queries');
  return records;
}
