import { app, BrowserWindow, ipcMain, shell, desktopCapturer } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import * as http from 'http';
import * as fs from 'fs';
import * as net from 'net';
import { WebSocketServer } from 'ws';
// vectordb 是 Node.js 原生模块，使用动态 import 惰性加载，避免顶层导入崩溃
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LanceDB = any;

// ── 版本信息 ──────────────────────────────────────────────
const DEFAULT_FRONTEND_PORT = 5400;
const DEFAULT_WS_PORT = 5300;

// ── LanceDB 单例 ────────────────────────────────────────────
const GLOBAL_TABLE = 'rag_global';

let _db: LanceDB | null = null;
let _lancedb: LanceDB | null = null;

async function getLanceDb(): Promise<LanceDB> {
  if (!_lancedb) {
    _lancedb = await import('vectordb');
  }
  return _lancedb;
}

async function getDb() {
  if (_db) return _db;
  const ldb = await getLanceDb();
  _db = await ldb.connect('.lancedb');
  return _db;
}

function sanitizeTableName(p: string): string {
  return p.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 56);
}

function workspaceTableName(workspacePath: string): string {
  return `rag_${sanitizeTableName(workspacePath)}`;
}

async function getOrCreateTable(name: string) {
  const db = await getDb();
  try {
    return await db.openTable(name);
  } catch {
    // 表不存在，创建新表
    const tbl = await db.createTable({ name, data: [] });
    return tbl;
  }
}

// cosine distance → similarity score
function distanceToScore(distance: number): number {
  return 1 / (1 + distance);
}

// ── LanceDB IPC 处理器 ──────────────────────────────────────
function registerVectorHandlers() {
  ipcMain.handle('vectordb:indexQuery', async (_event, params: {
    sessionId: string; queryId: string; workspacePath: string;
    content: string; vector: number[]; metadata?: Record<string, unknown>;
  }) => {
    const id = `q_${params.queryId}`;
    const row = {
      id,
      vector: params.vector,
      content: params.content,
      chunkType: 'query',
      sessionId: params.sessionId,
      queryId: params.queryId,
      toolCallId: '',
      workspacePath: params.workspacePath,
      timestamp: Date.now(),
      metadata: JSON.stringify(params.metadata ?? {}),
    };
    await Promise.all([
      getOrCreateTable(GLOBAL_TABLE).then(t => t.add([row])),
      getOrCreateTable(workspaceTableName(params.workspacePath)).then(t => t.add([row])),
    ]);
    return id;
  });

  ipcMain.handle('vectordb:indexToolCall', async (_event, params: {
    sessionId: string; queryId: string; toolCallId: string;
    workspacePath: string; content: string; vector: number[];
    metadata?: Record<string, unknown>;
  }) => {
    const id = `tc_${params.toolCallId}`;
    const row = {
      id,
      vector: params.vector,
      content: params.content,
      chunkType: 'toolcall',
      sessionId: params.sessionId,
      queryId: params.queryId,
      toolCallId: params.toolCallId,
      workspacePath: params.workspacePath,
      timestamp: Date.now(),
      metadata: JSON.stringify(params.metadata ?? {}),
    };
    await Promise.all([
      getOrCreateTable(GLOBAL_TABLE).then(t => t.add([row])),
      getOrCreateTable(workspaceTableName(params.workspacePath)).then(t => t.add([row])),
    ]);
    return id;
  });

  ipcMain.handle('vectordb:search', async (_event, params: {
    query: string; workspacePaths: string[];
    type?: string; topK?: number; threshold?: number; queryVector?: number[];
  }) => {
    const topK = params.topK ?? 10;
    const threshold = params.threshold ?? 0.5;
    const db = await getDb();
    const results: unknown[] = [];

    const tableNames = [GLOBAL_TABLE, ...params.workspacePaths.map(workspaceTableName)];

    for (const name of tableNames) {
      try {
        const tbl = await db.openTable(name);
        let query = tbl.search(params.queryVector ?? ([] as number[]));
        if (params.type && params.type !== 'hybrid') {
          query = query.where(`chunkType = '${params.type}'`);
        }
        const rows = await query.limit(Math.min(topK, 100)).execute() as Array<{
          id: string; content: string; chunkType: string;
          sessionId: string; queryId: string; toolCallId: string;
          workspacePath: string; timestamp: number; metadata: string;
          _distance?: number;
        }>;
        for (const row of rows) {
          const score = row._distance !== undefined ? distanceToScore(row._distance) : 0.8;
          if (score < threshold) continue;
          results.push({
            id: row.id,
            score,
            content: row.content,
            chunkType: row.chunkType,
            sessionId: row.sessionId,
            queryId: row.queryId,
            toolCallId: row.toolCallId || undefined,
            workspacePath: row.workspacePath,
            timestamp: row.timestamp,
            metadata: JSON.parse(row.metadata || '{}'),
          });
        }
      } catch {
        // 表不存在则跳过
      }
    }
    return (results as { score: number }[]).sort((a, b) => b.score - a.score).slice(0, topK);
  });

  ipcMain.handle('vectordb:listTables', async () => {
    try {
      const db = await getDb();
      const names = await db.tableNames();
      return names.filter((n: string) => n.startsWith('rag_'));
    } catch {
      return [];
    }
  });

  ipcMain.handle('vectordb:tableStats', async () => {
    try {
      const db = await getDb();
      const names = await db.tableNames();
      const ragTables = names.filter((n: string) => n.startsWith('rag_'));
      const tables: { name: string; count: number }[] = [];
      let totalChunks = 0;
      for (const name of ragTables) {
        try {
          const tbl = await db.openTable(name);
          const count = await tbl.countRows();
          tables.push({ name, count });
          totalChunks += count;
        } catch { /* skip */ }
      }
      return { totalChunks, tables };
    } catch {
      return { totalChunks: 0, tables: [] };
    }
  });

  ipcMain.handle('vectordb:rebuildIndex', async () => {
    const db = await getDb();
    try { await db.dropTable(GLOBAL_TABLE); } catch { /* ignore */ }
    await db.createTable({ name: GLOBAL_TABLE, data: [] });
  });

  ipcMain.handle('vectordb:closeDb', async () => {
    _db = null;
  });
}

