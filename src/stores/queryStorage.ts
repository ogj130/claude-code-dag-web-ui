/**
 * Query CRUD 操作（带自动压缩和分片支持）
 */

import { db } from './db';
import { getSession, updateSession } from './sessionStorage';
import {
  compress,
  decompress,
  byteSize,
  COMPRESSION_THRESHOLD,
} from '@/utils/compression';
import { createShards, shouldShard } from '@/utils/sharding';
import type {
  DBQuery,
  CreateQueryInput,
  QueryStatus,
  PaginatedResult,
  PaginationParams,
  SessionShard,
  DAGData,
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
function compressIfNeeded(value: string): string {
  return compress(value);
}

/**
 * 对已压缩的内容进行解压缩
 */
function decompressIfNeeded(value: string): string {
  return decompress(value);
}

/**
 * 获取某个会话的当前大小（估算）
 */
async function getSessionSize(sessionId: string): Promise<number> {
  const queries = await db.queries.where('sessionId').equals(sessionId).toArray();
  let total = 0;

  for (const q of queries) {
    total += byteSize(q.question);
    total += byteSize(q.answer);
    if (q.dag) {
      total += byteSize(JSON.stringify(q.dag));
    }
    total += q.toolCalls.reduce((sum, tc) => {
      return sum + byteSize(JSON.stringify(tc.arguments)) + byteSize(JSON.stringify(tc.result));
    }, 0);
  }

  return total;
}

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return `query_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 创建新 Query（自动压缩大文本，支持分片）
 * @param input 创建参数
 * @returns 创建的 Query
 */
export async function createQuery(input: CreateQueryInput): Promise<DBQuery> {
  const now = Date.now();
  const questionStr = input.question;
  const answerStr = input.answer;
  const dagStr = input.dag ? JSON.stringify(input.dag) : null;

  // 自动压缩超过 1KB 的文本内容
  const question = compressIfNeeded(questionStr);
  const answer = compressIfNeeded(answerStr);
  const questionCompressed = byteSize(questionStr) >= COMPRESSION_THRESHOLD;
  const answerCompressed = byteSize(answerStr) >= COMPRESSION_THRESHOLD;

  // 处理 DAG 数据（支持大 DAG 自动压缩）
  let dag: DAGData | string | null = null;
  let dagCompressed = false;

  if (dagStr) {
    if (byteSize(dagStr) >= COMPRESSION_THRESHOLD) {
      dag = compressIfNeeded(dagStr); // 存储压缩后的字符串
      dagCompressed = true;
    } else {
      dag = JSON.parse(dagStr); // 小 DAG 直接存储 JSON 对象
    }
  }

  const query: DBQuery = {
    id: generateId(),
    sessionId: input.sessionId,
    question,
    answer,
    toolCalls: input.toolCalls ?? [],
    dag,
    tokenUsage: input.tokenUsage,
    duration: input.duration,
    createdAt: now,
    status: input.status,
    errorMessage: input.errorMessage,
    questionCompressed,
    answerCompressed,
    dagCompressed,
  };

  await db.queries.add(query);

  // 检查会话大小，超过 10MB 自动分片
  const sessionSize = await getSessionSize(input.sessionId);
  const session = await getSession(input.sessionId);

  if (session && !session.isSharded && shouldShard(sessionSize)) {
    // 标记会话为分片状态
    await updateSession(input.sessionId, { isSharded: true, shardCount: 1 });
    await migrateToShards(input.sessionId);
  } else if (session?.isSharded) {
    // 更新分片
    await updateShards(input.sessionId);
  }

  // 更新关联 Session 的统计信息
  await updateSession(input.sessionId, {
    tokenUsageIncrement: input.tokenUsage,
    queryCountIncrement: 1,
  });

  console.info('[QueryStorage] Created query:', query.id, 'for session:', input.sessionId);
  return query;
}

/**
 * 获取 Query（自动解压缩）
 * @param id Query ID
 * @returns Query 或 undefined
 */
export async function getQuery(id: string): Promise<DBQuery | undefined> {
  const query = await db.queries.get(id);
  if (!query) return undefined;

  // 自动解压缩字段
  return {
    ...query,
    question: decompressIfNeeded(query.question),
    answer: decompressIfNeeded(query.answer),
  };
}

/**
 * 更新 Query
 * @param id Query ID
 * @param updates 更新内容
 * @returns 更新后的 Query
 */
export async function updateQuery(
  id: string,
  updates: Partial<Pick<DBQuery, 'answer' | 'toolCalls' | 'dag' | 'tokenUsage' | 'status' | 'errorMessage'>>
): Promise<DBQuery | undefined> {
  await db.queries.update(id, updates);
  console.info('[QueryStorage] Updated query:', id);
  return db.queries.get(id);
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
 * 获取 Session 的所有 Query（自动处理分片）
 * @param sessionId Session ID
 * @param pagination 分页参数
 * @returns 分页结果
 */
export async function getQueriesBySession(
  sessionId: string,
  pagination: PaginationParams = DEFAULT_PAGINATION
): Promise<PaginatedResult<DBQuery>> {
  const { page, pageSize } = pagination;
  const offset = (page - 1) * pageSize;

  // 检查会话是否分片
  const session = await getSession(sessionId);
  if (session?.isSharded) {
    const allQueries = await loadQueriesFromShards(sessionId);
    const total = allQueries.length;
    const paginatedItems = allQueries.slice(offset, offset + pageSize);
    const totalPages = Math.ceil(total / pageSize);

    return {
      items: paginatedItems,
      total,
      page,
      pageSize,
      totalPages,
      hasMore: page < totalPages,
    };
  }

  // 普通会话：直接从 queries 表读取
  const total = await db.queries.where('sessionId').equals(sessionId).count();

  // 获取分页数据（按 createdAt 降序）
  const items = await db.queries
    .where('sessionId')
    .equals(sessionId)
    .reverse()
    .sortBy('createdAt')
    .then(items => items.slice(offset, offset + pageSize))
    .then(items => items.map(q => ({
      ...q,
      question: decompressIfNeeded(q.question),
      answer: decompressIfNeeded(q.answer),
    })));

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
export async function getLatestQuery(sessionId: string): Promise<DBQuery | undefined> {
  const queries = await db.queries
    .where('sessionId')
    .equals(sessionId)
    .reverse()
    .sortBy('createdAt');

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
 * 根据状态获取 Query
 * @param status 查询状态
 * @param pagination 分页参数
 * @returns 分页结果
 */
export async function getQueriesByStatus(
  status: QueryStatus,
  pagination: PaginationParams = DEFAULT_PAGINATION
): Promise<PaginatedResult<DBQuery>> {
  const { page, pageSize } = pagination;
  const offset = (page - 1) * pageSize;

  // 获取总数
  const total = await db.queries.where('status').equals(status).count();

  // 获取分页数据
  const items = await db.queries
    .where('status')
    .equals(status)
    .reverse()
    .sortBy('createdAt')
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
 * 搜索 Query（按问题内容）
 * @param keyword 搜索关键词
 * @param pagination 分页参数
 * @returns 分页结果
 */
export async function searchQueries(
  keyword: string,
  pagination: PaginationParams = DEFAULT_PAGINATION
): Promise<PaginatedResult<DBQuery>> {
  const { page, pageSize } = pagination;
  const offset = (page - 1) * pageSize;
  const lowerKeyword = keyword.toLowerCase();

  // 获取所有匹配的 queries
  const allItems = await db.queries.toArray();
  const filteredItems = allItems.filter(
    query =>
      query.question.toLowerCase().includes(lowerKeyword) ||
      query.answer.toLowerCase().includes(lowerKeyword)
  );

  // 按创建时间降序排序
  filteredItems.sort((a, b) => b.createdAt - a.createdAt);

  const total = filteredItems.length;
  const items = filteredItems.slice(offset, offset + pageSize);
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
 * 获取错误类型的 Query
 * @param pagination 分页参数
 * @returns 分页结果
 */
export async function getErrorQueries(
  pagination: PaginationParams = DEFAULT_PAGINATION
): Promise<PaginatedResult<DBQuery>> {
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
  let queries: DBQuery[];

  if (sessionId) {
    queries = await db.queries.where('sessionId').equals(sessionId).toArray();
  } else {
    queries = await db.queries.toArray();
  }

  const total = queries.length;
  const success = queries.filter(q => q.status === 'success').length;
  const error = queries.filter(q => q.status === 'error').length;
  const partial = queries.filter(q => q.status === 'partial').length;
  const totalTokenUsage = queries.reduce((sum, q) => sum + q.tokenUsage, 0);
  const avgDuration =
    total > 0 ? queries.reduce((sum, q) => sum + q.duration, 0) / total : 0;

  return {
    total,
    success,
    error,
    partial,
    totalTokenUsage,
    avgDuration,
  };
}

/**
 * 批量创建 Query（用于导入数据）
 * @param inputs 创建参数数组
 * @returns 创建的 Query 数组
 */
export async function batchCreateQueries(
  inputs: CreateQueryInput[]
): Promise<DBQuery[]> {
  const queries: DBQuery[] = inputs.map(input => ({
    id: generateId(),
    sessionId: input.sessionId,
    question: input.question,
    answer: input.answer,
    toolCalls: input.toolCalls ?? [],
    dag: input.dag ?? null,
    tokenUsage: input.tokenUsage,
    duration: input.duration,
    createdAt: Date.now(),
    status: input.status,
    errorMessage: input.errorMessage,
  }));

  await db.queries.bulkAdd(queries);
  console.info('[QueryStorage] Batch created', queries.length, 'queries');

  return queries;
}

// ---------------------------------------------------------------------------
// Sharding helpers (private)
// ---------------------------------------------------------------------------

/**
 * 将会话迁移到分片存储
 * 当会话数据超过 10MB 时触发
 */
async function migrateToShards(sessionId: string): Promise<void> {
  // 1. 读取所有现有 queries
  const queries = await db.queries.where('sessionId').equals(sessionId).toArray();

  if (queries.length === 0) return;

  // 2. 构建分片数据
  const shardQueries = queries.map(q => ({
    id: q.id,
    question: q.question,
    answer: q.answer,
    toolCalls: q.toolCalls.map(tc => ({
      id: tc.id,
      toolName: tc.name,
      arguments: JSON.stringify(tc.arguments),
      result: JSON.stringify(tc.result),
      startTime: tc.startTime,
      endTime: tc.endTime,
      status: (tc.success ? 'success' : 'error') as 'success' | 'error',
    })),
    tokenUsage: q.tokenUsage,
    duration: q.duration,
    createdAt: q.createdAt,
    status: q.status,
    errorMessage: q.errorMessage,
  }));

  // 使用最后一个 query 的 DAG（假设 DAG 是累积的）
  const lastQuery = queries[queries.length - 1];
  const dagData = lastQuery.dag ? JSON.stringify(lastQuery.dag) : JSON.stringify({ nodes: [], edges: [] });

  // 3. 创建分片
  const { shards } = createShards(sessionId, shardQueries, dagData);

  // 4. 写入分片到 IndexedDB
  const shardRecords: SessionShard[] = shards.map(s => ({
    id: s.id,
    sessionId: s.sessionId,
    shardIndex: s.shardIndex,
    data: s.data,
    originalSize: s.originalSize,
    createdAt: s.createdAt,
  }));

  await db.sessionShards.bulkPut(shardRecords);

  // 5. 删除原有的 inline queries
  await db.queries.where('sessionId').equals(sessionId).delete();

  console.info('[QueryStorage] Migrated session', sessionId, 'to', shards.length, 'shards');
}

/**
 * 更新分片会话（追加新 query 到最后一个分片）
 */
async function updateShards(sessionId: string): Promise<void> {
  const shardRows = await db.sessionShards
    .where('sessionId')
    .equals(sessionId)
    .sortBy('shardIndex');

  if (shardRows.length === 0) return;

  const lastShard = shardRows[shardRows.length - 1];
  const decompressed = decompress(lastShard.data);

  let chunk: { queries: unknown[]; dagData: string };
  try {
    chunk = JSON.parse(decompressed);
  } catch {
    // 分片数据损坏，清除并重建
    await db.sessionShards.where('sessionId').equals(sessionId).delete();
    return;
  }

  const chunkSize = byteSize(decompressed);

  if (chunkSize < 5 * 1024 * 1024) {
    // 追加到最后一个分片
    const newData = compress(decompressed);
    await db.sessionShards.update(lastShard.id, { data: newData });
  } else {
    // 创建新分片
    const newShardIndex = shardRows.length;
    const newShardId = `${sessionId}_shard_${String(newShardIndex).padStart(4, '0')}`;
    const newChunk = JSON.stringify({ queries: [], dagData: chunk.dagData });

    await db.sessionShards.put({
      id: newShardId,
      sessionId,
      shardIndex: newShardIndex,
      data: compress(newChunk),
      originalSize: byteSize(newChunk),
      createdAt: Date.now(),
    });

    // 更新会话的分片计数
    await updateSession(sessionId, { shardCount: newShardIndex + 1 });
  }
}

/**
 * 从分片存储加载所有 queries
 */
export async function loadQueriesFromShards(sessionId: string): Promise<DBQuery[]> {
  const shardRows = await db.sessionShards
    .where('sessionId')
    .equals(sessionId)
    .sortBy('shardIndex');

  if (shardRows.length === 0) return [];

  const { reassembleSession: reassemble } = await import('@/utils/sharding');
  const shards = shardRows.map(r => ({
    id: r.id,
    sessionId: r.sessionId,
    shardIndex: r.shardIndex,
    data: r.data,
    originalSize: r.originalSize,
    createdAt: r.createdAt,
  }));

  const result = reassemble(shards);
  if (!result) return [];

  const dagData = JSON.parse(decompress(result.dagData));

  return result.queries.map(q => ({
    id: q.id,
    sessionId,
    question: decompress(q.question),
    answer: decompress(q.answer),
    toolCalls: q.toolCalls.map(tc => ({
      id: tc.id,
      queryId: q.id,
      name: tc.toolName,
      arguments: JSON.parse(decompress(tc.arguments)),
      result: JSON.parse(decompress(tc.result)),
      startTime: tc.startTime,
      endTime: tc.endTime,
      success: tc.status === 'success',
    })),
    dag: dagData,
    tokenUsage: q.tokenUsage,
    duration: q.duration,
    createdAt: q.createdAt,
    status: q.status,
    errorMessage: q.errorMessage,
  }));
}
