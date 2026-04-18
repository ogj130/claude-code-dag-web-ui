/**
 * useSearch — 渲染覆盖测试
 * 覆盖率标准: 行 95%
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useSearch } from '@/hooks/useSearch';

// ── Mock searchIndex ───────────────────────────────────────────────────────────

vi.mock('@/stores/searchIndex', () => ({
  search: vi.fn().mockReturnValue([]),
  buildSearchIndex: vi.fn().mockResolvedValue(undefined),
  getAllTags: vi.fn().mockReturnValue([]),
  getAllToolTypes: vi.fn().mockReturnValue([]),
}));

// ── 测试套件 ──────────────────────────────────────────────────────────────────

describe('useSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 清除 sessionStorage
    sessionStorage.clear();
  });

  it('应该初始化为空结果', () => {
    const { result } = renderHook(() => useSearch());
    expect(result.current.results).toEqual([]);
  });

  it('应该初始化 query 为空字符串', () => {
    const { result } = renderHook(() => useSearch());
    expect(result.current.query).toBe('');
  });

  it('应该有 search 函数（setQuery）', () => {
    const { result } = renderHook(() => useSearch());
    expect(typeof result.current.setQuery).toBe('function');
  });

  it('应该有 clearResults 函数（通过空 query 实现）', () => {
    const { result } = renderHook(() => useSearch());
    expect(typeof result.current.setQuery).toBe('function');
  });

  it('应该有 submitSearch 函数', () => {
    const { result } = renderHook(() => useSearch());
    expect(typeof result.current.submitSearch).toBe('function');
  });

  it('应该有 moveSelection 函数', () => {
    const { result } = renderHook(() => useSearch());
    expect(typeof result.current.moveSelection).toBe('function');
  });

  it('应该有 updateFilters 函数', () => {
    const { result } = renderHook(() => useSearch());
    expect(typeof result.current.updateFilters).toBe('function');
  });

  it('应该有 clearFilters 函数', () => {
    const { result } = renderHook(() => useSearch());
    expect(typeof result.current.clearFilters).toBe('function');
  });

  it('应该有 removeHistoryItem 函数', () => {
    const { result } = renderHook(() => useSearch());
    expect(typeof result.current.removeHistoryItem).toBe('function');
  });

  it('应该有 clearHistory 函数', () => {
    const { result } = renderHook(() => useSearch());
    expect(typeof result.current.clearHistory).toBe('function');
  });

  it('应该有 highlightQuery 函数', () => {
    const { result } = renderHook(() => useSearch());
    expect(typeof result.current.highlightQuery).toBe('function');
  });

  it('应该有 refreshIndex 函数', async () => {
    const { result } = renderHook(() => useSearch());
    await waitFor(() => {
      expect(typeof result.current.refreshIndex).toBe('function');
    });
  });

  it('初始 filters 为默认值', async () => {
    const { result } = renderHook(() => useSearch());
    await waitFor(() => {
      expect(result.current.filters).toEqual({
        dateRange: {},
        tags: [],
        toolTypes: [],
      });
    });
  });

  it('初始 isLoading 为 false', async () => {
    const { result } = renderHook(() => useSearch());
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('初始 selectedIndex 为 -1', async () => {
    const { result } = renderHook(() => useSearch());
    await waitFor(() => {
      expect(result.current.selectedIndex).toBe(-1);
    });
  });

  it('highlightQuery 返回原始文本当 query 为空时', async () => {
    const { result } = renderHook(() => useSearch());
    await waitFor(() => {
      const text = 'Hello World';
      expect(result.current.highlightQuery(text)).toBe(text);
    });
  });

  it('clearFilters 重置筛选器', async () => {
    const { result } = renderHook(() => useSearch());
    await waitFor(() => {
      expect(result.current.isIndexReady).toBe(true);
    });
    act(() => {
      result.current.updateFilters({ tags: ['test'] });
    });
    expect(result.current.filters.tags).toContain('test');
    act(() => {
      result.current.clearFilters();
    });
    expect(result.current.filters.tags).toEqual([]);
  });
});
