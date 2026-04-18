import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  callChatCompletion,
  getDefaultModelConfig,
  type ChatMessage,
} from '@/services/modelApiClient';

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock modelConfigStorage
vi.mock('@/stores/modelConfigStorage', () => ({
  getDefaultConfig: vi.fn().mockResolvedValue(undefined),
}));

describe('modelApiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockFetch.mockReset();
  });

  describe('callChatCompletion', () => {
    it('calls OpenAI-compatible endpoint for non-Claude models', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'Hello!' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      });

      const result = await callChatCompletion({
        messages: [{ role: 'user', content: 'Hi' }],
        model: 'gpt-4',
        apiKey: 'test-key',
      });

      expect(mockFetch).toHaveBeenCalled();
      expect(result.content).toBe('Hello!');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('calls Anthropic endpoint for Claude models', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ type: 'text', text: 'Claude response' }],
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
      });

      const result = await callChatCompletion({
        messages: [{ role: 'user', content: 'Hi' }],
        model: 'claude-sonnet-4-20250514',
        apiKey: 'anthropic-key',
      });

      expect(mockFetch).toHaveBeenCalled();
      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain('anthropic.com');
      expect(result.content).toBe('Claude response');
    });

    it('throws on HTTP error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      });

      await expect(
        callChatCompletion({
          messages: [{ role: 'user', content: 'Hi' }],
          model: 'gpt-4',
          apiKey: 'bad-key',
        })
      ).rejects.toThrow('API error 401');
    });

    it('throws on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network failure'));

      await expect(
        callChatCompletion({
          messages: [{ role: 'user', content: 'Hi' }],
          model: 'gpt-4',
        })
      ).rejects.toThrow('Network failure');
    });

    it('respects maxTokens and temperature options', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'test' } }],
        }),
      });

      await callChatCompletion({
        messages: [{ role: 'user', content: 'Hi' }],
        model: 'gpt-4',
        maxTokens: 1024,
        temperature: 0.9,
      });

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.max_tokens).toBe(1024);
      expect(body.temperature).toBe(0.9);
    });

    it('merges system message for Claude API', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ type: 'text', text: 'response' }],
        }),
      });

      await callChatCompletion({
        messages: [
          { role: 'system', content: 'You are helpful.' },
          { role: 'user', content: 'Hello' },
        ],
        model: 'claude-sonnet-4-20250514',
      });

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      // System message should be merged into first user message
      expect(body.messages[0].content).toContain('You are helpful');
    });

    it('handles abort signal', async () => {
      const controller = new AbortController();
      mockFetch.mockRejectedValue(new Error('Aborted'));

      const promise = callChatCompletion({
        messages: [{ role: 'user', content: 'Hi' }],
        model: 'gpt-4',
        signal: controller.signal,
      });

      controller.abort();
      await expect(promise).rejects.toThrow();
    });
  });

  describe('getDefaultModelConfig', () => {
    it('returns config from modelConfigStorage', async () => {
      const { getDefaultConfig } = await import('@/stores/modelConfigStorage');
      const config = await getDefaultModelConfig();
      expect(config).toBeUndefined(); // mocked as undefined
    });
  });
});
