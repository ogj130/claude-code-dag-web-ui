import { describe, it, expect, vi } from 'vitest';

describe('server/utils/logger', () => {
  it('should export child function', async () => {
    const logger = await import('../utils/logger');
    expect(typeof logger.child).toBe('function');
  });

  it('should return a function when called', async () => {
    const { child } = await import('../utils/logger');
    const result = child('test-module');
    expect(result).toBeDefined();
  });

  it('should handle dev mode with pino-pretty transport', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    vi.resetModules();
    const { child } = await import('../utils/logger');

    expect(() => child('ClaudeCodeProcess')).not.toThrow();

    process.env.NODE_ENV = originalEnv;
  });

  it('should handle production mode without pino-pretty', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    vi.resetModules();
    const { child } = await import('../utils/logger');

    expect(() => child('AnsiParser')).not.toThrow();

    process.env.NODE_ENV = originalEnv;
  });

  it('should create child logger with multiple module names', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    vi.resetModules();
    const { child } = await import('../utils/logger');

    const p1 = child('Module1');
    const p2 = child('Module2');
    expect(p1).toBeDefined();
    expect(p2).toBeDefined();

    process.env.NODE_ENV = originalEnv;
  });
});