// ── ModelConfig IPC 处理器 ───────────────────────────────────
function registerModelConfigHandlers() {
  ipcMain.handle('model-config:get-all', async () => {
    const { getAllConfigs } = await import('../../src/stores/modelConfigStorage');
    return getAllConfigs();
  });

  ipcMain.handle('model-config:save', async (_event, config) => {
    const { saveConfig } = await import('../../src/stores/modelConfigStorage');
    return saveConfig(config);
  });

  ipcMain.handle('model-config:update', async (_event, id: string, updates) => {
    const { updateConfig } = await import('../../src/stores/modelConfigStorage');
    await updateConfig(id, updates);
    return { success: true };
  });

  ipcMain.handle('model-config:delete', async (_event, id: string) => {
    const { deleteConfig } = await import('../../src/stores/modelConfigStorage');
    const { invalidatePresetByConfigId } = await import('../../src/stores/workspacePresetStorage');
    await invalidatePresetByConfigId(id);
    await deleteConfig(id);
    return { success: true };
  });

  ipcMain.handle('model-config:set-default', async (_event, id: string) => {
    const { setDefaultConfig } = await import('../../src/stores/modelConfigStorage');
    await setDefaultConfig(id);
    return { success: true };
  });
}

// ── WorkspacePreset IPC 处理器 ───────────────────────────────
function registerWorkspacePresetHandlers() {
  ipcMain.handle('workspace-preset:get-all', async () => {
    const { getAllPresets } = await import('../../src/stores/workspacePresetStorage');
    return getAllPresets();
  });

  ipcMain.handle('workspace-preset:save', async (_event, preset) => {
    const { savePreset } = await import('../../src/stores/workspacePresetStorage');
    return savePreset(preset);
  });

  ipcMain.handle('workspace-preset:update', async (_event, id: string, updates) => {
    const { updatePreset } = await import('../../src/stores/workspacePresetStorage');
    await updatePreset(id, updates);
    return { success: true };
  });

  ipcMain.handle('workspace-preset:delete', async (_event, id: string) => {
    const { deletePreset } = await import('../../src/stores/workspacePresetStorage');
    await deletePreset(id);
    return { success: true };
  });

  ipcMain.handle('workspace-preset:get-by-path', async (_event, path: string) => {
    const { getPresetByPath } = await import('../../src/stores/workspacePresetStorage');
    return getPresetByPath(path);
  });
}

