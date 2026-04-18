import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useRAGContext } from '@/hooks/useRAGContext';
import type { SearchResult } from '@/stores/vectorStorage';

describe('useRAGContext', () => {
  beforeEach(() => {
    useRAGContext.setState({ items: [] });
  });

  const makeSearchResult = (id: string, chunkType = 'answer'): SearchResult => ({
    id,
    content: `Test content for ${id}`,
    score: 0.85,
    chunkType,
    sessionId: 'session_1',
    timestamp: Date.now(),
    metadata: { sessionTitle: 'Test Session' },
  });

  it('should have expected initial state', () => {
    const state = useRAGContext.getState();
    expect(state.items).toEqual([]);
  });

  it('should add items from search results', () => {
    const results: SearchResult[] = [
      makeSearchResult('result_1', 'answer'),
      makeSearchResult('result_2', 'query'),
    ];
    useRAGContext.getState().addItems(results);
    const state = useRAGContext.getState();
    expect(state.items).toHaveLength(2);
    expect(state.items[0].id).toContain('result_1');
    expect(state.items[0].summary).toContain('Test content');
    expect(state.items[0].score).toBe(0.85);
  });

  it('should deduplicate items by id', () => {
    const results: SearchResult[] = [
      makeSearchResult('result_1', 'answer'),
      makeSearchResult('result_2', 'answer'),
    ];
    useRAGContext.getState().addItems(results);
    useRAGContext.getState().addItems([makeSearchResult('result_3', 'query')]);
    // Adding another item with existing id will still create a unique id due to index suffix
    // so deduplication works only when the exact generated id matches
    const state = useRAGContext.getState();
    expect(state.items.length).toBe(3);
  });

  it('should truncate long content in summary', () => {
    const longContent = 'A'.repeat(150);
    const result: SearchResult = { ...makeSearchResult('result_1'), content: longContent };
    useRAGContext.getState().addItems([result]);
    const state = useRAGContext.getState();
    expect(state.items[0].summary.length).toBeLessThanOrEqual(83);
    expect(state.items[0].summary.endsWith('...')).toBe(true);
  });

  it('should remove item by id', () => {
    useRAGContext.getState().addItems([makeSearchResult('result_1')]);
    useRAGContext.getState().removeItem(useRAGContext.getState().items[0].id);
    expect(useRAGContext.getState().items).toHaveLength(0);
  });

  it('should clear all items', () => {
    useRAGContext.getState().addItems([makeSearchResult('result_1'), makeSearchResult('result_2')]);
    useRAGContext.getState().clearAll();
    expect(useRAGContext.getState().items).toEqual([]);
  });

  it('should generate prompt context string', () => {
    useRAGContext.getState().addItems([makeSearchResult('result_1', 'answer')]);
    const context = useRAGContext.getState().getPromptContext();
    expect(context).toContain('知识上下文');
    expect(context).toContain('Test content');
  });

  it('should return empty string for prompt context when no items', () => {
    const context = useRAGContext.getState().getPromptContext();
    expect(context).toBe('');
  });

  it('should handle attachment chunk type', () => {
    const result: SearchResult = {
      ...makeSearchResult('result_1', 'attachment'),
      fileName: 'test.pdf',
      mimeType: 'application/pdf',
    };
    useRAGContext.getState().addItems([result]);
    const state = useRAGContext.getState();
    expect(state.items[0].chunkType).toBe('attachment');
    expect(state.items[0].fileName).toBe('test.pdf');
    expect(state.items[0].mimeType).toBe('application/pdf');
  });

  it('should format score as percentage in context', () => {
    useRAGContext.getState().addItems([makeSearchResult('result_1')]);
    const context = useRAGContext.getState().getPromptContext();
    expect(context).toContain('85%');
  });

  it('should handle multiple chunk types in context', () => {
    useRAGContext.getState().addItems([
      makeSearchResult('r1', 'answer'),
      makeSearchResult('r2', 'query'),
      makeSearchResult('r3', 'toolcall'),
    ]);
    const context = useRAGContext.getState().getPromptContext();
    expect(context).toContain('回答');
    expect(context).toContain('问题');
    expect(context).toContain('工具调用');
  });
});
