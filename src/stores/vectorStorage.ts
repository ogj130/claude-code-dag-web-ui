/**
 * LanceDB 向量存储封装（Electron IPC 客户端）
 *
 * 架构说明：
 *   vectordb 是 Node.js 原生模块（Rust FFI），必须在 Electron 主进程中运行。
 *   渲染进程（React）通过 preload.ts 暴露的 IPC 桥接调用主进程的 LanceDB。
 *
 * Vite dev 模式：使用 localVectorStorage（浏览器端 IndexedDB + 余弦相似度）
 *
 * 表结构：
 *   rag_global     — 全量向量（跨工作路径检索用）
 *   rag_{path}     — 单个工作路径的向量
 *
 * IPC 通道：
 *   vectordb:indexQuery   — 索引 Query chunk
 *   vectordb:indexToolCall— 索引 ToolCall chunk
 *   vectordb:search       — 向量相似搜索
 *   vectordb:listTables   — 列出所有表
 *   vectordb:tableStats   — 统计信息
 *   vectordb:rebuildIndex  — 重建全局索引
 *   vectordb:closeDb      — 关闭连接
 */

export type ChunkType = 'query' | 'toolcall' | 'answer' | 'attachment';

export interface VectorChunk {
  id: string;
  vector: number[];
  content: string;
  chunkType: ChunkType;
  sessionId: string;
  queryId: string;
  toolCallId?: string;
  workspacePath: string;
  timestamp: number;
  metadata: Record<string, unknown>;
}

export interface SearchResult {
  id: string;
  score: number;
  content: string;
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

const GLOBAL_TABLE = 'rag_global';

// ── 环境检测：Electron IPC vs 浏览器本地存储 ────────────────────────────────

const isElectron = typeof window !== 'undefined' && !!window.electron?.vectorApi;

function vectorApi() {
  if (!isElectron) {
    throw new Error('LanceDB vectorStorage 仅在 Electron 渲染进程中可用');
  }
  return window.electron.vectorApi;
}

// ── Write operations ──────────────────────────────────────────────────────

/**
 * 索引一条 Query chunk
 * 1. 在渲染进程向量化（调用 embedText）
 * 2. 通过 IPC 发送给主进程存储（Electron）或直接存入 IndexedDB（Vite dev）
 */
export async function indexQueryChunk(
  sessionId: string,
  queryId: string,
  workspacePath: string,
  content: string,
  metadata: Record<string, unknown> = {}
): Promise<string> {
  const { embedText } = await import('@/utils/embedding');
  const vector = await embedText(content);

  if (isElectron) {
    return vectorApi().indexQueryChunk({
      sessionId, queryId, workspacePath, content, vector, metadata,
    });
  } else {
    const local = await import('@/stores/localVectorStorage');
    return local.indexQueryChunk(sessionId, queryId, workspacePath, content, metadata);
  }
}

/**
 * 索引一条 ToolCall chunk
 * 1. 在渲染进程向量化
 * 2. 通过 IPC 存储（Electron）或直接存入 IndexedDB（Vite dev）
 */
export async function indexToolCallChunk(
  sessionId: string,
  queryId: string,
  toolCallId: string,
  workspacePath: string,
  content: string,
  metadata: Record<string, unknown> = {}
): Promise<string> {
  const { embedText } = await import('@/utils/embedding');
  const vector = await embedText(content);

  if (isElectron) {
    return vectorApi().indexToolCallChunk({
      sessionId, queryId, toolCallId, workspacePath, content, vector, metadata,
    });
  } else {
    const local = await import('@/stores/localVectorStorage');
    return local.indexToolCallChunk(sessionId, queryId, toolCallId, workspacePath, content, metadata);
  }
}

/**
 * 索引 Answer 内容（分块后批量向量化）
 * 仅在 Vite dev 模式下可用（Electron IPC 端暂不支持）
 */
export async function indexAnswerChunks(
  sessionId: string,
  queryId: string,
  workspacePath: string,
  answer: string,
  metadata: Record<string, unknown> = {}
): Promise<string[]> {
  if (isElectron) {
    console.warn('[vectorStorage] indexAnswerChunks not yet implemented for Electron IPC');
    return [];
  } else {
    const local = await import('@/stores/localVectorStorage');
    return local.indexAnswerChunks(sessionId, queryId, workspacePath, answer, metadata);
  }
}

/**
 * V1.4.1: 索引附件文档（自动切分、向量化、入库）
 * 仅在 Vite dev 模式下可用
 */
export async function indexAttachmentChunks(
  attachmentId: string,
  fileName: string,
  mimeType: string,
  textContent: string,
  workspacePath: string,
  sessionId: string,
): Promise<string[]> {
  if (isElectron) {
    console.warn('[vectorStorage] indexAttachmentChunks not yet implemented for Electron IPC');
    return [];
  } else {
    const local = await import('@/stores/localVectorStorage');
    return local.indexAttachmentChunks(attachmentId, fileName, mimeType, textContent, workspacePath, sessionId);
  }
}

// ── Search ─────────────────────────────────────────────────────────────────

/**
 * 向量相似搜索（RAG 检索入口）
 *
 * 流程：
 *   1. 在渲染进程向量化查询文本
 *   2. 通过 IPC 发送向量到主进程（Electron）或本地余弦搜索（Vite dev）
 *   3. LanceDB ANN 搜索 或 浏览器端余弦相似度
 *   4. 返回相似 chunk 列表
 */
export async function search(
  query: string,
  options: SearchOptions
): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  if (!options.workspacePaths.length) return [];