// ── Embedding IPC 处理器 ─────────────────────────────────────
// 通过主进程代理 HTTP 请求，彻底绕过浏览器 CORS 限制
// 使用 OpenAI SDK 处理各 Provider 的 embedding 请求
import OpenAI from 'openai';

function registerEmbeddingHandlers() {
  ipcMain.handle('embedding:call', async (_event, params: {
    endpoint: string;
    provider: string;
    apiKey?: string;
    model: string;
    text: string;
  }) => {
    const { endpoint, apiKey, model, text, provider } = params;

    try {
      const baseURL = provider === 'ollama'
        ? `${endpoint}/v1`
        : endpoint;

      const client = new OpenAI({
        apiKey: apiKey ?? 'unused',
        baseURL,
      });

      let vector: number[];
      let dimension = 0;

      if (provider === 'ollama') {
        // Ollama 不支持批量，逐条调用
        const response = await client.embeddings.create({
          input: text,
          model,
        });
        vector = response.data[0].embedding as number[];
      } else if (provider === 'cohere') {
        const response = await client.embeddings.create({
          input: [text],
          model,
        });
        vector = response.data[0].embedding as number[];
      } else {
        // openai / local / default — OpenAI 兼容格式
        const response = await client.embeddings.create({
          input: [text],
          model,
          encoding_format: 'float',
        });
        vector = response.data[0].embedding as number[];
      }

      dimension = vector.length;
      return { success: true, vector, dimension };
    } catch (err: unknown) {
      const e = err as { message?: string; status?: number };
      return {
        success: false,
        error: e.message ?? String(err),
      };
    }
  });
}

// ── V1.4.0: 截图捕获（UI 对比验证用）─────────────────────────
function registerScreenshotHandlers() {
  ipcMain.handle('screenshot:captureWindow', async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['window'],
        thumbnailSize: { width: 1920, height: 1080 },
      });

      // 找到当前窗口
      const currentWindow = BrowserWindow.getFocusedWindow();
      if (!currentWindow) {
        return { success: false, error: 'No focused window' };
      }

      const windowTitle = currentWindow.getTitle();
      const source = sources.find((s) => s.name === windowTitle) || sources[0];

      if (!source) {
        return { success: false, error: 'No window source found' };
      }

      // 返回 base64 PNG
      return { success: true, data: source.thumbnail.toDataURL() };
    } catch (err: unknown) {
      const e = err as { message?: string };
      return { success: false, error: e.message ?? String(err) };
    }
  });
}

// ── 全局引用 ──────────────────────────────────────────────
let mainWindow: BrowserWindow | null = null;

// ── 端口检测工具 ─────────────────────────────────────────

/**
 * 检测端口是否已被占用（同时检测 IPv4 和 IPv6）
 * @returns true = 已被占用，false = 可用
 */
function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(false), 1500);
    // 同时检测 IPv4 和 IPv6，避免地址族不一致导致的漏检
    const server = net.createServer();
    server.once('error', () => {
      clearTimeout(timeout);
      resolve(true); // 端口被占用
    });
    server.once('listening', () => {
      server.close();
      clearTimeout(timeout);
      resolve(false); // 端口可用
    });
    server.listen(port); // 同时绑定 IPv4 (0.0.0.0) 和 IPv6 (::)
  });
}

