/**
 * V1.4.0 - Compression Trigger Hook
 * Monitors context usage and triggers compression automatically
 */

import { useEffect, useRef, useCallback } from 'react';
import { useCompactionStore } from '../stores/useCompactionStore';
import { useTaskStore } from '../stores/useTaskStore';
import {
  shouldTriggerCompression,
  runCompression,
} from '../utils/diffCompressor';
import type { CompressionTriggerStatus } from '../types/compaction';

/**
 * Hook to monitor context usage and trigger compression
 */
export function useCompressionTrigger() {
  const {
    contextUsage,
    settings,
    setCompressing,
    isCompressing,
    updateContextUsage,
    getCompressionStatus,
  } = useCompactionStore();

  const lastCheckTime = useRef<number>(0);
  const checkInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Subscribe to task store token usage updates
  const { tokenUsage } = useTaskStore();

  // Update context usage when token usage changes
  useEffect(() => {
    if (tokenUsage && tokenUsage.input > 0) {
      updateContextUsage(tokenUsage.input);
    }
  }, [tokenUsage, updateContextUsage]);

  /**
   * Check if compression should trigger
   */
  const checkAndTrigger = useCallback(async () => {
    // Skip if already compressing or disabled
    if (isCompressing) return;
    if (settings.triggerThreshold <= 0) return;

    // Check every 5 seconds max
    const now = Date.now();
    if (now - lastCheckTime.current < 5000) return;
    lastCheckTime.current = now;

    // Check if compression is needed
    const shouldCompress = shouldTriggerCompression(contextUsage, settings);
    if (!shouldCompress) return;

    console.info('[CompressionTrigger] Context usage critical, triggering compression...');

    // Trigger compression
    setCompressing(true);

    try {
      const activeSessionId = useTaskStore.getState().currentQueryId || 'default';
      const report = await runCompression(activeSessionId, settings);

      if (report) {
        console.info(
          `[CompressionTrigger] Compression complete: saved ${report.savingsPct.toFixed(1)}%`
        );
        // Reset context usage after successful compression
        useCompactionStore.getState().resetContextUsage();
      }
    } catch (error) {
      console.error('[CompressionTrigger] Compression failed:', error);
    } finally {
      setCompressing(false);
    }
  }, [contextUsage, settings, isCompressing, setCompressing]);

  /**
   * Manual trigger compression
   */
  const triggerManualCompression = useCallback(async () => {
    if (isCompressing) return;

    console.info('[CompressionTrigger] Manual compression triggered');
    setCompressing(true);

    try {
      const activeSessionId = useTaskStore.getState().currentQueryId || 'default';
      const report = await runCompression(activeSessionId, settings);

      if (report) {
        console.info(
          `[CompressionTrigger] Manual compression complete: saved ${report.savingsPct.toFixed(1)}%`
        );
        useCompactionStore.getState().resetContextUsage();
      }
    } catch (error) {
      console.error('[CompressionTrigger] Manual compression failed:', error);
    } finally {
      setCompressing(false);
    }
  }, [settings, isCompressing, setCompressing]);

  /**
   * Update context usage from token usage events
   */
  const onTokenUsage = useCallback(
    (inputTokens: number) => {
      updateContextUsage(inputTokens);
    },
    [updateContextUsage]
  );

  /**
   * Start monitoring
   */
  useEffect(() => {
    if (settings.triggerThreshold <= 0) return;

    // Check on interval
    checkInterval.current = setInterval(() => {
      checkAndTrigger();
    }, 5000);

    // Check immediately on mount
    checkAndTrigger();

    return () => {
      if (checkInterval.current) {
        clearInterval(checkInterval.current);
      }
    };
  }, [checkAndTrigger, settings.triggerThreshold]);

  return {
    triggerManualCompression,
    onTokenUsage,
    isCompressing,
    compressionStatus: getCompressionStatus(),
  };
}

/**
 * Hook for getting compression status display info
 */
export function useCompressionStatusDisplay(): {
  label: string;
  color: string;
  pct: number;
} {
  const { contextUsage, getCompressionStatus } = useCompactionStore();
  const status = getCompressionStatus();
  const pct = contextUsage.usagePct;

  const statusConfig: Record<CompressionTriggerStatus, { label: string; color: string }> = {
    normal: { label: '正常', color: '#10B981' },
    warning: { label: '警告', color: '#F59E0B' },
    critical: { label: '危险', color: '#EF4444' },
    compressing: { label: '压缩中...', color: '#6366F1' },
  };

  return {
    label: statusConfig[status].label,
    color: statusConfig[status].color,
    pct,
  };
}