  const { embedText } = await import('@/utils/embedding');
  const queryVector = await embedText(query);

  if (isElectron) {
    const rawResults = await vectorApi().search({
      query,
      workspacePaths: options.workspacePaths,
      type: options.type as 'query' | 'toolcall' | 'hybrid',
      topK: options.topK ?? 10,
      threshold: options.threshold ?? 0.5,
      queryVector,
    }) as SearchResult[];
    return rawResults.slice(0, options.topK ?? 10);
  } else {
    const local = await import('@/stores/localVectorStorage');
    return local.search(query, options);
  }
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

  if (isElectron) {
    const rawResults = await vectorApi().search({
      query: '',
      workspacePaths: options.workspacePaths,
      type: options.type as 'query' | 'toolcall' | 'hybrid',
      topK: options.topK ?? 10,
      threshold: options.threshold ?? 0.5,
      queryVector,
    }) as SearchResult[];
    return rawResults.slice(0, options.topK ?? 10);
  } else {
    const local = await import('@/stores/localVectorStorage');
    return local.searchWithVector(queryVector, options);
  }
}

// ── Admin operations ───────────────────────────────────────────────────────

/** 列出所有向量表名 */
export async function listTables(): Promise<string[]> {
  if (isElectron) {
    return vectorApi().listTables();
  } else {
    const local = await import('@/stores/localVectorStorage');
    return local.listTables();
  }
}

/** 获取统计信息 */
export async function getTableStats(): Promise<TableStats> {
  if (isElectron) {
    return vectorApi().getTableStats() as Promise<TableStats>;
  } else {
    const local = await import('@/stores/localVectorStorage');
    return local.getTableStats();
  }
}

/** 重建全局索引（删除后重建） */
export async function rebuildIndex(): Promise<void> {
  if (isElectron) {
    return vectorApi().rebuildIndex();
  } else {
    const local = await import('@/stores/localVectorStorage');
    return local.rebuildIndex();
  }
}

/** 关闭连接（用于清理） */
export async function closeDb(): Promise<void> {
  if (isElectron) {
    return vectorApi().closeDb();
  } else {
    const local = await import('@/stores/localVectorStorage');
    return local.closeDb();
  }
}

// ── 兼容性导出 ─────────────────────────────────────────────────────────────
export { GLOBAL_TABLE };
