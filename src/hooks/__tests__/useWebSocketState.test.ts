import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWebSocketState } from '../useWebSocketState';

// Mock createLogger
vi.mock('../../utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('useWebSocketState', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const BASE_OPTIONS = {
    url: 'ws://localhost:5300',
    onReconnect: vi.fn(),
    onConnected: vi.fn(),
    onDisconnected: vi.fn(),
  };

  it('初始状态为 disconnected', () => {
    const { result } = renderHook(() => useWebSocketState(BASE_OPTIONS));
    expect(result.current.connectionState).toBe('disconnected');
    expect(result.current.retryCount).toBe(0);
  });

  it('manualReconnect 切换到 connecting 并触发 onReconnect', () => {
    const { result } = renderHook(() => useWebSocketState(BASE_OPTIONS));

    act(() => {
      result.current.manualReconnect();
    });

    expect(result.current.connectionState).toBe('connecting');
    expect(BASE_OPTIONS.onReconnect).toHaveBeenCalledTimes(1);
  });

  it('reportConnected 切换到 connected 并重置 retryCount', () => {
    const { result } = renderHook(() => useWebSocketState(BASE_OPTIONS));

    act(() => {
      result.current.manualReconnect();
      result.current.reportConnected();
    });

    expect(result.current.connectionState).toBe('connected');
    expect(result.current.retryCount).toBe(0);
    expect(BASE_OPTIONS.onConnected).toHaveBeenCalledTimes(1);
  });

  it('connected 状态下 reportDisconnected 切换到 reconnecting 并安排定时器', () => {
    const { result } = renderHook(() => useWebSocketState(BASE_OPTIONS));

    act(() => {
      result.current.manualReconnect();
      result.current.reportConnected();
    });

    act(() => {
      result.current.reportDisconnected();
    });

    expect(result.current.connectionState).toBe('reconnecting');
    expect(result.current.retryCount).toBe(0);
  });

  it('reconnecting 状态在定时器到期后切换到 connecting 并触发 onReconnect', () => {
    const { result } = renderHook(() => useWebSocketState(BASE_OPTIONS));

    act(() => {
      result.current.manualReconnect();
      result.current.reportConnected();
      result.current.reportDisconnected();
    });

    BASE_OPTIONS.onReconnect.mockClear();

    act(() => {
      vi.advanceTimersByTime(5_000); // 第一次延迟 5s
    });

    expect(result.current.connectionState).toBe('connecting');
    expect(result.current.retryCount).toBe(0);
    expect(BASE_OPTIONS.onReconnect).toHaveBeenCalledTimes(1);
  });

  it('指数退避：第一次重连 5s，第二次 10s，第三次 30s', () => {
    const { result } = renderHook(() => useWebSocketState(BASE_OPTIONS));

    // 进入 reconnecting
    act(() => {
      result.current.manualReconnect();
      result.current.reportConnected();
      result.current.reportDisconnected();
    });

    // 第 1 次重连尝试 (retryCount=0)
    act(() => { vi.advanceTimersByTime(5_000); });
    expect(result.current.connectionState).toBe('connecting');

    // 再次断开
    act(() => { result.current.reportDisconnected(); });
    expect(result.current.connectionState).toBe('reconnecting');
    expect(result.current.retryCount).toBe(1);

    // 第 2 次重连尝试 (retryCount=1) → 10s
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(result.current.connectionState).toBe('connecting');

    // 再次断开
    act(() => { result.current.reportDisconnected(); });
    expect(result.current.connectionState).toBe('reconnecting');
    expect(result.current.retryCount).toBe(2);

    // 第 3 次重连尝试 (retryCount=2) → 30s
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(result.current.connectionState).toBe('connecting');
  });

  it('超过 3 次重试后进入 failed 状态', () => {
    const { result } = renderHook(() => useWebSocketState(BASE_OPTIONS));

    act(() => {
      result.current.manualReconnect();
      result.current.reportConnected();
      result.current.reportDisconnected();
    });

    // 第一次重连
    act(() => { vi.advanceTimersByTime(5_000); });
    act(() => { result.current.reportDisconnected(); });

    // 第二次重连
    act(() => { vi.advanceTimersByTime(10_000); });
    act(() => { result.current.reportDisconnected(); });

    // 第三次重连
    act(() => { vi.advanceTimersByTime(30_000); });
    act(() => { result.current.reportDisconnected(); });

    expect(result.current.connectionState).toBe('failed');
  });

  it('failed 状态下 manualReconnect 重新开始', () => {
    const { result } = renderHook(() => useWebSocketState(BASE_OPTIONS));

    act(() => {
      result.current.manualReconnect();
      result.current.reportConnected();
      result.current.reportDisconnected();
    });

    // 全部重试耗尽
    act(() => { vi.advanceTimersByTime(5_000); });
    act(() => { result.current.reportDisconnected(); });
    act(() => { vi.advanceTimersByTime(10_000); });
    act(() => { result.current.reportDisconnected(); });
    act(() => { vi.advanceTimersByTime(30_000); });
    act(() => { result.current.reportDisconnected(); });

    expect(result.current.connectionState).toBe('failed');

    act(() => {
      result.current.manualReconnect();
    });

    expect(result.current.connectionState).toBe('connecting');
    expect(result.current.retryCount).toBe(0);
  });

  it('reset 切换到 disconnected 并重置 retryCount', () => {
    const { result } = renderHook(() => useWebSocketState(BASE_OPTIONS));

    act(() => {
      result.current.manualReconnect();
      result.current.reportConnected();
      result.current.reportDisconnected();
    });
    act(() => { vi.advanceTimersByTime(5_000); });
    act(() => { result.current.reportDisconnected(); });

    expect(result.current.connectionState).toBe('reconnecting');
    expect(result.current.retryCount).toBe(1);

    act(() => {
      result.current.reset();
    });

    expect(result.current.connectionState).toBe('disconnected');
    expect(result.current.retryCount).toBe(0);
  });

  it('reportConnected 在 reconnecting 状态取消待执行的定时器', () => {
    const { result } = renderHook(() => useWebSocketState(BASE_OPTIONS));

    act(() => {
      result.current.manualReconnect();
      result.current.reportConnected();
      result.current.reportDisconnected();
    });

    act(() => {
      vi.advanceTimersByTime(2_000); // 只过去 2s，还没到 5s
    });

    act(() => {
      result.current.reportConnected();
    });

    // 状态应为 connected，不会再次触发 onReconnect
    expect(result.current.connectionState).toBe('connected');
  });

  it('reportError 在 connected 状态触发重连', () => {
    const { result } = renderHook(() => useWebSocketState(BASE_OPTIONS));

    act(() => {
      result.current.manualReconnect();
      result.current.reportConnected();
    });

    BASE_OPTIONS.onReconnect.mockClear();

    act(() => {
      result.current.reportError();
    });

    expect(result.current.connectionState).toBe('reconnecting');
    expect(result.current.retryCount).toBe(0);
  });
});
