import pino from 'pino';
import fs from 'fs';
import path from 'path';

// __dirname 在 CommonJS 里是 Node.js 内置全局变量，无需重新声明
//
// 跨平台注意事项：
//   - 开发环境：__dirname = 项目目录/electron/dist/server/utils
//   - 打包后：__dirname = app.asar/dist/server/utils（asar 只读！）
//   - asar 内不能创建目录/文件，必须写 Electron 可访问的外部路径
//     macOS: ~/Library/Logs/<appName>
//     Linux:  ~/.config/<appName>/logs
//     Windows: %APPDATA%/<appName>/logs
//   - 但 server 模块是纯 CommonJS，无法直接 import { app } from 'electron'
//   - 故采用策略：生产环境只写到 stdout，由 Electron 主进程的 stdout 捕获写入文件
const MAX_DAYS = 5;
const LOG_DIR = (() => {
  // asar 内：直接用可写的用户数据目录
  if (process.env.ELECTRON_RUN_AS_NODE) {
    // server 作为 Node.js 模块被 import 时，走 fallback
    const home = process.env.HOME || process.env.USERPROFILE || '/tmp';
    return path.join(home, '.config', 'cc-web-ui', 'logs');
  }
  // 生产环境（asar 内）：Electron 会捕获 stdout，server 只写到 stdout
  return '';
})();

if (LOG_DIR && !fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function getLogFile() {
  const today = new Date().toISOString().slice(0, 10);
  return path.join(LOG_DIR, `cc-server-${today}.log`);
}

function cleanupOldLogs() {
  if (!LOG_DIR) return;
  try {
    const cutoff = Date.now() - MAX_DAYS * 24 * 60 * 60 * 1000;
    const files = fs.readdirSync(LOG_DIR).filter(f => f.startsWith('cc-server-') && f.endsWith('.log'));
    for (const file of files) {
      const stat = fs.statSync(path.join(LOG_DIR, file));
      if (stat.mtimeMs < cutoff) {
        fs.unlinkSync(path.join(LOG_DIR, file));
      }
    }
  } catch {
    // ignore cleanup errors
  }
}

cleanupOldLogs();

const isDev = process.env.NODE_ENV !== 'production';

let logger: pino.Logger;

if (isDev) {
  // 开发环境：pino-pretty 彩色输出到终端
  logger = pino({
    level: 'debug',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
  });
} else {
  // 生产环境（asar 内）：写到 stdout，由 Electron 主进程捕获
  // 不再尝试写文件（asar 只读）
  logger = pino({ level: 'info' });
}

export const child = (name: string) => logger.child({ module: name });
