import loglevel from 'loglevel';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.resolve(__dirname, '../../logs');
const MAX_FILES = 5;

const isDev = import.meta.env.DEV;

// 确保日志目录存在
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// 生成今天的日志文件名
function getLogFile() {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return path.join(LOG_DIR, `cc-web-${today}.log`);
}

// 滚动清理：删除 5 天前的日志文件
function cleanupOldLogs() {
  try {
    const files = fs.readdirSync(LOG_DIR).filter(f => f.startsWith('cc-web-') && f.endsWith('.log'));
    const cutoff = Date.now() - MAX_FILES * 24 * 60 * 60 * 1000;
    for (const file of files) {
      const filePath = path.join(LOG_DIR, file);
      const stat = fs.statSync(filePath);
      if (stat.mtimeMs < cutoff) {
        fs.unlinkSync(filePath);
      }
    }
  } catch {
    // ignore cleanup errors
  }
}

cleanupOldLogs();

// 设置日志级别
loglevel.setLevel(isDev ? 'debug' : 'warn');

// 时间戳前缀工厂
const originalFactory = loglevel.methodFactory;
loglevel.methodFactory = (methodName, level, loggerName) => {
  const rawMethod = originalFactory(methodName, level, loggerName);
  return (message: unknown, ...args: unknown[]) => {
    const ts = new Date().toISOString();
    const prefix = `[${ts}] [${methodName.toUpperCase()}]`;
    const logLine = [prefix, message, ...args].map(s => String(s)).join(' ');

    // 写入文件
    try {
      fs.appendFileSync(getLogFile(), logLine + '\n');
    } catch {
      // ignore write errors
    }

    // 开发环境同时输出到控制台（彩色）
    if (isDev) {
      rawMethod(`[${ts.slice(11, 23)}] [${methodName.toUpperCase()}]`, message, ...args);
    }
  };
};

export const logger = loglevel;

export const createLogger = (name: string) => {
  const log = loglevel.getLogger(name);
  log.setLevel(isDev ? 'debug' : 'warn');
  return log;
};
