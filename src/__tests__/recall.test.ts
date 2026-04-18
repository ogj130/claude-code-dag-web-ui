import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateJaccardSimilarity,
  calculateEditDistance,
  calculateSimilarity,
  calculateTimeDecay,
  calculateKeywordScore,
  incrementUsageCount,
  calculateUsageScore,
  rankResults,
  findSimilarQueries,
  recommendErrorSolutions,
  findSimilarErrorLogs,
  recallByQuery,
  getHistoryDocuments,
  type RecallDocument,
} from '@/utils/recall';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

vi.mock('@/utils/errorLogger', () => ({
  getErrorLogs: vi.fn().mockReturnValue([]),
}));

vi.mock('@/utils/searchIndex', () => ({
  searchDocuments: vi.fn().mockReturnValue([]),
  getAllDocuments: vi.fn().mockReturnValue([]),
}));

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeDoc(overrides: Partial<RecallDocument> = {}): RecallDocument {
  return {
    id: 'doc1',
    sessionId: 's1',
    query: 'How to fix the bug',
    timestamp: Date.now() - 86400000, // 1 day ago
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('recall utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Tokenization helpers (exported indirectly via calculateJaccard) ─────

  describe('calculateJaccardSimilarity', () => {
    it('returns 1 for identical text', () => {
      expect(calculateJaccardSimilarity('hello', 'hello')).toBe(1);
    });

    it('returns 0 for completely different text', () => {
      expect(calculateJaccardSimilarity('abc', 'xyz')).toBe(0);
    });

    it('handles empty inputs', () => {
      expect(calculateJaccardSimilarity('', '')).toBe(0);
      expect(calculateJaccardSimilarity('hello', '')).toBe(0);
    });

    it('handles Chinese text', () => {
      const similarity = calculateJaccardSimilarity('你好世界', '你好中国');
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
    });
  });

  describe('calculateEditDistance', () => {
    it('returns 0 for identical strings', () => {
      expect(calculateEditDistance('hello', 'hello')).toBe(0);
    });

    it('returns correct distance for single character difference', () => {
      expect(calculateEditDistance('hello', 'hallo')).toBe(1);
    });

    it('returns length difference for completely different strings', () => {
      expect(calculateEditDistance('', 'abc')).toBe(3);
    });
  });

  describe('calculateSimilarity', () => {
    it('returns 1 for identical text', () => {
      expect(calculateSimilarity('hello world', 'hello world')).toBe(1);
    });

    it('returns 0 for empty input', () => {
      expect(calculateSimilarity('', 'hello')).toBe(0);
      expect(calculateSimilarity('hello', '')).toBe(0);
    });

    it('returns positive value between 0 and 1 for similar text', () => {
      const sim = calculateSimilarity('how to fix bug', 'how to fix error');
      expect(sim).toBeGreaterThan(0);
      expect(sim).toBeLessThan(1);
    });
  });

  // ── Score components ────────────────────────────────────────────────────

  describe('calculateTimeDecay', () => {
    it('returns 1 for current timestamp', () => {
      const now = Date.now();
      expect(calculateTimeDecay(now)).toBeCloseTo(1, 1);
    });

    it('returns ~0.5 for half-life (7 days ago)', () => {
      const halfLifeAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const score = calculateTimeDecay(halfLifeAgo);
      expect(score).toBeCloseTo(0.5, 1);
    });

    it('returns < 0.5 for older timestamps', () => {
      const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
      const score = calculateTimeDecay(twoWeeksAgo);
      expect(score).toBeLessThan(0.5);
    });

    it('respects custom half-life', () => {
      // Use a timestamp from 1 day ago to get different scores for different half-lives
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const score7 = calculateTimeDecay(oneDayAgo, 7);
      const score14 = calculateTimeDecay(oneDayAgo, 14);
      // Shorter half-life → faster decay → LOWER score
      expect(score7).toBeLessThan(score14);
    });
  });

  describe('calculateKeywordScore', () => {
    it('returns 1 for identical query', () => {
      const doc = makeDoc({ query: 'fix bug' });
      expect(calculateKeywordScore(doc, 'fix bug')).toBe(1);
    });
  });

  describe('incrementUsageCount / calculateUsageScore', () => {
    it('returns 0 for uncounted doc', () => {
      expect(calculateUsageScore('unknown-id')).toBe(0);
    });

    it('increments and returns positive score for counted doc', () => {
      incrementUsageCount('doc1');
      incrementUsageCount('doc1');
      const score = calculateUsageScore('doc1');
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('caps at 1 for high usage', () => {
      for (let i = 0; i < 100; i++) incrementUsageCount('doc-max');
      expect(calculateUsageScore('doc-max')).toBe(1);
    });
  });

  // ── Ranking ────────────────────────────────────────────────────────────

  describe('rankResults', () => {
    it('returns results sorted by score descending', () => {
      const docs = [
        makeDoc({ id: 'd1', query: 'fix bug python' }),
        makeDoc({ id: 'd2', query: 'fix' }),
        makeDoc({ id: 'd3', query: 'how to fix this bug' }),
      ];

      const results = rankResults(docs, 'fix bug');
      expect(results.length).toBe(3);
      // First result should have highest keyword score for "fix bug"
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
      }
    });

    it('includes score components', () => {
      const results = rankResults([makeDoc({ query: 'fix' })], 'fix bug');
      const result = results[0];
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('keywordScore');
      expect(result).toHaveProperty('timeDecay');
      expect(result).toHaveProperty('usageScore');
    });
  });

  // ── Similar query detection ─────────────────────────────────────────────

  describe('findSimilarQueries', () => {
    it('returns empty array when threshold is 1', () => {
      const docs = [makeDoc({ query: 'fix bug' })];
      expect(findSimilarQueries(docs, 'fix bug', 1.0)).toEqual([]);
    });

    it('excludes the same query', () => {
      const docs = [makeDoc({ query: 'fix bug' })];
      const results = findSimilarQueries(docs, 'fix bug', 0.5);
      expect(results).toEqual([]);
    });

    it('returns similar queries above threshold', () => {
      const docs = [makeDoc({ query: 'how to fix this bug quickly' })];
      const results = findSimilarQueries(docs, 'how to fix this bug', 0.5);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('similarity');
      expect(results[0].similarity).toBeGreaterThan(0);
    });

    it('respects limit', () => {
      const docs = Array.from({ length: 10 }, (_, i) =>
        makeDoc({ id: `d${i}`, query: 'how to fix this bug' })
      );
      const results = findSimilarQueries(docs, 'fix bug', 0.3, 3);
      expect(results.length).toBeLessThanOrEqual(3);
    });
  });

  // ── Error solution recommendation ──────────────────────────────────────

  describe('recommendErrorSolutions', () => {
    it('returns empty array for empty error string', () => {
      expect(recommendErrorSolutions('', [])).toEqual([]);
    });

    it('returns solutions matching error text', () => {
      const docs = [
        makeDoc({
          id: 'e1',
          query: 'TypeError fix',
          summary: 'Fixed by updating types',
          errorMessage: 'TypeError: undefined is not a function',
        }),
        makeDoc({
          id: 'e2',
          query: 'Other issue',
          summary: 'Fixed differently',
          errorMessage: 'Connection timeout',
        }),
      ];

      const results = recommendErrorSolutions('TypeError: undefined is not a function', docs, 0.5);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].document.id).toBe('e1');
    });
  });

  describe('findSimilarErrorLogs', () => {
    it('returns empty when no logs', async () => {
      const { getErrorLogs } = await import('@/utils/errorLogger');
      vi.mocked(getErrorLogs).mockReturnValue([]);
      const results = findSimilarErrorLogs('some error');
      expect(results).toEqual([]);
    });

    it('returns matching logs above threshold', async () => {
      const { getErrorLogs } = await import('@/utils/errorLogger');
      vi.mocked(getErrorLogs).mockReturnValue([
        { id: 'log1', message: 'TypeError: fail', timestamp: Date.now() },
        { id: 'log2', message: 'Timeout error', timestamp: Date.now() },
      ]);

      const results = findSimilarErrorLogs('TypeError: fail', 0.3);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe('log1');
    });
  });

  // ── Main recall ────────────────────────────────────────────────────────

  describe('recallByQuery', () => {
    it('returns empty when no documents match', async () => {
      const { searchDocuments } = await import('@/utils/searchIndex');
      vi.mocked(searchDocuments).mockReturnValue([]);

      const results = recallByQuery('test query');
      expect(results).toEqual([]);
    });

    it('excludes documents by ID', async () => {
      const { searchDocuments } = await import('@/utils/searchIndex');
      vi.mocked(searchDocuments).mockReturnValue([
        { id: 'doc1', sessionId: 's1', query: 'fix bug', summary: '', analysis: '', timestamp: Date.now() },
        { id: 'doc2', sessionId: 's1', query: 'fix bug', summary: '', analysis: '', timestamp: Date.now() },
      ]);

      const results = recallByQuery('fix bug', { excludeIds: ['doc1'] });
      expect(results.every(r => r.id !== 'doc1')).toBe(true);
    });

    it('respects limit option', async () => {
      const { searchDocuments } = await import('@/utils/searchIndex');
      vi.mocked(searchDocuments).mockReturnValue(
        Array.from({ length: 50 }, (_, i) => ({
          id: `doc${i}`,
          sessionId: 's1',
          query: 'fix bug',
          summary: '',
          analysis: '',
          timestamp: Date.now(),
        }))
      );

      const results = recallByQuery('fix bug', { limit: 5 });
      expect(results.length).toBeLessThanOrEqual(5);
    });
  });

  describe('getHistoryDocuments', () => {
    it('maps searchIndex documents to RecallDocument format', async () => {
      const { getAllDocuments } = await import('@/utils/searchIndex');
      vi.mocked(getAllDocuments).mockReturnValue([
        { id: 'doc1', sessionId: 's1', query: 'test', summary: 'sum', analysis: 'ana', timestamp: 123 },
      ]);

      const docs = getHistoryDocuments();
      expect(docs[0].id).toBe('doc1');
      expect(docs[0].summary).toBe('sum');
      expect(docs[0].analysis).toBe('ana');
    });
  });
});
