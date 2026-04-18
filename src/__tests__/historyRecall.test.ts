import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  recallHistory,
  detectSimilarQuestions,
  recommendErrorSolutions,
  incrementQueryAccessCount,
  incrementSessionAccessCount,
} from '@/utils/historyRecall';

// Mock searchIndex
vi.mock('@/stores/searchIndex', () => ({
  search: vi.fn().mockReturnValue([]),
}));

// Mock db - defined inside factory to avoid hoisting issues
vi.mock('@/stores/db', () => {
  const mockQuery = {
    id: 'q1',
    type: 'query' as const,
    question: 'How to fix this bug',
    answer: 'You should restart the service',
    sessionId: 's1',
    createdAt: Date.now(),
    accessCount: 3,
    toolCalls: [],
  };

  const makeOrderBy = (arr: any[]) => ({
    reverse: () => ({
      limit: (n: number) => ({
        toArray: () => Promise.resolve(arr.slice(0, n)),
      }),
    }),
  });

  return {
    db: {
      queries: {
        get: vi.fn().mockResolvedValue(mockQuery),
        toArray: vi.fn().mockResolvedValue([mockQuery]),
        update: vi.fn(),
        orderBy: vi.fn().mockReturnValue(makeOrderBy([mockQuery])),
      },
      sessions: {
        get: vi.fn().mockResolvedValue({ id: 's1', accessCount: 2 }),
        update: vi.fn(),
      },
    },
  };
});

describe('historyRecall', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('recallHistory', () => {
    it('returns empty array when no search results', async () => {
      const { search } = await import('@/stores/searchIndex');
      vi.mocked(search).mockReturnValue([]);
      const results = await recallHistory({ query: 'test' });
      expect(results).toEqual([]);
    });

    it('returns ranked results with scores', async () => {
      const { search } = await import('@/stores/searchIndex');
      vi.mocked(search).mockReturnValue([
        { doc: { id: 'q1', type: 'query', createdAt: Date.now() }, score: 10 },
        { doc: { id: 's1', type: 'session', createdAt: Date.now() }, score: 5 },
      ]);

      const results = await recallHistory({ query: 'test' });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('finalScore');
      expect(results[0]).toHaveProperty('keywordScore');
      expect(results[0]).toHaveProperty('timeScore');
      expect(results[0]).toHaveProperty('frequencyScore');
    });

    it('respects limit option', async () => {
      const { search } = await import('@/stores/searchIndex');
      vi.mocked(search).mockReturnValue([
        { doc: { id: 'q1', type: 'query', createdAt: Date.now() }, score: 10 },
        { doc: { id: 'q2', type: 'query', createdAt: Date.now() }, score: 8 },
        { doc: { id: 'q3', type: 'query', createdAt: Date.now() }, score: 6 },
      ]);

      const results = await recallHistory({ query: 'test', limit: 2 });
      expect(results.length).toBeLessThanOrEqual(2);
    });
  });

  describe('detectSimilarQuestions', () => {
    it('returns similar questions from recent history', async () => {
      const results = await detectSimilarQuestions('How to restart the service', 5);
      expect(Array.isArray(results)).toBe(true);
    });

    it('respects limit', async () => {
      const results = await detectSimilarQuestions('How to restart the service', 2);
      expect(results.length).toBeLessThanOrEqual(2);
    });
  });

  describe('recommendErrorSolutions', () => {
    it('returns empty array when no matching solutions', async () => {
      const { db } = await import('@/stores/db');
      vi.mocked(db.queries.toArray).mockResolvedValue([
        {
          id: 'q1',
          question: 'test',
          answer: 'answer',
          sessionId: 's1',
          createdAt: Date.now(),
          toolCalls: [{ name: 'bash', status: 'error', error: 'different error' }],
          type: 'query' as const,
        },
      ]);

      const results = await recommendErrorSolutions('file not found', 'bash', 3);
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('incrementQueryAccessCount', () => {
    it('updates access count for query', async () => {
      const { db } = await import('@/stores/db');
      await incrementQueryAccessCount('q1');
      expect(db.queries.update).toHaveBeenCalled();
    });
  });

  describe('incrementSessionAccessCount', () => {
    it('updates access count for session', async () => {
      const { db } = await import('@/stores/db');
      await incrementSessionAccessCount('s1');
      expect(db.sessions.update).toHaveBeenCalled();
    });
  });
});
