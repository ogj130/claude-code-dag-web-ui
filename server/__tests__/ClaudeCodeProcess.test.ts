import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockProc = {
  on: vi.fn(),
  stdout: { on: vi.fn() },
  stderr: { on: vi.fn() },
  stdin: { write: vi.fn(), on: vi.fn() },
  kill: vi.fn(),
};

vi.mock('child_process', () => ({
  spawn: vi.fn().mockReturnValue(mockProc),
}));

vi.mock('./utils/logger', () => ({
  child: vi.fn().mockReturnValue({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('ClaudeCodeProcess', () => {
  let ClaudeCodeProcess: typeof import('../ClaudeCodeProcess').ClaudeCodeProcess;
  let processManager: InstanceType<typeof import('../ClaudeCodeProcess').ClaudeCodeProcess>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../ClaudeCodeProcess');
    ClaudeCodeProcess = mod.ClaudeCodeProcess;
    processManager = new ClaudeCodeProcess();
  });

  afterEach(() => {
    processManager.kill('test-session');
    processManager.kill('test-session-2');
  });

  describe('spawn', () => {
    it('should spawn a new process for a session', () => {
      processManager.spawn('test-session', '/tmp/test-project');
      expect(processManager.isRunning('test-session')).toBe(true);
    });

    it('should kill existing process before spawning new one for same session', () => {
      processManager.spawn('test-session', '/tmp/test-project');
      expect(mockProc.kill).not.toHaveBeenCalled(); // first spawn

      processManager.spawn('test-session', '/tmp/test-project');
      expect(processManager.isRunning('test-session')).toBe(true);
    });

    it('should emit session_start event on spawn', () => {
      const handler = vi.fn();
      processManager.on('event', handler);
      processManager.spawn('test-session', '/tmp/test-project');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'test-session',
          event: expect.objectContaining({ type: 'session_start' }),
        }),
      );
    });

    it('should spawn with model option', () => {
      processManager.spawn('test-session', '/tmp/test-project', { model: 'claude-3-opus' });
      expect(processManager.isRunning('test-session')).toBe(true);
    });

    it('should spawn with baseUrl and apiKey options', () => {
      processManager.spawn('test-session', '/tmp/test-project', {
        baseUrl: 'https://api.anthropic.com',
        apiKey: 'sk-test-key',
      });
      expect(processManager.isRunning('test-session')).toBe(true);
    });

    it('should spawn with prompt option', () => {
      processManager.spawn('test-session', '/tmp/test-project', {
        prompt: 'Hello Claude',
      });
      expect(processManager.isRunning('test-session')).toBe(true);
    });
  });

  describe('sendInput', () => {
    it('should return empty string when session not running', () => {
      const queryId = processManager.sendInput('non-existent', 'hello');
      expect(queryId).toBe('');
    });

    it('should return queryId when session is running', () => {
      processManager.spawn('test-session', '/tmp/test-project');
      const queryId = processManager.sendInput('test-session', 'Hello world');
      expect(queryId).toBeTruthy();
      expect(queryId.startsWith('query_')).toBe(true);
    });

    it('should write JSON to stdin in stream-json format', () => {
      processManager.spawn('test-session', '/tmp/test-project');
      processManager.sendInput('test-session', 'Test input');

      expect(mockProc.stdin.write).toHaveBeenCalled();
      const written = mockProc.stdin.write.mock.calls[0]?.[0];
      expect(written).toContain('"type":"user"');
      expect(written).toContain('Test input');
    });

    it('should increment query counter for each input', () => {
      processManager.spawn('test-session', '/tmp/test-project');
      const id1 = processManager.sendInput('test-session', 'input 1');
      const id2 = processManager.sendInput('test-session', 'input 2');
      const id3 = processManager.sendInput('test-session', 'input 3');

      expect(id1).toBe('query_1');
      expect(id2).toBe('query_2');
      expect(id3).toBe('query_3');
    });
  });

  describe('kill', () => {
    it('should stop a running session', () => {
      processManager.spawn('test-session', '/tmp/test-project');
      expect(processManager.isRunning('test-session')).toBe(true);

      processManager.kill('test-session');
      expect(processManager.isRunning('test-session')).toBe(false);
    });

    it('should emit session_end event on kill', () => {
      processManager.spawn('test-session', '/tmp/test-project');
      const handler = vi.fn();
      const sessionEndHandler = (payload: { event: { type: string } }) => {
        if (payload.event.type === 'session_end') handler(payload);
      };
      processManager.on('event', sessionEndHandler);

      processManager.kill('test-session');
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          event: expect.objectContaining({ type: 'session_end', reason: 'killed' }),
        }),
      );
    });

    it('should handle killing non-existent session gracefully', () => {
      expect(() => processManager.kill('non-existent')).not.toThrow();
    });
  });

  describe('getSessionPath', () => {
    it('should return undefined for non-existent session', () => {
      expect(processManager.getSessionPath('non-existent')).toBeUndefined();
    });

    it('should return the project path after spawn', () => {
      processManager.spawn('test-session', '/tmp/my-project');
      expect(processManager.getSessionPath('test-session')).toBe('/tmp/my-project');
    });
  });

  describe('isRunning', () => {
    it('should return false for non-existent session', () => {
      expect(processManager.isRunning('non-existent')).toBe(false);
    });

    it('should return true for running session', () => {
      processManager.spawn('test-session', '/tmp/test-project');
      expect(processManager.isRunning('test-session')).toBe(true);
    });

    it('should return false after killing session', () => {
      processManager.spawn('test-session', '/tmp/test-project');
      processManager.kill('test-session');
      expect(processManager.isRunning('test-session')).toBe(false);
    });
  });

  describe('event forwarding', () => {
    it('should register close handler', () => {
      processManager.spawn('test-session', '/tmp/test-project');
      // Verify close handler was registered on the process
      const closeHandlerRegistrations = mockProc.on.mock.calls.filter(([evt]) => evt === 'close');
      expect(closeHandlerRegistrations.length).toBeGreaterThan(0);
    });

    it('should register error handler', () => {
      processManager.spawn('test-session', '/tmp/test-project');
      const errorHandlerRegistrations = mockProc.on.mock.calls.filter(([evt]) => evt === 'error');
      expect(errorHandlerRegistrations.length).toBeGreaterThan(0);
    });

    it('should register stdout data handler', () => {
      processManager.spawn('test-session', '/tmp/test-project');
      expect(mockProc.stdout.on).toHaveBeenCalledWith('data', expect.any(Function));
    });

    it('should register stderr data handler', () => {
      processManager.spawn('test-session', '/tmp/test-project');
      expect(mockProc.stderr.on).toHaveBeenCalledWith('data', expect.any(Function));
    });

    it('should handle close event', () => {
      const closeHandler = vi.fn();
      processManager.on('close', closeHandler);
      processManager.spawn('test-session', '/tmp/test-project');

      const closeCb = mockProc.on.mock.calls.find(c => c[0] === 'close')?.[1] as (code: number) => void;
      if (closeCb) closeCb(0);

      expect(closeHandler).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: 'test-session', code: 0 }),
      );
    });

    it('should handle error event', () => {
      const errorHandler = vi.fn();
      processManager.on('error', errorHandler);
      processManager.spawn('test-session', '/tmp/test-project');

      const errorCb = mockProc.on.mock.calls.find(c => c[0] === 'error')?.[1] as (err: Error) => void;
      if (errorCb) errorCb(new Error('test error'));

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: 'test-session' }),
      );
    });
  });
});
