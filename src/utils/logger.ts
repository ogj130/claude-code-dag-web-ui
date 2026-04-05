/**
 * 前端日志模块
 * 注意：浏览器无法直接写文件，日志写入由后端 server/utils/logger.ts 统一处理。
 * 本模块仅负责前端 console 输出和日志级别控制。
 */

const isDev = import.meta.env.DEV;

enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  SILENT = 5,
}

const LEVEL_NAME: Record<number, string> = {
  [LogLevel.TRACE]: 'TRACE',
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
};

const currentLevel = isDev ? LogLevel.DEBUG : LogLevel.WARN;

function log(level: LogLevel, namespace: string, message: string, ...args: unknown[]) {
  if (level < currentLevel) return;
  const ts = new Date().toISOString().slice(11, 23);
  const prefix = `[${ts}] [${LEVEL_NAME[level]}] [${namespace}]`;
  const fn = level >= LogLevel.WARN ? console.error : console.log;
  fn(prefix, message, ...args);
}

export const logger = {
  trace: (msg: string, ...args: unknown[]) => log(LogLevel.TRACE, 'app', msg, ...args),
  debug: (msg: string, ...args: unknown[]) => log(LogLevel.DEBUG, 'app', msg, ...args),
  info:  (msg: string, ...args: unknown[]) => log(LogLevel.INFO,  'app', msg, ...args),
  warn:  (msg: string, ...args: unknown[]) => log(LogLevel.WARN,  'app', msg, ...args),
  error: (msg: string, ...args: unknown[]) => log(LogLevel.ERROR, 'app', msg, ...args),
};

export const createLogger = (name: string) => ({
  trace: (msg: string, ...args: unknown[]) => log(LogLevel.TRACE, name, msg, ...args),
  debug: (msg: string, ...args: unknown[]) => log(LogLevel.DEBUG, name, msg, ...args),
  info:  (msg: string, ...args: unknown[]) => log(LogLevel.INFO,  name, msg, ...args),
  warn:  (msg: string, ...args: unknown[]) => log(LogLevel.WARN,  name, msg, ...args),
  error: (msg: string, ...args: unknown[]) => log(LogLevel.ERROR, name, msg, ...args),
});
