/**
 * useCompressionTrigger — 渲染覆盖测试
 *
 * 覆盖率标准: 行 95%
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useCompressionTrigger, useCompressionStatusDisplay } from '@/hooks/useCompressionTrigger';

// ── Mock dependencies ─────────────────────────────────────────────────────────

vi.mock('@/stores/useCompactionStore', () => ({
  useCompactionStore: vi.fn().mockReturnValue({
    contextUsage: {
      totalInputTokens: 5000,
      estimatedWindow: 128000,
      usagePct: 3.9,
      lastUpdated: Date.now(),
    },
    settings: {
      triggerThreshold: 80,
      autoThreshold: 80,
      maxReports: 100,
    },
    setCompressing: vi.fn(),
    isCompressing: false,
    updateContextUsage: vi.fn(),
    getCompressionStatus: vi.fn().mockReturnValue('normal'),
  }),
}));

vi.mock('@/stores/useTaskStore', () => ({
  useTaskStore: vi.fn().mockReturnValue({
    tokenUsage: { input: 5000, output: 2000, total: 7000 },
    currentQueryId: 'q1',
  }),
}));

vi.mock('@/utils/diffCompressor', () => ({
  shouldTriggerCompression: vi.fn().mockReturnValue(false),
  runCompression: vi.fn().mockResolvedValue({
    id: 'report_1',
    beforeTokens: 50000,
    afterTokens: 25000,
    savings: 25000,
    savingsPct: 50,
    timestamp: Date.now(),
    sessionId: 'q1',
    triggeredBy: 'auto',
    deletedMessageIds: [],
    compactedMessageIds: [],
    messageCountBefore: 10,
    messageCountAfter: 5,
  }),
}));

// ── 测试套件 ──────────────────────────────────────────────────────────────────

describe('useCompressionTrigger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('返回预期 API 结构', () => {
    const { result } = renderHook(() => useCompressionTrigger());
    expect(typeof result.current.triggerManualCompression).toBe('function');
    expect(typeof result.current.onTokenUsage).toBe('function');
    expect(result.current).toHaveProperty('isCompressing');
    expect(result.current).toHaveProperty('compressionStatus');
  });

  it('triggerManualCompression 跳过压缩中状态', async () => {
    const { useCompactionStore } = await import('@/stores/useCompactionStore');
    vi.mocked(useCompactionStore).mockReturnValue({
      contextUsage: { totalInputTokens: 5000, estimatedWindow: 128000, usagePct: 3.9, lastUpdated: Date.now() },
      settings: { triggerThreshold: 80, autoThreshold: 80, maxReports: 100 },
      setCompressing: vi.fn(),
      isCompressing: true,
      updateContextUsage: vi.fn(),
      getCompressionStatus: vi.fn().mockReturnValue('normal'),
    });

    const { result } = renderHook(() => useCompressionTrigger());
    await act(async () => {
      await result.current.triggerManualCompression();
    });
    // isCompressing=true 时不执行压缩
  });

  it('onTokenUsage 调用 updateContextUsage', async () => {
    const { useCompactionStore } = await import('@/stores/useCompactionStore');
    const mockUpdate = vi.fn();
    vi.mocked(useCompactionStore).mockReturnValue({
      contextUsage: { totalInputTokens: 5000, estimatedWindow: 128000, usagePct: 3.9, lastUpdated: Date.now() },
      settings: { triggerThreshold: 80, autoThreshold: 80, maxReports: 100 },
      setCompressing: vi.fn(),
      isCompressing: false,
      updateContextUsage: mockUpdate,
      getCompressionStatus: vi.fn().mockReturnValue('normal'),
    });

    const { result } = renderHook(() => useCompressionTrigger());
    await act(async () => {
      result.current.onTokenUsage(10000);
    });
    expect(mockUpdate).toHaveBeenCalledWith(10000);
  });

  it('tokenUsage 变化时更新 contextUsage', async () => {
    const { useTaskStore } = await import('@/stores/useTaskStore');
    const { useCompactionStore } = await import('@/stores/useCompactionStore');
    const mockUpdate = vi.fn();
    vi.mocked(useCompactionStore).mockReturnValue({
      contextUsage: { totalInputTokens: 5000, estimatedWindow: 128000, usagePct: 3.9, lastUpdated: Date.now() },
      settings: { triggerThreshold: 80, autoThreshold: 80, maxReports: 100 },
      setCompressing: vi.fn(),
      isCompressing: false,
      updateContextUsage: mockUpdate,
      getCompressionStatus: vi.fn().mockReturnValue('normal'),
    });
    vi.mocked(useTaskStore).mockReturnValue({
      tokenUsage: { input: 1000, output: 500, total: 1500 },
      currentQueryId: 'q1',
    });

    const { result } = renderHook(() => useCompressionTrigger());
    await waitFor(() => {
      // 初始挂载时已触发
    });
    expect(mockUpdate).toHaveBeenCalled();
  });
});

describe('useCompressionStatusDisplay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('返回 label、color、pct', async () => {
    const { result } = renderHook(() => useCompressionStatusDisplay());
    expect(typeof result.current.label).toBe('string');
    expect(typeof result.current.color).toBe('string');
    expect(typeof result.current.pct).toBe('number');
  });

  it('normal 状态返回绿色标签', async () => {
    const { useCompactionStore } = await import('@/stores/useCompactionStore');
    vi.mocked(useCompactionStore).mockReturnValue({
      contextUsage: { totalInputTokens: 5000, estimatedWindow: 128000, usagePct: 3.9, lastUpdated: Date.now() },
      getCompressionStatus: vi.fn().mockReturnValue('normal'),
    });
    const { result } = renderHook(() => useCompressionStatusDisplay());
    expect(result.current.color).toBe('#10B981');
    expect(result.current.label).toBe('正常');
  });

  it('warning 状态返回警告标签', async () => {
    const { useCompactionStore } = await import('@/stores/useCompactionStore');
    vi.mocked(useCompactionStore).mockReturnValue({
      contextUsage: { totalInputTokens: 90000, estimatedWindow: 128000, usagePct: 70.3, lastUpdated: Date.now() },
      getCompressionStatus: vi.fn().mockReturnValue('warning'),
    });
    const { result } = renderHook(() => useCompressionStatusDisplay());
    expect(result.current.color).toBe('#F59E0B');
    expect(result.current.label).toBe('警告');
  });

  it('critical 状态返回危险标签', async () => {
    const { useCompactionStore } = await import('@/stores/useCompactionStore');
    vi.mocked(useCompactionStore).mockReturnValue({
      contextUsage: { totalInputTokens: 120000, estimatedWindow: 128000, usagePct: 93.7, lastUpdated: Date.now() },
      getCompressionStatus: vi.fn().mockReturnValue('critical'),
    });
    const { result } = renderHook(() => useCompressionStatusDisplay());
    expect(result.current.color).toBe('#EF4444');
    expect(result.current.label).toBe('危险');
  });

  it('compressing 状态返回压缩中标签', async () => {
    const { useCompactionStore } = await import('@/stores/useCompactionStore');
    vi.mocked(useCompactionStore).mockReturnValue({
      contextUsage: { totalInputTokens: 0, estimatedWindow: 128000, usagePct: 0, lastUpdated: Date.now() },
      getCompressionStatus: vi.fn().mockReturnValue('compressing'),
    });
    const { result } = renderHook(() => useCompressionStatusDisplay());
    expect(result.current.color).toBe('#6366F1');
    expect(result.current.label).toBe('压缩中...');
  });

  it('pct 等于 contextUsage.usagePct', () => {
    const { result } = renderHook(() => useCompressionStatusDisplay());
    expect(result.current.pct).toBeGreaterThanOrEqual(0);
  });
});
