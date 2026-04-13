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

export type ChunkType = 'query' | 'toolcall' | 'answer' | 'attachment';

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
  /** V1.4.1: 附件元数据 */
  fileName?: string;
  mimeType?: string;
  attachmentId?: string;
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
  /** V1.4.1: 附件元数据 */
  fileName?: string;
  mimeType?: string;
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
    this.version(10).stores({
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

/**
 * V1.4.1: 索引附件文档（自动切分、向量化、入库）
 * @param attachmentId  附件 ID
 * @param fileName     文件名
 * @param mimeType     MIME 类型
 * @param textContent  文档纯文本内容
 * @param workspacePath 工作路径
 * @param sessionId    会话 ID
 */
export async function indexAttachmentChunks(
  attachmentId: string,
  fileName: string,
  mimeType: string,
  textContent: string,
  workspacePath: string,
  sessionId: string,
): Promise<string[]> {
  const config = await _getDefaultConfig();
  if (!config) {
    console.warn('[VectorStorage] No embedding config, skipping attachment indexing');
    return [];
  }

  // 按段落切分文档内容
  const chunks = _chunkAttachmentText(textContent, attachmentId, fileName, mimeType, workspacePath, sessionId);
  if (chunks.length === 0) return [];

  // 批量向量化
  const texts = chunks.map(c => c.content);
  const vectors = await computeEmbeddings(texts, config);

  // 写入 IndexedDB
  const ids: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    chunks[i].vector = vectors[i];
    const id = await _db.chunks.add(chunks[i] as VectorChunk);
    ids.push(String(id));
  }

  console.log(`[VectorStorage] Indexed ${ids.length} attachment chunks for ${fileName}`);
  return ids;
}

/**
 * 将附件文本切分为多个 chunk
 */
function _chunkAttachmentText(
  text: string,
  attachmentId: string,
  fileName: string,
  mimeType: string,
  workspacePath: string,
  sessionId: string,
): Array<VectorChunk & { attachmentId: string }> {
  const chunks: Array<VectorChunk & { attachmentId: string }> = [];
  const paragraphs = splitByParagraphs(text);
  let current = '';

  for (const para of paragraphs) {
    if (para.length <= MAX_CHUNK_SIZE) {
      if (para.trim().length >= MIN_CHUNK_SIZE) {
        chunks.push(_makeAttachmentChunk(para.trim(), attachmentId, fileName, mimeType, workspacePath, sessionId));
      }
      continue;
    }

    // 超长段落按句子拆分
    const sentences = splitBySentences(para);
    for (const s of sentences) {
      if (current.length + s.length <= MAX_CHUNK_SIZE) {
        current += s;
      } else {
        if (current.length >= MIN_CHUNK_SIZE) {
          chunks.push(_makeAttachmentChunk(current.trim(), attachmentId, fileName, mimeType, workspacePath, sessionId));
        }
        current = s;
      }
    }
  }

  if (current.length >= MIN_CHUNK_SIZE) {
    chunks.push(_makeAttachmentChunk(current.trim(), attachmentId, fileName, mimeType, workspacePath, sessionId));
  }

  return chunks;
}

function _makeAttachmentChunk(
  content: string,
  attachmentId: string,
  fileName: string,
  mimeType: string,
  workspacePath: string,
  sessionId: string,
): VectorChunk & { attachmentId: string } {
  return {
    content,
    chunkType: 'attachment',
    attachmentId,
    fileName,
    mimeType,
    sessionId,
    queryId: attachmentId, // 复用 queryId 字段
    workspacePath,
    timestamp: Date.now(),
    metadata: { fileName, mimeType, attachmentId },
    vector: [], // 向量稍后填充
  };
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
    fileName: (c as Record<string, unknown>)['fileName'] as string | undefined,
    mimeType: (c as Record<string, unknown>)['mimeType'] as string | undefined,
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
    fileName: (c as Record<string, unknown>)['fileName'] as string | undefined,
    mimeType: (c as Record<string, unknown>)['mimeType'] as string | undefined,
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

  let indexedCount = 0; // 总 chunk 数（query + answer）
  let answerChunkCount = 0;
  for (const q of queries) {
    // 用 getQuery 解密+解压缩，获取原始文本
    const fullQuery = await getQuery(q.id);
    if (!fullQuery?.query) continue;
    try {
      // 索引 Query chunk
      await indexQueryChunk(sessionId, q.id, workspacePath, fullQuery.query, {
        sessionTitle: (q as { sessionTitle?: string }).sessionTitle,
      });
      indexedCount++;

      // 索引 Answer chunk（如果有）
      if (fullQuery.summary) {
        const ids = await indexAnswerChunks(sessionId, q.id, workspacePath, fullQuery.summary, {
          sessionTitle: (q as { sessionTitle?: string }).sessionTitle,
          parentQuery: fullQuery.query,
        });
        answerChunkCount += ids.length;
        indexedCount += ids.length;
      }
    } catch {
      // 跳过向量化失败的单条
    }
  }

  console.info(`[VectorStorage] Indexed session ${sessionId}: ${indexedCount - answerChunkCount} queries + ${answerChunkCount} answer chunks`);
  return indexedCount;
}

// ── 索引状态管理（持久化）──────────────────────────────────────────────────

// 索引状态按工作路径组织，同一工作路径下的所有会话共享一个索引记录
interface IndexedWorkspace {
  workspacePath: string;
  indexedAt: number;
  chunkCount: number; // 该工作路径下的总 chunk 数
  sessionCount: number; // 已索引的会话数
}

const INDEX_STATE_KEY = 'rag_indexed_workspaces';

function _getIndexedWorkspaces(): IndexedWorkspace[] {
  try {
    const raw = localStorage.getItem(INDEX_STATE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function _saveIndexedWorkspaces(workspaces: IndexedWorkspace[]): void {
  localStorage.setItem(INDEX_STATE_KEY, JSON.stringify(workspaces));
}

export function getIndexedSessions(): Array<{
  sessionId: string;
  workspacePath: string;
  indexedAt: number;
  queryCount: number;
}> {
  // 兼容旧接口：返回空数组，UI 使用 getIndexedWorkspaces
  return [];
}

export function getIndexedWorkspaces(): IndexedWorkspace[] {
  return _getIndexedWorkspaces();
}

/**
 * 标记工作路径已索引（合并更新）
 */
export function markWorkspaceIndexed(workspacePath: string, chunkCount: number, sessionCount: number): void {
  const workspaces = _getIndexedWorkspaces().filter(w => w.workspacePath !== workspacePath);
  workspaces.push({ workspacePath, indexedAt: Date.now(), chunkCount, sessionCount });
  _saveIndexedWorkspaces(workspaces);
}

/**
 * 同步指定工作路径下的所有会话到向量库
 *
 * 1. 获取该工作路径的所有会话
 * 2. 遍历每个会话，索引其 query 和 answer chunks
 * 3. 汇总 chunk 数，标记工作路径为已索引
 */
export async function syncWorkspaceToVector(workspacePath: string): Promise<number> {
  const { db } = await import('@/lib/db');

  // 获取该工作路径的所有会话
  const sessions = await db.sessions.toArray();
  const pathSessions = sessions.filter(s => (s.projectPath || 'Default') === workspacePath);

  if (pathSessions.length === 0) {
    console.info(`[VectorStorage] No sessions found for workspace: ${workspacePath}`);
    return 0;
  }

  let totalChunks = 0;
  let indexedSessionCount = 0;

  for (const session of pathSessions) {
    const count = await syncSessionToVector(session.id, workspacePath);
    if (count > 0) {
      totalChunks += count;
      indexedSessionCount++;
    }
  }

  // 标记工作路径为已索引
  if (totalChunks > 0) {
    markWorkspaceIndexed(workspacePath, totalChunks, indexedSessionCount);
    console.info(`[VectorStorage] Indexed workspace ${workspacePath}: ${indexedSessionCount} sessions, ${totalChunks} chunks`);
  }

  return totalChunks;
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
