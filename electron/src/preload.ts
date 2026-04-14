import { contextBridge, ipcRenderer } from 'electron';

// ── Embedding IPC 通道名 ─────────────────────────────────────
const SCREENSHOT_CH = {
  CAPTURE_WINDOW: 'screenshot:captureWindow',
} as const;

// ── 向量 API 通道名 ─────────────────────────────────────
const EMBED_CH = {
  CALL: 'embedding:call',
} as const;
const CH = {
  INDEX_QUERY:   'vectordb:indexQuery',
  INDEX_TOOL:    'vectordb:indexToolCall',
  SEARCH:        'vectordb:search',
  LIST_TABLES:   'vectordb:listTables',
  TABLE_STATS:   'vectordb:tableStats',
  REBUILD_INDEX: 'vectordb:rebuildIndex',
  CLOSE_DB:      'vectordb:closeDb',
} as const;

// ── 向量 API 桥接（主进程 → 渲染进程） ─────────────────────
contextBridge.exposeInMainWorld('electron', {
  // 原有 API
  getVersion: () => process.env.npm_package_version ?? '1.1.0',

  getClaudePath: () => {
    const { execSync } = require('child_process');
    const command = process.platform === 'win32' ? 'where claude' : 'which claude';
    try {
      const result = execSync(command, { encoding: 'utf-8', shell: true });
      return result.trim().split('\n')[0];
    } catch {
      return null;
    }
  },

  openExternal: (url: string) => {
    const { shell } = require('electron');
    shell.openExternal(url);
  },

  // ── 向量存储 API ─────────────────────────────────────────
  vectorApi: {
    async indexQueryChunk(params: {
      sessionId: string; queryId: string; workspacePath: string;
      content: string; metadata?: Record<string, unknown>;
    }): Promise<string> {
      return ipcRenderer.invoke(CH.INDEX_QUERY, params);
    },

    async indexToolCallChunk(params: {
      sessionId: string; queryId: string; toolCallId: string;
      workspacePath: string; content: string; metadata?: Record<string, unknown>;
    }): Promise<string> {
      return ipcRenderer.invoke(CH.INDEX_TOOL, params);
    },

    async search(params: {
      query: string; workspacePaths: string[];
      type?: string; topK?: number; threshold?: number;
    }): Promise<unknown[]> {
      return ipcRenderer.invoke(CH.SEARCH, params);
    },

    async listTables(): Promise<string[]> {
      return ipcRenderer.invoke(CH.LIST_TABLES);
    },

    async getTableStats(): Promise<unknown> {
      return ipcRenderer.invoke(CH.TABLE_STATS);
    },

    async rebuildIndex(): Promise<void> {
      return ipcRenderer.invoke(CH.REBUILD_INDEX);
    },

    async closeDb(): Promise<void> {
      return ipcRenderer.invoke(CH.CLOSE_DB);
    },
  },

  // ── Embedding HTTP 代理 API（CORS 绕过） ────────────────────
  embeddingApi: {
    async call(params: {
      endpoint: string;
      provider: string;
      apiKey?: string;
      model: string;
      text: string;
    }): Promise<{ success: boolean; vector?: number[]; dimension?: number; error?: string }> {
      return ipcRenderer.invoke(EMBED_CH.CALL, params);
    },
  },

  // V1.4.0: Screenshot capture for UI verification
  captureWindow: async (): Promise<string> => {
    const result = await ipcRenderer.invoke(SCREENSHOT_CH.CAPTURE_WINDOW);
    if (!result.success) {
      throw new Error(result.error ?? 'Screenshot capture failed');
    }
    return result.data;
  },

  // ── 自动更新 API ─────────────────────────────────────────
  updateApi: {
    check: () => ipcRenderer.invoke('update:check'),
    startDownload: () => ipcRenderer.invoke('update:start-download'),
    install: () => ipcRenderer.invoke('update:install'),
    onInit: (cb: (data: { currentVersion: string }) => void) =>
      ipcRenderer.on('update:init', (_e, data) => cb(data)),
    onAvailable: (cb: (info: UpdateInfo) => void) =>
      ipcRenderer.on('update:available', (_e, info) => cb(info)),
    onProgress: (cb: (progress: number) => void) =>
      ipcRenderer.on('update:progress', (_e, p) => cb(p)),
    onDownloaded: (cb: () => void) =>
      ipcRenderer.on('update:downloaded', () => cb()),
    onError: (cb: (msg: string) => void) =>
      ipcRenderer.on('update:error', (_e, msg) => cb(msg)),
  },

  // ── ModelConfig IPC ─────────────────────────────────────────
  invoke: (channel: string, ...args: unknown[]) => {
    const validChannels = [
      'model-config:get-all',
      'model-config:save',
      'model-config:update',
      'model-config:delete',
      'model-config:set-default',
      'workspace-preset:get-all',
      'workspace-preset:save',
      'workspace-preset:update',
      'workspace-preset:delete',
    ];
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    throw new Error(`Invalid channel: ${channel}`);
  },
});

// ── 类型定义 ────────────────────────────────────────────────
interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes: string | null;
  downloadUrl: string;
}
