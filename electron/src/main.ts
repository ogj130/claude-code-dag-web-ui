import { app, BrowserWindow, shell } from 'electron';
import * as path from 'path';
import * as http from 'http';
import * as fs from 'fs';
import { WebSocketServer } from 'ws';

// ── 版本信息 ──────────────────────────────────────────────
const FRONTEND_PORT = 5400;
const WS_PORT = 5300;

// ── 全局引用 ──────────────────────────────────────────────
let mainWindow: BrowserWindow | null = null;

// ── 创建浏览器窗口 ─────────────────────────────────────────
function createWindow() {
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

  mainWindow.loadURL(`http://localhost:${FRONTEND_PORT}`);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── 启动 Claude Code WS Server ────────────────────────────
async function startWsServer(): Promise<void> {
  const projectRoot = path.resolve(__dirname, '..');
  const serverPath = path.join(projectRoot, 'dist', 'server', 'index.js');

  // 动态导入预编译的 CommonJS server 模块
  const serverModule = await import(serverPath);
  const wss = new WebSocketServer({ port: WS_PORT });
  serverModule.start(wss);
  console.log(`[Main] ✓ WS Server started on ws://localhost:${WS_PORT}`);
}

// ── 启动 HTTP 服务器（静态文件）───────────────────────────
async function startHttpServer(): Promise<void> {
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

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let filePath = path.join(distDir, req.url === '/' ? 'index.html' : req.url!);

      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(distDir, 'index.html');
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
      if (err.code === 'EADDRINUSE') {
        console.warn(`[Main] Port ${FRONTEND_PORT} already in use, trying next...`);
        server.listen(0, '127.0.0.1', () => {
          console.log(`[Main] HTTP server listening on port ${(server.address() as any).port}`);
          resolve();
        });
      } else {
        reject(err);
      }
    });

    server.listen(FRONTEND_PORT, '127.0.0.1', () => {
      console.log(`[Main] ✓ HTTP Server started on http://localhost:${FRONTEND_PORT}`);
      resolve();
    });
  });
}

// ── Electron 生命周期 ─────────────────────────────────────
app.whenReady().then(async () => {
  console.log('[Main] Claude Code Web UI starting...');
  console.log(`[Main] Version: ${app.getVersion()}`);

  try {
    await startWsServer();
    await startHttpServer();
    createWindow();
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
    createWindow();
  }
});

process.on('uncaughtException', (err) => {
  console.error('[Main] Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Main] Unhandled rejection:', reason);
});
