/// <reference types="vite/client" />

export {}; // 使本文件成为模块，启用 `declare global` 全局增强

// ── Electron IPC Bridge (preload.ts → renderer) ───────────────────────────
type ChunkType = 'query' | 'toolcall';

interface VectorSearchResult {
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
}

interface VectorTableStat {
  name: string;
  count: number;
}

interface VectorTableStats {
  totalChunks: number;
  tables: VectorTableStat[];
}

interface VectorApi {
  indexQueryChunk(params: {
    sessionId: string; queryId: string; workspacePath: string;
    content: string; vector: number[]; metadata?: Record<string, unknown>;
  }): Promise<string>;

  indexToolCallChunk(params: {
    sessionId: string; queryId: string; toolCallId: string;
    workspacePath: string; content: string; vector: number[];
    metadata?: Record<string, unknown>;
  }): Promise<string>;

  search(params: {
    query: string; workspacePaths: string[];
    type?: ChunkType | 'hybrid'; topK?: number; threshold?: number;
    queryVector?: number[];
  }): Promise<VectorSearchResult[]>;

  listTables(): Promise<string[]>;
  getTableStats(): Promise<VectorTableStats>;
  rebuildIndex(): Promise<void>;
  closeDb(): Promise<void>;
}

interface EmbeddingApi {
  call(params: {
    endpoint: string;
    provider: string;
    apiKey?: string;
    model: string;
    text: string;
  }): Promise<{ success: boolean; vector?: number[]; dimension?: number; error?: string }>;
}

interface ElectronAPI {
  getVersion(): Promise<string>;
  getClaudePath(): Promise<string | null>;
  openExternal(url: string): void;
  vectorApi: VectorApi;
  embeddingApi: EmbeddingApi;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
