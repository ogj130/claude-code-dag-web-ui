import loglevel from 'loglevel';

const isDev = import.meta.env.DEV;

loglevel.setLevel(isDev ? 'debug' : 'warn');

// 注入时间戳前缀
const originalFactory = loglevel.methodFactory;
loglevel.methodFactory = (methodName, level, loggerName) => {
  const rawMethod = originalFactory(methodName, level, loggerName);
  return (message: unknown, ...args: unknown[]) => {
    const timestamp = new Date().toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
    rawMethod(`[${timestamp}] [${methodName.toUpperCase()}]`, message, ...args);
  };
};

export const logger = loglevel;
export const createLogger = (name: string) => {
  const log = loglevel.getLogger(name);
  log.setLevel(isDev ? 'debug' : 'warn');
  return log;
};
