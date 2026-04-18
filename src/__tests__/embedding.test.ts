import { describe, it, expect, vi, beforeEach } from 'vitest';
import { embedText, embedTexts, testConnection } from '@/utils/embedding';
import type { EmbeddingConfig } from '@/stores/embeddingConfigStorage';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFetchViaIpc = vi.fn();

vi.mock('@/stores/embeddingConfigStorage', () => ({
  getDefaultConfig: vi.fn(),
}));

vi.mock('@/utils/embeddingService', () => ({
  computeEmbedding: vi.fn(),
  computeEmbeddings: vi.fn(),
}));

// Mock window.electron
const mockElectronEmbeddingApi = {
  call: mockFetchViaIpc,
};
vi.stubGlobal('window', {
  electron: {
    embeddingApi: mockElectronEmbeddingApi,
  },
});

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeConfig(): EmbeddingConfig {
  return {
    id: 'cfg1',
    provider: 'openai',
    endpoint: 'https://api.openai.com',
    model: 'text-embedding-3-small',
    apiKey: 'sk-test',
    dimension: 1536,
    enabled: true,
    name: 'Test Config',
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('embedding utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('testConnection', () => {
    it('returns success result on valid connection', async () => {
      const { computeEmbedding } = await import('@/utils/embeddingService');
      vi.mocked(computeEmbedding).mockResolvedValue({
        vector: new Array(1536).fill(0.1),
        dimension: 1536,
        latencyMs: 50,
      });

      const result = await testConnection(makeConfig());
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.latency).toBeGreaterThanOrEqual(0);
        expect(result.dimension).toBe(1536);
      }
    });

    it('returns error result on failure', async () => {
      const { computeEmbedding } = await import('@/utils/embeddingService');
      vi.mocked(computeEmbedding).mockRejectedValue(new Error('Network error'));

      const result = await testConnection(makeConfig());
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Network error');
      }
    });
  });

  describe('embedText', () => {
    it('throws when text is empty', async () => {
      await expect(embedText('')).rejects.toThrow('文本不能为空');
    });

    it('throws when no config is set', async () => {
      const { getDefaultConfig } = await import('@/stores/embeddingConfigStorage');
      vi.mocked(getDefaultConfig).mockResolvedValue(undefined);

      await expect(embedText('hello')).rejects.toThrow('未配置 embedding');
    });

    it('calls computeEmbedding when not in Electron', async () => {
      const { getDefaultConfig } = await import('@/stores/embeddingConfigStorage');
      const { computeEmbedding } = await import('@/utils/embeddingService');

      vi.mocked(getDefaultConfig).mockResolvedValue(makeConfig());
      vi.mocked(computeEmbedding).mockResolvedValue({
        vector: [0.1, 0.2, 0.3],
        dimension: 3,
        latencyMs: 10,
      });

      // Simulate non-Electron env
      const originalElectron = (window as any).electron;
      delete (window as any).electron;
      try {
        const vector = await embedText('hello world');
        expect(vector).toEqual([0.1, 0.2, 0.3]);
      } finally {
        (window as any).electron = originalElectron;
      }
    });
  });

  describe('embedTexts', () => {
    it('returns empty array for empty input', async () => {
      const { getDefaultConfig } = await import('@/stores/embeddingConfigStorage');
      vi.mocked(getDefaultConfig).mockResolvedValue(makeConfig());

      const result = await embedTexts([]);
      expect(result).toEqual([]);
    });

    it('throws when no config is set', async () => {
      const { getDefaultConfig } = await import('@/stores/embeddingConfigStorage');
      vi.mocked(getDefaultConfig).mockResolvedValue(undefined);

      await expect(embedTexts(['hello'])).rejects.toThrow('未配置 embedding');
    });
  });
});
