import { describe, expect, it, vi } from 'vitest';
import { runGlobalTerminalRuntime } from '@/services/globalTerminalRuntime';

describe('globalTerminalRuntime', () => {
  it('按顺序逐个执行 prompt 并产出成功结果', async () => {
    const calls: string[] = [];
    const events: string[] = [];

    const result = await runGlobalTerminalRuntime({
      sessionId: 'session-1',
      prompts: [{ prompt: '问题1' }, { prompt: '问题2' }],
      executePrompt: async ({ prompt }) => {
        calls.push(prompt);
        return { status: 'success' };
      },
      onEvent: event => {
        events.push(`${event.type}:${event.prompt}`);
      },
    });

    expect(calls).toEqual(['问题1', '问题2']);
    expect(events).toEqual([
      'prompt_start:问题1',
      'prompt_end:问题1',
      'prompt_start:问题2',
      'prompt_end:问题2',
    ]);
    expect(result.status).toBe('success');
    expect(result.promptResults).toEqual([
      { prompt: '问题1', status: 'success' },
      { prompt: '问题2', status: 'success' },
    ]);
  });

  it('单个 prompt 失败时继续后续执行并返回 partial', async () => {
    const executePrompt = vi
      .fn()
      .mockResolvedValueOnce({ status: 'success' })
      .mockResolvedValueOnce({ status: 'failed', reason: 'timeout' })
      .mockResolvedValueOnce({ status: 'success' });

    const result = await runGlobalTerminalRuntime({
      sessionId: 'session-2',
      prompts: [{ prompt: '问题1' }, { prompt: '问题2' }, { prompt: '问题3' }],
      executePrompt,
    });

    expect(executePrompt).toHaveBeenCalledTimes(3);
    expect(result.status).toBe('partial');
    expect(result.promptResults).toEqual([
      { prompt: '问题1', status: 'success' },
      { prompt: '问题2', status: 'failed', reason: 'timeout' },
      { prompt: '问题3', status: 'success' },
    ]);
  });

  it('全部 prompt 失败时返回 failed', async () => {
    const result = await runGlobalTerminalRuntime({
      sessionId: 'session-3',
      prompts: [{ prompt: '问题1' }, { prompt: '问题2' }],
      executePrompt: async ({ prompt }) => ({ status: 'failed', reason: `${prompt}-error` }),
    });

    expect(result.status).toBe('failed');
    expect(result.promptResults).toEqual([
      { prompt: '问题1', status: 'failed', reason: '问题1-error' },
      { prompt: '问题2', status: 'failed', reason: '问题2-error' },
    ]);
  });
});
