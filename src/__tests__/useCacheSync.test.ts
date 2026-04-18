import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { useCacheSync } from '@/hooks/useCacheSync';

// Mock CacheSyncEngine
const mockEngineInstance = {
  loadSessionsCacheFirst: vi.fn().mockResolvedValue([]),
  writeSessionImmediately: vi.fn().mockResolvedValue(undefined),
  writeSessionDebounced: vi.fn(),
  flushAllPending: vi.fn().mockResolvedValue(undefined),
  pushToServer: vi.fn().mockResolvedValue([]),
  deleteSession: vi.fn().mockResolvedValue(undefined),
  destroy: vi.fn(),
  onStateChange: null as ((state: any) => void) | null,
  serverSync: vi.fn(),
};

vi.mock('@/stores/cacheSync', () => ({
  CacheSyncEngine: vi.fn().mockImplementation(() => ({
    ...mockEngineInstance,
    loadSessionsCacheFirst: mockEngineInstance.loadSessionsCacheFirst,
    writeSessionImmediately: mockEngineInstance.writeSessionImmediately,
    writeSessionDebounced: mockEngineInstance.writeSessionDebounced,
    flushAllPending: mockEngineInstance.flushAllPending,
    pushToServer: mockEngineInstance.pushToServer,
    deleteSession: mockEngineInstance.deleteSession,
    destroy: mockEngineInstance.destroy,
  })),
}));

describe('useCacheSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns hook API surface', () => {
    const { result } = renderHook(() => useCacheSync());
    expect(result.current).toHaveProperty('syncStatus');
    expect(result.current).toHaveProperty('loadSessions');
    expect(result.current).toHaveProperty('writeSessionImmediately');
    expect(result.current).toHaveProperty('writeSessionDebounced');
    expect(result.current).toHaveProperty('flushAllPending');
    expect(result.current).toHaveProperty('pushToServer');
    expect(result.current).toHaveProperty('deleteSession');
  });

  it('loadSessions calls engine', async () => {
    const { result } = renderHook(() => useCacheSync());
    await act(async () => {
      await result.current.loadSessions(10);
    });
    expect(mockEngineInstance.loadSessionsCacheFirst).toHaveBeenCalledWith(10);
  });

  it('writeSessionImmediately calls engine', async () => {
    const { result } = renderHook(() => useCacheSync());
    await act(async () => {
      await result.current.writeSessionImmediately({
        id: 's1',
        name: 'Test',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isActive: false,
        queryCount: 0,
        tokenCount: 0,
      });
    });
    expect(mockEngineInstance.writeSessionImmediately).toHaveBeenCalled();
  });

  it('writeSessionDebounced calls engine', () => {
    const { result } = renderHook(() => useCacheSync());
    act(() => {
      result.current.writeSessionDebounced('s1', { name: 'Updated' });
    });
    expect(mockEngineInstance.writeSessionDebounced).toHaveBeenCalledWith('s1', { name: 'Updated' });
  });

  it('flushAllPending calls engine', async () => {
    const { result } = renderHook(() => useCacheSync());
    await act(async () => {
      await result.current.flushAllPending();
    });
    expect(mockEngineInstance.flushAllPending).toHaveBeenCalled();
  });

  it('deleteSession calls engine', async () => {
    const { result } = renderHook(() => useCacheSync());
    await act(async () => {
      await result.current.deleteSession('s1');
    });
    expect(mockEngineInstance.deleteSession).toHaveBeenCalledWith('s1');
  });
});
