import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
          customColors: {
            error: 'red',
            warn: 'yellow',
            info: 'cyan',
            debug: 'gray',
          },
        },
      }
    : undefined,
});

export const child = (name: string) => logger.child({ module: name });
