/**
 * useSearch Hook — 搜索功能的核心 Hook
 *
 * 功能：
 * - 150ms 防抖搜索
 * - 搜索历史管理（最近 10 条，存于 sessionStorage）
 * - 高级筛选（日期范围、工具类型）
 * - 高亮关键词提取
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  search,
  buildSearchIndex,
  getAllTags,
  getAllToolTypes,
  type SearchOptions,
  type SearchResult,
} from '@/stores/searchIndex';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DateRange {
  from?: number;
  to?: number;
}

export interface SearchFilters {
  dateRange: DateRange;
  tags: string[];
  toolTypes: string[];
}

const DEBOUNCE_MS = 150;
const MAX_HISTORY = 10;
const HISTORY_KEY = 'cc-search-history';

// ---------------------------------------------------------------------------
// Search History (sessionStorage)
// ---------------------------------------------------------------------------

function loadHistory(): string[] {
  try {
    const raw = sessionStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

function saveHistory(history: string[]): void {
  try {
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // ignore
  }
}

function addToHistory(query: string): void {
  if (!query.trim()) return;
  const history = loadHistory().filter(h => h !== query);
  const next = [query, ...history].slice(0, MAX_HISTORY);
  saveHistory(next);
}

function clearHistory(): void {
  sessionStorage.removeItem(HISTORY_KEY);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isIndexReady, setIsIndexReady] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    dateRange: {},
    tags: [],
    toolTypes: [],
  });
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [availableToolTypes, setAvailableToolTypes] = useState<string[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQueryRef = useRef('');

  // 构建索引
  useEffect(() => {
    buildSearchIndex()
      .then(() => {
        setIsIndexReady(true);
        setAvailableTags(getAllTags());
        setAvailableToolTypes(getAllToolTypes());
        setHistory(loadHistory());
      })
      .catch(err => {
        console.error('[useSearch] Failed to build index:', err);
      });
  }, []);

  // 执行搜索（带防抖）
  const doSearch = useCallback((q: string, opts: SearchFilters) => {
    if (!isIndexReady) return;

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (!q.trim()) {
      setResults([]);
      setSelectedIndex(-1);
      return;
    }

    setIsLoading(true);
    debounceTimer.current = setTimeout(() => {
      const searchOpts: SearchOptions = {
        query: q,
        dateFrom: opts.dateRange.from,
        dateTo: opts.dateRange.to,
        tags: opts.tags,
        toolTypes: opts.toolTypes,
        limit: 20,
      };
      const res = search(searchOpts);
      setResults(res);
      setSelectedIndex(-1);
      setIsLoading(false);
    }, DEBOUNCE_MS);
  }, [isIndexReady]);

  // query 变化时触发搜索
  useEffect(() => {
    doSearch(query, filters);
  }, [query, filters, doSearch]);

  // 提交搜索（记录历史）
  const submitSearch = useCallback((q: string) => {
    if (!q.trim()) return;
    addToHistory(q);
    setHistory(loadHistory());
    lastQueryRef.current = q;
  }, []);

  // 键盘导航
  const moveSelection = useCallback((direction: 'up' | 'down'): number => {
    const maxIndex = results.length - 1;
    setSelectedIndex(prev => {
      if (prev === -1) {
        return direction === 'down' ? 0 : maxIndex;
      }
      if (direction === 'down') {
        return prev < maxIndex ? prev + 1 : 0;
      } else {
        return prev > 0 ? prev - 1 : maxIndex;
      }
    });
    // 返回新的选中索引
    const next = direction === 'down'
      ? (selectedIndex < maxIndex ? selectedIndex + 1 : 0)
      : (selectedIndex > 0 ? selectedIndex - 1 : maxIndex);
    return next;
  }, [results.length, selectedIndex]);

  // 更新筛选器
  const updateFilters = useCallback((updates: Partial<SearchFilters>) => {
    setFilters(prev => ({ ...prev, ...updates }));
  }, []);

  // 清除所有筛选
  const clearFilters = useCallback(() => {
    setFilters({ dateRange: {}, tags: [], toolTypes: [] });
  }, []);

  // 删除单条历史
  const removeHistoryItem = useCallback((item: string) => {
    const next = loadHistory().filter(h => h !== item);
    saveHistory(next);
    setHistory(next);
  }, []);

  // 获取高亮文本（用于在结果中标记匹配的关键词）
  const highlightQuery = useCallback((text: string): string => {
    if (!query.trim()) return text;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>');
  }, [query]);

  return {
    // 状态
    query,
    setQuery,
    results,
    isLoading,
    isIndexReady,
    filters,
    availableTags,
    availableToolTypes,
    history,
    selectedIndex,

    // 操作
    submitSearch,
    moveSelection,
    updateFilters,
    clearFilters,
    removeHistoryItem,
    clearHistory,
    highlightQuery,

    // 索引刷新（外部可在新增数据后调用）
    refreshIndex: async () => {
      await buildSearchIndex();
      setAvailableTags(getAllTags());
      setAvailableToolTypes(getAllToolTypes());
    },
  };
}
