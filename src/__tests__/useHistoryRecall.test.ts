import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { useHistoryRecall } from '@/hooks/useHistoryRecall';

// Mock searchIndex
vi.mock('@/utils/searchIndex', () => ({
  buildSearchIndex: vi.fn().mockResolvedValue(undefined),
  indexDocument: vi.fn(),
  unindexDocument: vi.fn(),
}));

// Mock recall - variables inside factory to avoid hoisting issues
vi.mock('@/utils/recall', () => {
  const mockRankedResult = {
    document: {
      id: 'q1',
      type: 'query' as const,
      query: 'How to fix this bug',
      createdAt: Date.now(),
    },
    finalScore: 0.8,
    keywordScore: 0.6,
    timeScore: 0.9,
    frequencyScore: 0.5,
  };

  const mockSimilarQuery = {
    queryId: 'q1',
    question: 'How to fix this bug',
    answer: 'Restart the service',
    similarity: 0.85,
    sessionId: 's1',
    createdAt: Date.now(),
  };

  return {
    recallByQuery: vi.fn().mockReturnValue([mockRankedResult]),
    findSimilarQueries: vi.fn().mockReturnValue([mockSimilarQuery]),
    recommendErrorSolutions: vi.fn().mockReturnValue([]),
    findSimilarErrorLogs: vi.fn().mockReturnValue([]),
    getHistoryDocuments: vi.fn().mockReturnValue([
      { id: 'q1', type: 'query', query: 'test', createdAt: Date.now() },
    ]),
    incrementUsageCount: vi.fn(),
  };
});

describe('useHistoryRecall', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns hook API surface', async () => {
    const { result } = renderHook(() => useHistoryRecall());

    // Verify API surface is present immediately (hook returns synchronously)
    expect(result.current).toHaveProperty('state');
    expect(result.current).toHaveProperty('onInputChange');
    expect(result.current).toHaveProperty('onToolError');
    expect(result.current).toHaveProperty('dismissSimilarHint');
    expect(result.current).toHaveProperty('dismissErrorHint');
    expect(result.current).toHaveProperty('recordUsage');
    expect(result.current).toHaveProperty('addToIndex');
    expect(result.current).toHaveProperty('removeFromIndex');
    expect(result.current).toHaveProperty('applyRecallResult');

    // Wait for async init to complete
    await waitFor(() => expect(result.current.state.isIndexing).toBe(false), { timeout: 3000 });
  });

  it('initial state has isIndexing=true', () => {
    const { result } = renderHook(() => useHistoryRecall());
    expect(result.current.state.isIndexing).toBe(true);
  });

  it('onInputChange with empty string clears results', async () => {
    const { result } = renderHook(() => useHistoryRecall({ debounceMs: 50 }));
    await waitFor(() => expect(result.current.state.isIndexing).toBe(false), { timeout: 3000 });
    act(() => {
      result.current.onInputChange('test');
    });
    act(() => {
      result.current.onInputChange('');
    });
    expect(result.current.state.rankedResults).toEqual([]);
  });

  it('onToolError does not throw', async () => {
    const { result } = renderHook(() => useHistoryRecall());
    await waitFor(() => expect(result.current.state.isIndexing).toBe(false), { timeout: 3000 });
    expect(() => act(() => { result.current.onToolError('file not found'); })).not.toThrow();
  });

  it('dismissSimilarHint hides similar hint', async () => {
    const { result } = renderHook(() => useHistoryRecall({ debounceMs: 50 }));
    await waitFor(() => expect(result.current.state.isIndexing).toBe(false), { timeout: 3000 });
    act(() => { result.current.dismissSimilarHint(); });
    expect(result.current.state.showSimilarHint).toBe(false);
  });

  it('dismissErrorHint hides error hint', async () => {
    const { result } = renderHook(() => useHistoryRecall());
    await waitFor(() => expect(result.current.state.isIndexing).toBe(false), { timeout: 3000 });
    act(() => { result.current.dismissErrorHint(); });
    expect(result.current.state.showErrorHint).toBe(false);
  });

  it('addToIndex calls indexDocument', async () => {
    const { result } = renderHook(() => useHistoryRecall());
    await waitFor(() => expect(result.current.state.isIndexing).toBe(false), { timeout: 3000 });
    const { indexDocument } = await import('@/utils/searchIndex');
    const record = { id: 'q1', question: 'test', answer: 'answer', sessionId: 's1', createdAt: Date.now() };
    act(() => { result.current.addToIndex(record as any); });
    expect(indexDocument).toHaveBeenCalledWith(record);
  });

  it('removeFromIndex calls unindexDocument', async () => {
    const { result } = renderHook(() => useHistoryRecall());
    await waitFor(() => expect(result.current.state.isIndexing).toBe(false), { timeout: 3000 });
    const { unindexDocument } = await import('@/utils/searchIndex');
    act(() => { result.current.removeFromIndex('q1'); });
    expect(unindexDocument).toHaveBeenCalledWith('q1');
  });

  it('applyRecallResult returns doc query', async () => {
    const { result } = renderHook(() => useHistoryRecall());
    await waitFor(() => expect(result.current.state.isIndexing).toBe(false), { timeout: 3000 });
    const query = result.current.applyRecallResult({
      document: { id: 'q1', type: 'query' as const, query: 'How to fix this bug', createdAt: Date.now() },
      finalScore: 0.8,
      keywordScore: 0.6,
      timeScore: 0.9,
      frequencyScore: 0.5,
    });
    expect(query).toBe('How to fix this bug');
  });
});
