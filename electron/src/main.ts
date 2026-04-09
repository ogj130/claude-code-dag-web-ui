import { app, BrowserWindow, shell } from 'electron';
import * as path from 'path';
import * as http from 'http';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';

// ── 版本信息 ──────────────────────────────────────────────
const FRONTEND_PORT = 5400;
const WS_PORT = 5300;

// ── 全局引用 ──────────────────────────────────────────────
let mainWindow: BrowserWindow | null = null;
let wsServerProcess: ChildProcess | null = null;

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
    show: false, // 等内容加载完再显示
  });

  // 窗口准备好后显示，避免白屏闪烁
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // 加载前端页面
  mainWindow.loadURL(`http://localhost:${FRONTEND_PORT}`);

  // 点击外部链接用系统浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── 启动 Claude Code WS Server ────────────────────────────
function startWsServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    // 找项目根目录（electron 目录的上一级）
    const projectRoot = path.resolve(__dirname, '..');
    const serverIndex = path.join(projectRoot, 'server', 'index.ts');

    if (!fs.existsSync(serverIndex)) {
      reject(new Error(`Server file not found: ${serverIndex}`));
      return;
    }

    console.log(`[Main] Starting WS server: node ${serverIndex}`);

    wsServerProcess = spawn(
      'node',
      [
        '--import', 'tsx/esm',
        serverIndex,
      ],
      {
        cwd: projectRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, NODE_ENV: 'production' },
      }
    );

    wsServerProcess.stdout?.on('data', (data: Buffer) => {
      process.stdout.write(`[WS Server] ${data}`);
    });

    wsServerProcess.stderr?.on('data', (data: Buffer) => {
      process.stderr.write(`[WS Server ERROR] ${data}`);
    });

    wsServerProcess.on('error', (err) => {
      console.error('[Main] WS server spawn error:', err);
      reject(err);
    });

    // 等待一小段时间，确认端口已监听
    setTimeout(resolve, 1500);
  });
}

// ── 启动 HTTP 服务器（静态文件）───────────────────────────
function startHttpServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    const projectRoot = path.resolve(__dirname, '..');
    const distDir = path.join(projectRoot, 'dist');

    if (!fs.existsSync(distDir)) {
      console.warn('[Main] dist/ not found, building frontend...');
      // 自动执行 vite build
      const buildProc = spawn('npm', ['run', 'build'], {
        cwd: projectRoot,
        stdio: 'inherit',
        shell: true,
      });
      buildProc.on('close', (code) => {
        if (code === 0) {
          startHttpServer().then(resolve).catch(reject);
        } else {
          reject(new Error(`Build failed with code ${code}`));
        }
      });
      return;
    }

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

    const server = http.createServer((req, res) => {
      let filePath = path.join(distDir, req.url === '/' ? 'index.html' : req.url!);

      // SPA fallback：所有路径都返回 index.html
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
      console.log(`[Main] HTTP server listening on port ${FRONTEND_PORT}`);
      resolve();
    });
  });
}

// ── Electron 生命周期 ─────────────────────────────────────
app.whenReady().then(async () => {
  console.log('[Main] Claude Code Web UI starting...');
  console.log(`[Main] Version: ${app.getVersion()}`);

  try {
    // 1. 启动 WS Server
    await startWsServer();
    console.log('[Main] ✓ WS Server started');

    // 2. 启动 HTTP Server
    await startHttpServer();
    console.log('[Main] ✓ HTTP Server started');

    // 3. 创建窗口
    createWindow();
    console.log('[Main] ✓ Window created');
    console.log(`[Main] Frontend: http://localhost:${FRONTEND_PORT}`);
    console.log(`[Main] WS Server: ws://localhost:${WS_PORT}`);
  } catch (err) {
    console.error('[Main] Startup error:', err);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  // 清理 WS Server 进程
  if (wsServerProcess) {
    wsServerProcess.kill();
    wsServerProcess = null;
  }
  // Windows/Linux 上关闭所有窗口后退出
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// 全局错误处理
process.on('uncaughtException', (err) => {
  console.error('[Main] Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Main] Unhandled rejection:', reason);
});
