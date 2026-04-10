import pino from 'pino';

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
  // 生产环境（打包后）：只写 stdout，避免写入 asar 只读路径
  logger = pino({ level: 'info' });
}

export const child = (name: string) => logger.child({ module: name });
