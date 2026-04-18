import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EmbeddingConfig } from '@/stores/embeddingConfigStorage';

// ---------------------------------------------------------------------------
// Hoisted mocks — created before vi.mock() runs
// ---------------------------------------------------------------------------

const mockCreate = vi.hoisted(() => {
  const fn = vi.fn();
  fn.mockResolvedValue({ data: [{ embedding: [0.1, 0.2] }] });
  return fn;
});
const mockFetch = vi.hoisted(() => {
  const fn = vi.fn();
  fn.mockResolvedValue({
    ok: true, status: 200, statusText: 'OK',
    json: async () => ({ data: [{ embedding: [0.1, 0.2] }] }),
  } as unknown as Response);
  return fn;
});

vi.stubGlobal('fetch', mockFetch);

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    embeddings: { create: mockCreate },
  })),
}));

vi.mock('@/stores/embeddingConfigStorage', () => ({}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('embeddingService utils', () => {
  beforeEach(() => {
    // Clear call counts but keep mock implementations
    mockFetch.mockClear();
    mockCreate.mockClear();
    // Reset mockFetch to default ok response
    mockFetch.mockResolvedValue({
      ok: true, status: 200, statusText: 'OK',
      json: async () => ({ data: [{ embedding: [0.1, 0.2] }] }),
    } as unknown as Response);
    // Reset create to default
    mockCreate.mockResolvedValue({
      data: [{ embedding: [0.1, 0.2] }],
    });
  });

  describe('computeEmbeddings', () => {
    it('returns empty array for empty input', async () => {
      const { computeEmbeddings } = await import('@/utils/embeddingService');
      const cfg: EmbeddingConfig = {
        id: 'c1', provider: 'openai', endpoint: 'https://api.openai.com/v1',
        model: 'text-embedding-3-small', apiKey: 'sk', dimension: 1536,
        enabled: true, name: 'cfg',
      };
      const result = await computeEmbeddings([], cfg);
      expect(result).toEqual([]);
    });

    it('calls fetch (DEV proxy) and returns vectors', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ data: [{ embedding: [0.5, 0.6, 0.7] }] }),
      } as unknown as Response);

      const { computeEmbeddings } = await import('@/utils/embeddingService');
      const cfg: EmbeddingConfig = {
        id: 'c1', provider: 'openai', endpoint: 'https://api.openai.com/v1',
        model: 'text-embedding-3-small', apiKey: 'sk', dimension: 1536,
        enabled: true, name: 'cfg',
      };

      const result = await computeEmbeddings(['hello world'], cfg);
      expect(result.length).toBe(1);
      expect(result[0]).toEqual([0.5, 0.6, 0.7]);
      expect(mockFetch).toHaveBeenCalledWith(
        '/v1/embeddings',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('throws on API error response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: vi.fn().mockResolvedValue('Invalid API key'),
      } as unknown as Response);

      const { computeEmbeddings } = await import('@/utils/embeddingService');
      const cfg: EmbeddingConfig = {
        id: 'c1', provider: 'openai', endpoint: 'https://api.openai.com/v1',
        model: 'text-embedding-3-small', apiKey: 'sk', dimension: 1536,
        enabled: true, name: 'cfg',
      };

      await expect(computeEmbeddings(['hello'], cfg)).rejects.toThrow('401');
    });
  });

  describe('computeEmbedding', () => {
    it('wraps computeEmbeddings with vector, dimension, latency', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ data: [{ embedding: [0.1, 0.2, 0.3, 0.4, 0.5] }] }),
      } as unknown as Response);

      const { computeEmbedding } = await import('@/utils/embeddingService');
      const cfg: EmbeddingConfig = {
        id: 'c1', provider: 'openai', endpoint: 'https://api.openai.com/v1',
        model: 'text-embedding-3-small', apiKey: 'sk', dimension: 1536,
        enabled: true, name: 'cfg',
      };

      const result = await computeEmbedding('hello', cfg);
      expect(result.vector).toEqual([0.1, 0.2, 0.3, 0.4, 0.5]);
      expect(result.dimension).toBe(5);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });
});
