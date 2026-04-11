/**
 * LocalVectorStorage — 浏览器端向量存储（IndexedDB）
 *
 * 在 Vite dev / 非 Electron 环境下替代 LanceDB 提供：
 *   - 向量存储（IndexedDB）
 *   - 余弦相似度搜索（纯 JS 实现）
 *
 * 表结构同 LanceDB：
 *   rag_global     — 全量向量（跨工作路径检索用）
 *   rag_{path}     — 单个工作路径的向量（暂未使用，统一走 rag_global）
 *
 * 使用 Dexie.js（同 db.ts）保证 IndexedDB 操作一致性。
 */

import Dexie, { type Table } from 'dexie';
import { computeEmbeddings } from '@/utils/embeddingService';
import type { EmbeddingConfig } from '@/stores/embeddingConfigStorage';
import type { QueryRecord } from '@/lib/db';

// Answer 分块常量
const MAX_CHUNK_SIZE = 1000;  // 最大 chunk 长度
const MIN_CHUNK_SIZE = 100;   // 最小 chunk 长度

// ── 类型 ────────────────────────────────────────────────────────────────────

export type ChunkType = 'query' | 'toolcall' | 'answer';

export interface VectorChunk {
  id?: number;          // 自动递增主键
  content: string;
  vector: number[];
  chunkType: ChunkType;
  sessionId: string;
  queryId: string;
  toolCallId?: string;
  workspacePath: string;
  timestamp: number;
  metadata: Record<string, unknown>;
}

// Answer chunk 扩展类型（用于类型标注）
export type AnswerChunkData = {
  chunkType: 'answer';
  answerId: string;
  chunkIndex: number;
  parentQuery: string;
};

export interface SearchResult {
  id: string;
  score: number;
  content: string;
  chunkType: ChunkType;
  sessionId: string;
  queryId: string;
  toolCallId?: string;
  answerId?: string;
  chunkIndex?: number;
  parentQuery?: string;
  workspacePath: string;
  timestamp: number;
  metadata: Record<string, unknown>;
}

export interface SearchOptions {
  workspacePaths: string[];
  type?: ChunkType | 'hybrid';
  topK?: number;
  threshold?: number;
}

export interface TableStats {
  totalChunks: number;
  tables: Array<{ name: string; count: number }>;
}

// ── IndexedDB 表 ─────────────────────────────────────────────────────────────

class VectorDB extends Dexie {
  chunks!: Table<VectorChunk & { id?: number }, number>;

  constructor() {
    super('cc-web-vector');
    this.version(1).stores({
      chunks: '++id, chunkType, sessionId, queryId, workspacePath, timestamp',
    });
  }
}

const _db = new VectorDB();

// ── 向量工具 ────────────────────────────────────────────────────────────────

/** 计算余弦相似度 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * 按 Markdown 段落分隔文本
 */