/**
 * 自动寻找可用端口（从 startPort 开始向上递增）
 * @param startPort 起始端口
 * @returns 找到的可用端口
 */
async function findAvailablePort(startPort: number): Promise<number> {
  let port = startPort;
  while (await isPortInUse(port)) {
    port++;
  }
  return port;
}

// ── 创建浏览器窗口 ─────────────────────────────────────────
function createWindow(frontendPort: number, wsPort: number) {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Claude Code Web UI',
    backgroundColor: '#050508',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // 将 WS 端口通过 URL 参数传给前端，前端据此连接正确的端口
  mainWindow.loadURL(`http://localhost:${frontendPort}?wsPort=${wsPort}`);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── 启动 Claude Code WS Server ────────────────────────────
async function startWsServer(): Promise<number> {
  const projectRoot = path.resolve(__dirname, '..');
  const serverPath = path.join(projectRoot, 'dist', 'server', 'index.js');

  // 关键：Electron 打包后 NODE_ENV 未定义，强制设为 production
  // 这样 server 的 logger 不会尝试加载 pino-pretty transport
  process.env.NODE_ENV = 'production';

  // 动态导入预编译的 CommonJS server 模块（模块顶层不会自动启动 WS Server）
  const serverModule = await import(serverPath);

  // 自动寻找可用端口（从默认端口 5300 开始向上递增）
  const wsPort = await findAvailablePort(DEFAULT_WS_PORT);
  if (wsPort !== DEFAULT_WS_PORT) {
    console.log(`[Main] Port ${DEFAULT_WS_PORT} is in use — using port ${wsPort}`);
  }

  return new Promise<number>((resolve, reject) => {
    let port = wsPort;
    const wss = new WebSocketServer({ port });

    wss.on('error', (err: NodeJS.ErrnoException) => {
      // 竞态保护：listen 时端口被抢，自动尝试下一个
      if (err.code === 'EADDRINUSE') {
        wss.close();
        port++;
        const retry = new WebSocketServer({ port });
        retry.on('error', () => reject(err));
        retry.on('listening', () => {
          console.log(`[Main] Port ${DEFAULT_WS_PORT} is in use — WS Server using port ${port}`);
          serverModule.start(retry, port);
          resolve(port);
        });
      } else {
        reject(err);
      }
    });

    wss.on('listening', () => {
      console.log(`[Main] ✓ WS Server started on ws://localhost:${port}`);
      // 注册事件处理（不创建新服务器）
      serverModule.start(wss, port);
      resolve(port);
    });
  });
}

// ── 启动 HTTP 服务器（静态文件）───────────────────────────
/**
 * 启动 HTTP 静态文件服务器，自动寻找可用端口
 * @returns 实际使用的端口
 */
async function startHttpServer(): Promise<number> {
  const projectRoot = path.resolve(__dirname, '..');
  const distDir = path.join(projectRoot, 'dist');

  const mimeTypes: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
  };

  // 自动寻找可用端口（从默认端口 5400 开始向上递增）
  let frontendPort = await findAvailablePort(DEFAULT_FRONTEND_PORT);

  return new Promise<number>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let filePath = path.join(distDir, req.url === '/' ? 'index.html' : req.url!);

      // 去掉 URL 中的查询参数后再查找文件（防止 ?wsPort=xxx 影响路径）
      const rawPath = filePath.split('?')[0];
      const safePath = rawPath || path.join(distDir, 'index.html');

      if (!fs.existsSync(safePath) || fs.statSync(safePath).isDirectory()) {
        filePath = path.join(distDir, 'index.html');
      } else {
        filePath = safePath;
      }

      const ext = path.extname(filePath);
      const contentType = mimeTypes[ext] || 'application/octet-stream';

      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(500);
          res.end('Server Error');
          return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
      });
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      // 竞态保护：listen 时端口被抢，自动尝试下一个
      if (err.code === 'EADDRINUSE') {
        server.listen(++frontendPort, '127.0.0.1', () => {
          console.log(`[Main] Port ${DEFAULT_FRONTEND_PORT} is in use — HTTP Server using port ${frontendPort}`);
          resolve(frontendPort);
        });
      } else {
        reject(err);
      }
    });

    server.listen(frontendPort, '127.0.0.1', () => {
      console.log(`[Main] ✓ HTTP Server started on http://localhost:${frontendPort}`);
      resolve(frontendPort);
    });
  });
}

