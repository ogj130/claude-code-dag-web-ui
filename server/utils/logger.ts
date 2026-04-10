import pino from 'pino';
import fs from 'fs';
import path from 'path';

// __dirname 在 CommonJS 里是 Node.js 内置全局变量，无需重新声明
const LOG_DIR = path.resolve(__dirname, '../../logs');
const MAX_DAYS = 5;

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function getLogFile() {
  const today = new Date().toISOString().slice(0, 10);
  return path.join(LOG_DIR, `cc-server-${today}.log`);
}

function cleanupOldLogs() {
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
  // 生产环境：同时写文件 + stdout
  const fileDest = pino.destination({ dest: getLogFile(), sync: true });
  logger = pino({ level: 'info' }, fileDest);
}

export const child = (name: string) => logger.child({ module: name });
