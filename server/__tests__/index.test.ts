import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock ws before importing server/index
vi.mock('ws', () => ({
  WebSocketServer: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    close: vi.fn(),
    once: vi.fn(),
  })),
}));

// Mock child_process (used by ClaudeCodeProcess)
vi.mock('child_process', () => ({
  spawn: vi.fn().mockReturnValue({
    on: vi.fn(),
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    stdin: { on: vi.fn(), write: vi.fn() },
    kill: vi.fn(),
  }),
}));

// Mock logger
vi.mock('./utils/logger', () => ({
  child: vi.fn().mockReturnValue({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('server/index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export startServer function', async () => {
    // Use relative import from server/__tests__/ → server/index.ts
    const server = await import('../index.ts');
    expect(typeof server.startServer).toBe('function');
  });

  it('should export start function', async () => {
    const server = await import('../index.ts');
    expect(typeof server.start).toBe('function');
  });

  it('startServer should return a WebSocketServer instance', async () => {
    const { startServer } = await import('../index.ts');
    const wss = startServer(5301);
    expect(wss).toBeDefined();
    wss.close();
  });

  it('start function should be callable with WebSocketServer', async () => {
    const { start } = await import('../index.ts');
    const { WebSocketServer } = await import('ws');
    const wss = new WebSocketServer({ port: 5302 });
    start(wss, 5302);
    expect(WebSocketServer).toHaveBeenCalled();
    wss.close();
  });
});
