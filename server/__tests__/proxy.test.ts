import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProxyManager } from '../proxy/wrapper';

// Use vi.hoisted to ensure mocks are created at the correct hoisting level
const { mockSpawn, mockProc } = vi.hoisted(() => {
  const mockProc = {
    on: vi.fn(),
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    kill: vi.fn(),
  };
  return {
    mockSpawn: vi.fn().mockReturnValue(mockProc),
    mockProc,
  };
});

vi.mock('child_process', () => ({
  spawn: mockSpawn,
}));

vi.mock('path', () => ({
  dirname: vi.fn().mockReturnValue('/mock/proxy/dir'),
  join: vi.fn().mockImplementation((...args: string[]) => args.join('/')),
}));

vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
}));

describe('server/proxy/wrapper (ProxyManager)', () => {
  let manager: ProxyManager;

  beforeEach(() => {
    manager = new ProxyManager();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create an instance', () => {
      expect(manager).toBeDefined();
    });

    it('should start with stopped status', () => {
      expect(manager.status).toBe('stopped');
    });
  });

  describe('status property', () => {
    it('should report initial status as stopped', () => {
      expect(manager.status).toBe('stopped');
    });

    it('should transition to running after startup', async () => {
      const stdoutOn = mockProc.stdout.on as ReturnType<typeof vi.fn>;
      const onCb = stdoutOn.mock.calls.find(c => c[0] === 'data')?.[1] as (data: Buffer) => void;

      const startPromise = manager.start({ apiKey: 'test-key' });
      if (onCb) onCb(Buffer.from('Application startup complete'));
      await startPromise;

      expect(manager.status).toBe('running');
    });
  });

  describe('proxyUrl property', () => {
    it('should return default proxy URL', () => {
      expect(manager.proxyUrl).toBe('http://127.0.0.1:8082');
    });

    it('should return custom port proxy URL', async () => {
      const stdoutOn = mockProc.stdout.on as ReturnType<typeof vi.fn>;
      const onCb = stdoutOn.mock.calls.find(c => c[0] === 'data')?.[1] as (data: Buffer) => void;

      const startPromise = manager.start({ apiKey: 'test-key', port: 9090 });
      if (onCb) onCb(Buffer.from('Application startup complete'));
      await startPromise;

      expect(manager.proxyUrl).toBe('http://127.0.0.1:9090');
    });
  });

  describe('start', () => {
    it('should reject if server.py not found', async () => {
      const { existsSync } = require('fs');
      (existsSync as ReturnType<typeof vi.fn>).mockReturnValueOnce(false);

      await expect(manager.start({ apiKey: 'test-key' })).rejects.toThrow('server.py not found');
    });

    it('should spawn uvicorn process', async () => {
      const stdoutOn = mockProc.stdout.on as ReturnType<typeof vi.fn>;
      const onCb = stdoutOn.mock.calls.find(c => c[0] === 'data')?.[1] as (data: Buffer) => void;

      const startPromise = manager.start({ apiKey: 'test-key' });
      if (onCb) onCb(Buffer.from('Application startup complete'));
      await startPromise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'uv',
        expect.arrayContaining(['run', 'uvicorn', 'server:app', '--host', '127.0.0.1']),
        expect.objectContaining({ cwd: expect.any(String) }),
      );
    });

    it('should set OPENAI_API_KEY env variable', async () => {
      const stdoutOn = mockProc.stdout.on as ReturnType<typeof vi.fn>;
      const onCb = stdoutOn.mock.calls.find(c => c[0] === 'data')?.[1] as (data: Buffer) => void;

      const startPromise = manager.start({ apiKey: 'sk-secret-key' });
      if (onCb) onCb(Buffer.from('Application startup complete'));
      await startPromise;

      const spawnCall = mockSpawn.mock.calls[0];
      const env = spawnCall[2]?.env as Record<string, string>;
      expect(env.OPENAI_API_KEY).toBe('sk-secret-key');
    });

    it('should not re-spawn if already running', async () => {
      const stdoutOn = mockProc.stdout.on as ReturnType<typeof vi.fn>;
      const onCb = stdoutOn.mock.calls.find(c => c[0] === 'data')?.[1] as (data: Buffer) => void;

      const startPromise = manager.start({ apiKey: 'test-key' });
      if (onCb) onCb(Buffer.from('Application startup complete'));
      await startPromise;

      await manager.start({ apiKey: 'test-key' });
      expect(mockSpawn).toHaveBeenCalledTimes(1);
    });

    it('should resolve after startup complete message', async () => {
      const stdoutOn = mockProc.stdout.on as ReturnType<typeof vi.fn>;
      const onCb = stdoutOn.mock.calls.find(c => c[0] === 'data')?.[1] as (data: Buffer) => void;

      await manager.start({ apiKey: 'test-key' });
      if (onCb) onCb(Buffer.from('Application startup complete'));

      expect(manager.status).toBe('running');
    });

    it('should resolve after Uvicorn running message', async () => {
      const stdoutOn = mockProc.stdout.on as ReturnType<typeof vi.fn>;
      const onCb = stdoutOn.mock.calls.find(c => c[0] === 'data')?.[1] as (data: Buffer) => void;

      const startPromise = manager.start({ apiKey: 'test-key' });
      if (onCb) onCb(Buffer.from('Uvicorn running on http://127.0.0.1:8082'));
      await startPromise;

      expect(manager.status).toBe('running');
    });

    it('should handle startup timeout', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: false });
      try {
        const startPromise = manager.start({ apiKey: 'test-key' });
        await vi.advanceTimersByTimeAsync(10001);
        await startPromise;

        expect(manager.status).toBe('running');
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('stop', () => {
    it('should stop the process', async () => {
      const stdoutOn = mockProc.stdout.on as ReturnType<typeof vi.fn>;
      const onCb = stdoutOn.mock.calls.find(c => c[0] === 'data')?.[1] as (data: Buffer) => void;

      await manager.start({ apiKey: 'test-key' });
      if (onCb) onCb(Buffer.from('Application startup complete'));

      await manager.stop();
      expect(manager.status).toBe('stopped');
    });

    it('should handle stop when not started', async () => {
      await expect(manager.stop()).resolves.toBeUndefined();
    });
  });

  describe('restart', () => {
    it('should stop then start', async () => {
      const stdoutOn = mockProc.stdout.on as ReturnType<typeof vi.fn>;
      const onCb = stdoutOn.mock.calls.find(c => c[0] === 'data')?.[1] as (data: Buffer) => void;

      await manager.start({ apiKey: 'test-key' });
      if (onCb) onCb(Buffer.from('Application startup complete'));

      const startCount = mockSpawn.mock.calls.length;
      await manager.restart({ apiKey: 'new-key' });
      expect(mockSpawn.mock.calls.length).toBeGreaterThan(startCount);
    });
  });

  describe('process error handling', () => {
    it('should reject on process error', async () => {
      const procOn = mockProc.on as ReturnType<typeof vi.fn>;
      const errorCb = procOn.mock.calls.find(c => c[0] === 'error')?.[1] as (err: Error) => void;

      const startPromise = manager.start({ apiKey: 'test-key' });
      if (errorCb) errorCb(new Error('ENOENT: command not found'));

      await expect(startPromise).rejects.toThrow('ENOENT: command not found');
      expect(manager.status).toBe('error');
    });
  });

  describe('process close handling', () => {
    it('should update status on process close', async () => {
      const procOn = mockProc.on as ReturnType<typeof vi.fn>;
      const closeCb = procOn.mock.calls.find(c => c[0] === 'close')?.[1] as (code: number) => void;

      await manager.start({ apiKey: 'test-key' });
      if (closeCb) closeCb(0);

      expect(manager.status).toBe('stopped');
    });
  });
});

describe('proxyManager singleton', () => {
  it('should export a proxyManager instance', () => {
    const { proxyManager } = require('../proxy/wrapper');
    expect(proxyManager).toBeDefined();
    expect(proxyManager).toBeInstanceOf(ProxyManager);
  });
});