// ── 自动更新模块 ─────────────────────────────────────────────
function setupAutoUpdater() {
  const UPDATE_CH = {
    INIT: 'update:init',
    CHECK: 'update:check',
    START_DOWNLOAD: 'update:start-download',
    INSTALL: 'update:install',
    AVAILABLE: 'update:available',
    PROGRESS: 'update:progress',
    DOWNLOADED: 'update:downloaded',
    ERROR: 'update:error',
    STATUS: 'update:status',
  } as const;

  // 启动时发送当前版本信息到渲染进程
  if (mainWindow) {
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow?.webContents.send(UPDATE_CH.INIT, {
        currentVersion: app.getVersion(),
      });
    });
  }

  // 配置 autoUpdater
  autoUpdater.logger = console;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  // IPC: 手动检查更新
  ipcMain.handle(UPDATE_CH.CHECK, async () => {
    try {
      const result = await autoUpdater.checkForUpdates();
      return { available: !!result?.updateInfo, info: result?.updateInfo ?? null };
    } catch (err) {
      return { available: false, error: (err as Error).message };
    }
  });

  // IPC: 开始下载
  ipcMain.handle(UPDATE_CH.START_DOWNLOAD, async () => {
    try {
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // IPC: 安装并重启
  ipcMain.handle(UPDATE_CH.INSTALL, () => {
    autoUpdater.quitAndInstall();
  });

  // autoUpdater 事件转发到渲染进程
  autoUpdater.on('checking-for-update', () => {
    mainWindow?.webContents.send(UPDATE_CH.STATUS, 'checking');
  });

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send(UPDATE_CH.AVAILABLE, {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      downloadUrl: (info as any).downloadUrl,
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send(UPDATE_CH.PROGRESS, Math.round(progress.percent));
  });

  autoUpdater.on('update-downloaded', () => {
    mainWindow?.webContents.send(UPDATE_CH.DOWNLOADED);
  });

  autoUpdater.on('error', (err) => {
    mainWindow?.webContents.send(UPDATE_CH.ERROR, err.message);
  });

  // 启动时后台静默检查
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {
      // 静默失败
    });
  }, 3000);
}

// ── Electron 生命周期 ─────────────────────────────────────
app.whenReady().then(async () => {
  console.log('[Main] Claude Code Web UI starting...');
  console.log(`[Main] Version: ${app.getVersion()}`);

  // 注册 LanceDB IPC 处理器
  registerVectorHandlers();

  // 注册 ModelConfig IPC 处理器
  registerModelConfigHandlers();

  // 注册 WorkspacePreset IPC 处理器
  registerWorkspacePresetHandlers();

  // 注册 Embedding HTTP 代理处理器（绕过 CORS）
  registerEmbeddingHandlers();

  // V1.4.0: 注册截图捕获处理器
  registerScreenshotHandlers();

  // 自动更新模块
  setupAutoUpdater();

  try {
    const wsPort = await startWsServer();
    const frontendPort = await startHttpServer();
    createWindow(frontendPort, wsPort);
    console.log('[Main] ✓ Window created');
  } catch (err) {
    console.error('[Main] Startup error:', err);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    // macOS dock 图标点击时无法知道端口，重新检测
    app.whenReady().then(async () => {
      const wsPort = await startWsServer();
      const frontendPort = await startHttpServer();
      createWindow(frontendPort, wsPort);
    });
  }
});

process.on('uncaughtException', (err) => {
  console.error('[Main] Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Main] Unhandled rejection:', reason);
});
