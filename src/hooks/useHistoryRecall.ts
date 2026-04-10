/**
 * useHistoryRecall — 历史召回 Hook
 *
 * 提供：
 * - 相似问题检测（输入时实时检测）
 * - 错误解决方案推荐（工具调用失败时触发）
 * - 召回推荐列表（展示在输入区域上方）
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  buildSearchIndex,
  indexDocument,
  unindexDocument,
} from '@/utils/searchIndex';
import {
  recallByQuery,
  findSimilarQueries,
  recommendErrorSolutions,
  findSimilarErrorLogs,
  getHistoryDocuments,
  incrementUsageCount,
  type RankedResult,
  type SimilarQuery,
  type ErrorSolution,
} from '@/utils/recall';
import type { QueryRecord } from '@/lib/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RecallState {
  /** 是否正在加载索引 */
  isIndexing: boolean;
  /** 索引文档数量 */
  indexedCount: number;
  /** 当前输入的召回结果 */
  rankedResults: RankedResult[];
  /** 相似问题列表 */
  similarQueries: SimilarQuery[];
  /** 是否显示相似问题提示 */
  showSimilarHint: boolean;
  /** 错误解决方案推荐 */
  errorSolutions: ErrorSolution[];
  /** 是否显示错误方案提示 */
  showErrorHint: boolean;
  /** 初始欢迎提示（索引完成后推荐历史内容） */
  welcomeSuggestions: RankedResult[];
}

interface UseHistoryRecallOptions {
  /** 输入变化时自动触发召回的防抖延迟（ms） */
  debounceMs?: number;
  /** 相似度阈值（默认 0.8） */
  similarityThreshold?: number;
  /** 最大推荐数量 */
  maxResults?: number;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useHistoryRecall(options: UseHistoryRecallOptions = {}) {
  const {
    debounceMs = 300,
    similarityThreshold = 0.8,
    maxResults = 5,
  } = options;

  const [state, setState] = useState<RecallState>({
    isIndexing: true,
    indexedCount: 0,
    rankedResults: [],
    similarQueries: [],
    showSimilarHint: false,
    errorSolutions: [],
    showErrorHint: false,
    welcomeSuggestions: [],
  });

  /** 防抖定时器引用 */
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 上一次输入（避免重复处理） */
  const lastInputRef = useRef<string>('');

  // ---------------------------------------------------------------------------
  // Initialize search index
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        await buildSearchIndex();

        if (cancelled) return;

        const allDocs = getHistoryDocuments();
        const recent = recallByQuery('', { limit: maxResults });

        setState(prev => ({
          ...prev,
          isIndexing: false,
          indexedCount: allDocs.length,
          welcomeSuggestions: recent,
        }));
      } catch (err) {
        console.error('[useHistoryRecall] Index build failed:', err);
        if (!cancelled) {
          setState(prev => ({ ...prev, isIndexing: false }));
        }
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Recall on input change
  // ---------------------------------------------------------------------------

  const onInputChange = useCallback(
    (input: string) => {
      // 清除上一次的防抖定时器
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }

      // 空输入：恢复欢迎推荐
      if (!input.trim()) {
        lastInputRef.current = '';
        setState(prev => ({
          ...prev,
          rankedResults: [],
          similarQueries: [],
          showSimilarHint: false,
        }));
        return;
      }

      // 防抖
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;

        // 避免重复处理相同的输入
        if (input === lastInputRef.current) return;
        lastInputRef.current = input;

        // 1. 召回排序推荐
        const ranked = recallByQuery(input, { limit: maxResults });

        // 2. 相似问题检测
        const allDocs = getHistoryDocuments();
        const similar = findSimilarQueries(
          allDocs,
          input,
          similarityThreshold,
          maxResults
        );

        setState(prev => ({
          ...prev,
          rankedResults: ranked,
          similarQueries: similar,
          showSimilarHint: similar.length > 0,
        }));
      }, debounceMs);
    },
    [debounceMs, similarityThreshold, maxResults]
  );

  // ---------------------------------------------------------------------------
  // Error solution recommendation
  // ---------------------------------------------------------------------------

  const onToolError = useCallback(
    (errorMessage: string) => {
      if (!errorMessage.trim()) return;

      const allDocs = getHistoryDocuments();

      // 从历史记录推荐相似错误的解决方案
      const solutions = recommendErrorSolutions(errorMessage, allDocs, 0.6, maxResults);

      // 同时从错误日志推荐
      const errorLogs = findSimilarErrorLogs(errorMessage, 0.6, maxResults);

      setState(prev => ({
        ...prev,
        errorSolutions: solutions,
        showErrorHint: solutions.length > 0 || errorLogs.length > 0,
      }));
    },
    [maxResults]
  );

  // ---------------------------------------------------------------------------
  // Dismiss hints
  // ---------------------------------------------------------------------------

  const dismissSimilarHint = useCallback(() => {
    setState(prev => ({ ...prev, showSimilarHint: false }));
  }, []);

  const dismissErrorHint = useCallback(() => {
    setState(prev => ({ ...prev, showErrorHint: false }));
  }, []);

  // ---------------------------------------------------------------------------
  // Record usage (for usage score)
  // ---------------------------------------------------------------------------

  const recordUsage = useCallback((docId: string) => {
    incrementUsageCount(docId);
  }, []);

  // ---------------------------------------------------------------------------
  // Sync new query into search index
  // ---------------------------------------------------------------------------

  const addToIndex = useCallback((record: QueryRecord) => {
    indexDocument(record);
    setState(prev => ({
      ...prev,
      indexedCount: prev.indexedCount + 1,
    }));
  }, []);

  const removeFromIndex = useCallback((docId: string) => {
    unindexDocument(docId);
    setState(prev => ({
      ...prev,
      indexedCount: Math.max(0, prev.indexedCount - 1),
    }));
  }, []);

  // ---------------------------------------------------------------------------
  // Apply recall result (select a recommended query)
  // ---------------------------------------------------------------------------

  const applyRecallResult = useCallback(
    (result: RankedResult | SimilarQuery) => {
      const doc = 'document' in result ? result.document : result;
      recordUsage(doc.id);
      return doc.query;
    },
    [recordUsage]
  );

  // ---------------------------------------------------------------------------
  // Cleanup on unmount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    state,
    onInputChange,
    onToolError,
    dismissSimilarHint,
    dismissErrorHint,
    recordUsage,
    addToIndex,
    removeFromIndex,
    applyRecallResult,
  };
}