function splitByParagraphs(text: string): string[] {
  // 按 ## 标题或双换行分隔
  const paragraphs = text.split(/(?=^#{1,6}\s)/m);
  return paragraphs.filter(p => p.trim().length > 0);
}

/**
 * 按句子分隔文本
 */
function splitBySentences(text: string): string[] {
  // 按中文/英文句子结束符分隔
  return text.split(/(?<=[。！？.!?])\s*/).filter(s => s.trim().length > 0);
}

// ── 索引操作 ────────────────────────────────────────────────────────────────

/**
 * 索引一条 Query chunk
 */
export async function indexQueryChunk(
  sessionId: string,
  queryId: string,
  workspacePath: string,
  content: string,
  metadata: Record<string, unknown> = {}
): Promise<string> {
  const config = await _getDefaultConfig();
  if (!config) throw new Error('未配置 embedding');
  const [vector] = await computeEmbeddings([content], config);
  const id = await _db.chunks.add({
    content,
    vector,
    chunkType: 'query',
    sessionId,
    queryId,
    workspacePath,
    timestamp: Date.now(),
    metadata,
  });
  return String(id);
}

/**
 * 索引一条 ToolCall chunk
 */
export async function indexToolCallChunk(
  sessionId: string,
  queryId: string,
  toolCallId: string,
  workspacePath: string,
  content: string,
  metadata: Record<string, unknown> = {}
): Promise<string> {
  const config = await _getDefaultConfig();
  if (!config) throw new Error('未配置 embedding');
  const [vector] = await computeEmbeddings([content], config);
  const id = await _db.chunks.add({
    content,
    vector,
    chunkType: 'toolcall',
    sessionId,
    queryId,
    toolCallId,
    workspacePath,
    timestamp: Date.now(),
    metadata,
  });
  return String(id);
}

/**
 * 将 Answer 文本分块
 */
function chunkContent(
  content: string,
  sessionId: string,
  queryId: string,
  workspacePath: string,
  metadata: Record<string, unknown>
): Array<VectorChunk & { answerId: string; chunkIndex: number; parentQuery: string }> {
  const chunks: Array<VectorChunk & { answerId: string; chunkIndex: number; parentQuery: string }> = [];
  const answerId = `answer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const parentQuery = (metadata.parentQuery as string) || '';

  const paragraphs = splitByParagraphs(content);
  let chunkIndex = 0;

  for (const paragraph of paragraphs) {
    if (paragraph.length <= MAX_CHUNK_SIZE) {
      if (paragraph.length >= MIN_CHUNK_SIZE) {
        chunks.push({
          content: paragraph.trim(),
          chunkType: 'answer',
          sessionId,
          queryId,
          answerId,
          chunkIndex: chunkIndex++,
          workspacePath,
          timestamp: Date.now(),
          metadata,
          parentQuery,
          vector: [], // 向量稍后填充
        });
      }
      continue;
    }

    // 长段落按句子分
    const sentences = splitBySentences(paragraph);
    let currentChunk = '';

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length <= MAX_CHUNK_SIZE) {
        currentChunk += sentence;
      } else {
        if (currentChunk.length >= MIN_CHUNK_SIZE) {
          chunks.push({
            content: currentChunk.trim(),
            chunkType: 'answer',
            sessionId,
            queryId,
            answerId,
            chunkIndex: chunkIndex++,
            workspacePath,
            timestamp: Date.now(),
            metadata,
            parentQuery,
            vector: [],
          });
        }
        currentChunk = sentence;
      }
    }

    if (currentChunk.length >= MIN_CHUNK_SIZE) {
      chunks.push({
        content: currentChunk.trim(),
        chunkType: 'answer',
        sessionId,
        queryId,
        answerId,
        chunkIndex: chunkIndex++,
        workspacePath,
        timestamp: Date.now(),
        metadata,
        parentQuery,
        vector: [],
      });
    }
  }

  return chunks;
}

/**
 * 索引 Answer 内容（分块后批量向量化）
 */
export async function indexAnswerChunks(
  sessionId: string,
  queryId: string,
  workspacePath: string,
  answer: string,
  metadata: Record<string, unknown> = {}
): Promise<string[]> {
  const config = await _getDefaultConfig();
  if (!config) {
    console.warn('[VectorStorage] No embedding config, skipping answer indexing');
    return [];
  }

  // 分块
  const chunks = chunkContent(answer, sessionId, queryId, workspacePath, {
    ...metadata,
    chunkType: 'answer',
  });

  if (chunks.length === 0) {
    return [];
  }

  // 批量向量化
  const texts = chunks.map(c => c.content);
  const vectors = await computeEmbeddings(texts, config);

  // 存入 IndexedDB
  const ids: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    chunks[i].vector = vectors[i];
    const id = await _db.chunks.add(chunks[i] as VectorChunk);
    ids.push(String(id));
  }

  console.log(`[VectorStorage] Indexed ${ids.length} answer chunks for query ${queryId}`);
  return ids;
}

// ── 搜索 ───────────────────────────────────────────────────────────────────

/**
 * 向量相似搜索（RAG 检索入口）
 *
 * 流程：
 *   1. 向量化查询文本（调用 embeddingService）
 *   2. 浏览器端余弦相似度搜索
 *   3. 返回相似 chunk 列表
 */
export async function search(
  query: string,
  options: SearchOptions
): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  if (!options.workspacePaths.length) return [];

  const config = await _getDefaultConfig();
  if (!config) throw new Error('未配置 embedding，请先在设置中添加配置');

  // 1. 向量化查询
  const [queryVector] = await computeEmbeddings([query], config);

  // 2. 从 IndexedDB 加载所有相关 chunk（按工作路径筛选）
  const allChunks = await _db.chunks
    .where('workspacePath')
    .anyOf(options.workspacePaths)
    .toArray();

  // 3. 类型过滤
  const filtered = options.type && options.type !== 'hybrid'
    ? allChunks.filter(c => c.chunkType === options.type)
    : allChunks;

  // 4. 余弦相似度计算
  const scored = filtered
    .map(chunk => ({
      ...chunk,
      score: cosineSimilarity(queryVector, chunk.vector),
    }))
    .filter(c => c.score >= (options.threshold ?? 0));

  // 5. 降序排列，取 topK
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, options.topK ?? 10);

  return top.map(c => ({
    id: String(c.id),
    score: c.score,
    content: c.content,
    chunkType: c.chunkType,
    sessionId: c.sessionId,
    queryId: c.queryId,
    toolCallId: c.toolCallId,
    answerId: (c as Record<string, unknown>)['answerId'] as string | undefined,
    chunkIndex: (c as Record<string, unknown>)['chunkIndex'] as number | undefined,
    parentQuery: (c as Record<string, unknown>)['parentQuery'] as string | undefined,
    workspacePath: c.workspacePath,
    timestamp: c.timestamp,
    metadata: c.metadata ?? {},
  }));
}

/**
 * 直接使用已有向量搜索（避免重复向量化）
 */
export async function searchWithVector(
  queryVector: number[],
  options: SearchOptions
): Promise<SearchResult[]> {
  if (!queryVector.length) return [];
  if (!options.workspacePaths.length) return [];

  const allChunks = await _db.chunks
    .where('workspacePath')
    .anyOf(options.workspacePaths)
    .toArray();

  const filtered = options.type && options.type !== 'hybrid'
    ? allChunks.filter(c => c.chunkType === options.type)
    : allChunks;

  const scored = filtered
    .map(chunk => ({ ...chunk, score: cosineSimilarity(queryVector, chunk.vector) }))
    .filter(c => c.score >= (options.threshold ?? 0));

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, options.topK ?? 10);

  return top.map(c => ({
    id: String(c.id),
    score: c.score,
    content: c.content,
    chunkType: c.chunkType,
    sessionId: c.sessionId,
    queryId: c.queryId,
    toolCallId: c.toolCallId,
    answerId: (c as Record<string, unknown>)['answerId'] as string | undefined,
    chunkIndex: (c as Record<string, unknown>)['chunkIndex'] as number | undefined,
    parentQuery: (c as Record<string, unknown>)['parentQuery'] as string | undefined,
    workspacePath: c.workspacePath,
    timestamp: c.timestamp,
    metadata: c.metadata ?? {},
  }));
}

// ── 管理操作 ────────────────────────────────────────────────────────────────

/** 获取统计信息 */
export async function getTableStats(): Promise<TableStats> {
  const totalChunks = await _db.chunks.count();
  const allChunks = await _db.chunks.toArray();
  const byType = allChunks.reduce<Record<string, number>>((acc, c) => {
    acc[c.chunkType] = (acc[c.chunkType] ?? 0) + 1;
    return acc;
  }, {});
  return {
    totalChunks,
    tables: [
      { name: 'rag_global', count: totalChunks },
      ...Object.entries(byType).map(([key, count]) => ({ name: `type:${key}`, count })),
    ],
  };
}

/** 列出所有向量表名 */
export async function listTables(): Promise<string[]> {
  const allChunks = await _db.chunks.toArray();
  const types = [...new Set(allChunks.map(c => c.chunkType))];
  return ['rag_global', ...types.map(t => `rag_type_${t}`)];
}

/** 重建索引（删除后重建 = 清空） */
export async function rebuildIndex(): Promise<void> {
  await _db.chunks.clear();
}

/** 关闭连接（IndexedDB 无需关闭，保持单例） */
export async function closeDb(): Promise<void> {
  // IndexedDB 是持久化存储，无需关闭
}

// ── 从已有数据同步（Vite dev 模式下将历史会话导入向量库） ──────────────────

/**
 * 将指定会话的所有 Query 文本同步到向量库
 * 调用时会从 IndexedDB 的 queries 表读取数据并向量化存储
 */
export async function syncSessionToVector(sessionId: string, workspacePath: string): Promise<number> {
  const { db } = await import('@/lib/db');
  const { getQuery } = await import('@/stores/queryStorage');
  const queries = await db.queries.where('sessionId').equals(sessionId).toArray() as QueryRecord[];

  let count = 0;
  for (const q of queries) {
    // 用 getQuery 解密+解压缩，获取原始文本
    const fullQuery = await getQuery(q.id);
    if (!fullQuery?.query) continue;
    try {
      await indexQueryChunk(sessionId, q.id, workspacePath, fullQuery.query, {
        sessionTitle: (q as { sessionTitle?: string }).sessionTitle,
      });
      count++;
    } catch {
      // 跳过向量化失败的单条
    }
  }

  // 标记该会话已索引
  if (count > 0) {
    markSessionIndexed(sessionId, workspacePath, count);
  }
  return count;
}

// ── 索引状态管理（持久化） ──────────────────────────────────────────────────

interface IndexedSession {
  sessionId: string;
  workspacePath: string;
  indexedAt: number;
  queryCount: number;
}

const INDEX_STATE_KEY = 'rag_indexed_sessions';

function _getIndexedSessions(): IndexedSession[] {
  try {
    const raw = localStorage.getItem(INDEX_STATE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function _saveIndexedSessions(sessions: IndexedSession[]): void {
  localStorage.setItem(INDEX_STATE_KEY, JSON.stringify(sessions));
}

export function getIndexedSessions(): IndexedSession[] {
  return _getIndexedSessions();
}

export function markSessionIndexed(sessionId: string, workspacePath: string, queryCount: number): void {
  const sessions = _getIndexedSessions().filter(s => s.sessionId !== sessionId);
  sessions.push({ sessionId, workspacePath, indexedAt: Date.now(), queryCount });
  _saveIndexedSessions(sessions);
}

// ── 内部 ──────────────────────────────────────────────────────────────────

let _configCache: EmbeddingConfig | null = null;
let _configCacheAt = 0;
const CONFIG_CACHE_TTL = 60_000; // 1 分钟缓存

async function _getDefaultConfig(): Promise<EmbeddingConfig | null> {
  if (_configCache && Date.now() - _configCacheAt < CONFIG_CACHE_TTL) {
    return _configCache;
  }
  const { getDefaultConfig } = await import('@/stores/embeddingConfigStorage');
  _configCache = await getDefaultConfig() ?? null;
  _configCacheAt = Date.now();
  return _configCache;
}
