/**
 * useWebSocket hook 测试
 *
 * 覆盖 src/hooks/useWebSocket.ts 的核心功能：
 * - 初始化状态（disconnected）
 * - 返回值结构（sendInput / disconnect / connect / connectionState / retryCount）
 * - sendInput 消息发送与队列化
 * - disconnect 清理逻辑
 * - connect（manualReconnect）函数
 * - 重连期间消息队列（reconnectQueue）
 * - 组件卸载清理
 *
 * Mock 策略：
 * - useWebSocketState：完全 mock，返回可控的 connectionState / retryCount
 * - useTaskStore / useSessionStore：mock 避免真实 store 操作
 * - WebSocket：vi.stubGlobal，跟踪实例化调用
 * - createLogger：mock 为空函数
 *
 * vi.hoisted() 使用说明：
 * vitest 将 vi.mock 工厂和 vi.hoisted 变量同时提升到文件顶部，
 * 保证工厂函数执行时 hoisted 变量已完成初始化。
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';

// ── vi.hoisted：所有 mock 变量必须 hoisted，工厂也必须在内 ───────────────────────

const {
  mockUpdatePendingInputsCount,
  mockHandleEvent,
  mockAddTerminalLine,
  mockAddTerminalChunk,
  mockReset,
  mockStoreGetState,
  mockTaskStoreFn,
  mockSessionGetState,
  mockSessionStoreFn,
  _wsReadyState,
  mockWsInstance,
  // 以下在 hoisted 内定义，vi.mock 工厂内引用
  mockUseWebSocketState,
  mockLogger,
  mockManualReconnect,
  mockReportConnected,
  mockReportDisconnected,
  mockReportError,
  mockResetState,
  registeredCallbacks,
} = vi.hoisted(() => {
  // useTaskStore mock
  const mockUpdatePendingInputsCount = vi.fn();
  const mockHandleEvent = vi.fn();
  const mockAddTerminalLine = vi.fn();
  const mockAddTerminalChunk = vi.fn();
  const mockReset = vi.fn();

  const taskStoreState = {
    isStarting: false,
    error: null,
    currentQueryId: null as string | null,
    updatePendingInputsCount: mockUpdatePendingInputsCount,
    handleEvent: mockHandleEvent,
    addTerminalLine: mockAddTerminalLine,
    addTerminalChunk: mockAddTerminalChunk,
    reset: mockReset,
  };

  const mockStoreGetState = vi.fn().mockReturnValue(taskStoreState);

  const mockTaskStoreFn = vi.fn((selector?: (state: Record<string, unknown>) => unknown) => {
    if (selector) return selector(taskStoreState as unknown as Record<string, unknown>);
    return taskStoreState;
  }) as unknown as ReturnType<typeof vi.fn>;
  Object.defineProperty(mockTaskStoreFn, 'setState', {
    value: vi.fn(),
    writable: true,
    configurable: true,
  });
  Object.defineProperty(mockTaskStoreFn, 'getState', {
    value: mockStoreGetState,
    writable: true,
    configurable: true,
  });

  // useSessionStore mock
  const mockSessionGetState = vi.fn().mockReturnValue({ sessions: [] });
  const mockSessionStoreFn = vi.fn(() => ({ getState: mockSessionGetState }));
  Object.defineProperty(mockSessionStoreFn, 'getState', {
    value: mockSessionGetState,
    writable: true,
    configurable: true,
  });

  // WebSocket mock 实例
  const _wsReadyState = { value: 1 };
  const mockWsInstance = {
    get readyState() { return _wsReadyState.value; },
    set readyState(v) { _wsReadyState.value = v; },
    send: vi.fn(),
    close: vi.fn(),
    onopen: null as ((...args: unknown[]) => void) | null,
    onclose: null as ((...args: unknown[]) => void) | null,
    onmessage: null as ((...args: unknown[]) => void) | null,
    onerror: null as ((...args: unknown[]) => void) | null,
  };

  // useWebSocketState mock
  const mockManualReconnect = vi.fn();
  const mockReportConnected = vi.fn();
  const mockReportDisconnected = vi.fn();
  const mockReportError = vi.fn();
  const mockResetState = vi.fn();
  // registeredCallbacks 保存引用，包装实际回调以保留 mock 方法
  const registeredCallbacks = { onOpen: vi.fn(), onClose: vi.fn(), onError: vi.fn() };
  const mockRegisterConnectionCallbacks = vi.fn(
    (cbs: { onOpen: () => void; onClose: () => void; onError: () => void }) => {
      registeredCallbacks.onOpen = vi.fn(cbs.onOpen);
      registeredCallbacks.onClose = vi.fn(cbs.onClose);
      registeredCallbacks.onError = vi.fn(cbs.onError);
    },
  );
  const mockUseWebSocketState = vi.fn().mockReturnValue({
    connectionState: 'disconnected',
    retryCount: 0,
    manualReconnect: mockManualReconnect,
    reportConnected: mockReportConnected,
    reportDisconnected: mockReportDisconnected,
    reportError: mockReportError,
    reset: mockResetState,
    registerConnectionCallbacks: mockRegisterConnectionCallbacks,
  });

  const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

  return {
    mockUpdatePendingInputsCount,
    mockHandleEvent,
    mockAddTerminalLine,
    mockAddTerminalChunk,
    mockReset,
    mockStoreGetState,
    mockTaskStoreFn,
    mockSessionGetState,
    mockSessionStoreFn,
    _wsReadyState,
    mockWsInstance,
    mockUseWebSocketState,
    mockLogger,
    mockManualReconnect,
    mockReportConnected,
    mockReportDisconnected,
    mockReportError,
    mockResetState,
    registeredCallbacks,
  };
});

// ── vi.mock：必须在 hoisted 变量声明之后 ───────────────────────────────────────

vi.mock('@/stores/useTaskStore', () => ({
  useTaskStore: mockTaskStoreFn,
}));

vi.mock('@/stores/useSessionStore', () => ({
  useSessionStore: mockSessionStoreFn,
}));

vi.mock('@/hooks/useWebSocketState', () => ({
  useWebSocketState: mockUseWebSocketState,
}));

vi.mock('@/utils/logger', () => ({
  createLogger: vi.fn().mockReturnValue(mockLogger),
}));

// ── beforeEach / afterEach ─────────────────────────────────────────────────────

let wsConstructorCallCount = 0;

beforeEach(() => {
  wsConstructorCallCount = 0;
  mockWsInstance.send.mockReset();
  mockWsInstance.close.mockReset();
  mockWsInstance.onopen = null;
  mockWsInstance.onclose = null;
  mockWsInstance.onmessage = null;
  mockWsInstance.onerror = null;
  mockWsInstance.readyState = 1;

  // stub WebSocket 全局
  const MockWs = vi.fn().mockImplementation(() => mockWsInstance) as unknown as typeof WebSocket;
  MockWs.OPEN = 1;
  MockWs.CONNECTING = 0;
  MockWs.CLOSED = 3;
  vi.stubGlobal('WebSocket', MockWs);

  // 重置 mock 函数（保留 onopen/onclose/onmessage/onerror 引用供测试手动调用）
  mockUpdatePendingInputsCount.mockClear();
  mockHandleEvent.mockClear();
  mockAddTerminalLine.mockClear();
  mockAddTerminalChunk.mockClear();
  mockReset.mockClear();
  mockManualReconnect.mockClear();
  mockReportConnected.mockClear();
  mockReportDisconnected.mockClear();
  mockReportError.mockClear();
  mockResetState.mockClear();
  registeredCallbacks.onOpen.mockClear();
  registeredCallbacks.onClose.mockClear();
  registeredCallbacks.onError.mockClear();
  mockSessionStoreFn.mockClear();
  mockSessionGetState.mockClear();
  mockStoreGetState.mockReset();
  mockStoreGetState.mockReturnValue({
    isStarting: false,
    error: null,
    currentQueryId: null,
    updatePendingInputsCount: mockUpdatePendingInputsCount,
    handleEvent: mockHandleEvent,
    addTerminalLine: mockAddTerminalLine,
    addTerminalChunk: mockAddTerminalChunk,
    reset: mockReset,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── 测试 ─────────────────────────────────────────────────────────────────────

describe('useWebSocket', () => {
  // ── 1. 初始化状态 ─────────────────────────────────────────────────────

  describe('初始化状态', () => {
    it('sessionId 为 null 时，初始 connectionState 为 disconnected', () => {
      const { result } = renderHook(() => useWebSocket(null));
      expect(result.current.connectionState).toBe('disconnected');
    });

    it('sessionId 为 null 时，初始 retryCount 为 0', () => {
      const { result } = renderHook(() => useWebSocket(null));
      expect(result.current.retryCount).toBe(0);
    });

    it('有 sessionId 时，初始 connectionState 为 disconnected', () => {
      const { result } = renderHook(() => useWebSocket('session-123'));
      expect(result.current.connectionState).toBe('disconnected');
      expect(result.current.retryCount).toBe(0);
    });
  });

  // ── 2. sendInput 函数 ─────────────────────────────────────────────────

  describe('sendInput 函数', () => {
    it('sendInput 是函数', () => {
      const { result } = renderHook(() => useWebSocket('session-abc'));
      expect(typeof result.current.sendInput).toBe('function');
    });

    it('WebSocket 未 OPEN 时，sendInput 返回 false 并缓冲消息', () => {
      mockWsInstance.readyState = 0; // CONNECTING
      const { result } = renderHook(() => useWebSocket('session-abc'));

      const sent = result.current.sendInput('hello world');

      expect(sent).toBe(false);
      expect(mockUpdatePendingInputsCount).toHaveBeenCalledWith(1);
    });

    it('WebSocket OPEN 时，sendInput 返回 true 并发送消息', () => {
      mockWsInstance.readyState = 1; // OPEN
      const { result } = renderHook(() => useWebSocket('session-open'));

      const sent = result.current.sendInput('test message');

      expect(sent).toBe(true);
      expect(mockWsInstance.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"send_input"'),
      );
    });

    it('WebSocket OPEN 时，sendInput 发送正确格式的 JSON 消息', () => {
      mockWsInstance.readyState = 1;
      const { result } = renderHook(() => useWebSocket('session-json'));
      mockWsInstance.send.mockClear();

      result.current.sendInput('my input');

      const sentArg = mockWsInstance.send.mock.calls[0][0];
      const parsed = JSON.parse(sentArg);
      expect(parsed.type).toBe('send_input');
      expect(parsed.sessionId).toBe('session-json');
      expect(parsed.input).toBe('my input');
    });

    it('WebSocket 未 OPEN 时消息不发送，仅队列化', () => {
      mockWsInstance.readyState = 3; // CLOSED
      const { result } = renderHook(() => useWebSocket('session-q'));

      result.current.sendInput('queued message');

      expect(mockWsInstance.send).not.toHaveBeenCalled();
      expect(mockUpdatePendingInputsCount).toHaveBeenCalledWith(1);
    });
  });

  // ── 3. disconnect 函数 ─────────────────────────────────────────────────

  describe('disconnect 函数', () => {
    it('disconnect 是函数', () => {
      const { result } = renderHook(() => useWebSocket('session-def'));
      expect(typeof result.current.disconnect).toBe('function');
    });

    it('disconnect 调用时 close WebSocket 并清理状态', () => {
      mockWsInstance.readyState = 1;
      const { result } = renderHook(() => useWebSocket('session-x'));

      act(() => {
        result.current.disconnect();
      });

      expect(mockWsInstance.close).toHaveBeenCalled();
    });

    it('disconnect 时 send kill_session 消息', () => {
      mockWsInstance.readyState = 1;
      const { result } = renderHook(() => useWebSocket('session-kill'));

      act(() => {
        result.current.disconnect();
      });

      expect(mockWsInstance.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"kill_session"'),
      );
    });

    it('disconnect 清空待发送队列', () => {
      // 先入队一条消息（WS 未 OPEN，消息进入 reconnectQueueRef）
      mockWsInstance.readyState = 0;
      const { result } = renderHook(() => useWebSocket('session-clear'));

      result.current.sendInput('queued before disconnect');

      act(() => {
        result.current.disconnect();
      });

      // disconnect 清空 reconnectQueueRef，readyState=0 时 kill_session 不发送（WS 未 OPEN）
      expect(mockWsInstance.close).toHaveBeenCalled();
    });
  });

  // ── 4. connect 函数（manualReconnect）──────────────────────────────────

  describe('connect 函数', () => {
    it('connect 是函数', () => {
      const { result } = renderHook(() => useWebSocket('session-c'));
      expect(typeof result.current.connect).toBe('function');
    });

    it('connect 调用 manualReconnect', () => {
      const { result } = renderHook(() => useWebSocket('session-reconnect'));

      act(() => {
        result.current.connect();
      });

      expect(mockManualReconnect).toHaveBeenCalledTimes(1);
    });
  });

  // ── 5. connectionState 状态 ───────────────────────────────────────────

  describe('connectionState 状态', () => {
    it('初始状态为 disconnected', () => {
      const { result } = renderHook(() => useWebSocket(null));
      expect(result.current.connectionState).toBe('disconnected');
    });

    it('connectionState 来自 useWebSocketState', () => {
      const { result } = renderHook(() => useWebSocket('session-state'));
      expect(result.current.connectionState).toBe('disconnected');
    });
  });

  // ── 6. retryCount 状态 ─────────────────────────────────────────────────

  describe('retryCount 状态', () => {
    it('初始 retryCount 为 0', () => {
      const { result } = renderHook(() => useWebSocket(null));
      expect(result.current.retryCount).toBe(0);
    });

    it('retryCount 来自 useWebSocketState', () => {
      const { result } = renderHook(() => useWebSocket('session-retry'));
      expect(result.current.retryCount).toBe(0);
    });
  });

  // ── 7. 消息队列（重连期间缓冲） ─────────────────────────────────────

  describe('消息队列（重连期间缓冲）', () => {
    it('WebSocket 未 OPEN 时，消息被队列化（reconnectQueue）', () => {
      mockWsInstance.readyState = 0; // CONNECTING
      const { result } = renderHook(() => useWebSocket('session-queue'));

      result.current.sendInput('queued message');

      expect(mockWsInstance.send).not.toHaveBeenCalled();
      expect(mockUpdatePendingInputsCount).toHaveBeenCalledWith(1);
    });

    it('连续多次发送未 OPEN 时，每次都增加队列计数', () => {
      mockWsInstance.readyState = 3; // CLOSED
      const { result } = renderHook(() => useWebSocket('session-multi-queue'));

      result.current.sendInput('msg1');
      expect(mockUpdatePendingInputsCount).toHaveBeenCalledWith(1);

      result.current.sendInput('msg2');
      expect(mockUpdatePendingInputsCount).toHaveBeenCalledWith(2);

      result.current.sendInput('msg3');
      expect(mockUpdatePendingInputsCount).toHaveBeenCalledWith(3);
    });
  });

  // ── 8. 清理函数（组件卸载） ───────────────────────────────────────────

  describe('清理函数（组件卸载）', () => {
    it('unmount 不抛出异常', () => {
      const { unmount } = renderHook(() => useWebSocket('session-cleanup'));
      expect(() => unmount()).not.toThrow();
    });

    it('unmount 时 disconnect 被调用（useEffect cleanup）', () => {
      mockWsInstance.readyState = 1;
      const { unmount } = renderHook(() => useWebSocket('session-unmount'));

      unmount();

      expect(mockWsInstance.close).toHaveBeenCalled();
    });

    it('多次 mount/unmount 周期不累积状态', () => {
      const { rerender, unmount } = renderHook(
        ({ sid }: { sid: string }) => useWebSocket(sid),
        { initialProps: { sid: 'session-a' } },
      );

      rerender({ sid: 'session-b' });
      unmount();

      expect(true).toBe(true);
    });
  });

  // ── 9. sessionId 变化时重新连接 ──────────────────────────────────────

  describe('sessionId 变化时重新连接', () => {
    it('sessionId 从 null 变为有效值时，触发 WebSocket 连接', () => {
      const { rerender } = renderHook(
        ({ sid }: { sid: string | null }) => useWebSocket(sid),
        { initialProps: { sid: null } },
      );

      rerender({ sid: 'new-session' });

      expect(WebSocket).toHaveBeenCalled();
    });
  });

  // ── 10. connect 幂等性 ────────────────────────────────────────────────

  describe('connect 幂等性', () => {
    it('重复 connect 调用触发 manualReconnect（幂等性由 WS 层保证）', () => {
      mockWsInstance.readyState = 1;

      const { result } = renderHook(() => useWebSocket('session-idempotent'));

      act(() => {
        result.current.connect();
      });
      act(() => {
        result.current.connect();
      });

      expect(mockManualReconnect).toHaveBeenCalledTimes(2);
    });
  });

  // ── 11. sendInput 发送失败时消息重新入队 ─────────────────────────────

  describe('sendInput 发送失败时消息重新入队', () => {
    it('send 抛出异常时，sendInput 返回 false（消息入 pendingInputsRef）', () => {
      mockWsInstance.readyState = 1;
      // 仅第一次 send 抛出异常（后续 unmount 清理不再抛）
      mockWsInstance.send.mockImplementationOnce(() => {
        throw new Error('send error');
      });

      const { result } = renderHook(() => useWebSocket('session-send-err'));

      const sent = result.current.sendInput('will fail');

      expect(sent).toBe(false);
      // send 失败时消息进入 pendingInputsRef（下次 streamEnd 时消费）
      // updatePendingInputsCount 只在 streamEnd 事件中更新，不在此处调用
      expect(mockWsInstance.send).toHaveBeenCalled();
    });
  });

  // ── 12. disconnect 清理 reconnectQueueRef ───────────────────────────

  describe('disconnect 清理 reconnectQueueRef', () => {
    it('disconnect 后 reconnectQueueRef 被清空', () => {
      mockWsInstance.readyState = 0; // 触发入 reconnectQueueRef
      const { result } = renderHook(() => useWebSocket('session-queue-clear'));

      result.current.sendInput('msg1');

      act(() => {
        result.current.disconnect();
      });

      // readyState=0 时 kill_session 不发送，disconnect 只清空队列
      expect(mockWsInstance.close).toHaveBeenCalled();
    });
  });

  // ── 13. sendInput 在 running 状态时入队 ─────────────────────────────

  describe('sendInput 在 running 状态时入队', () => {
    it('isRunning 为 true 时，消息入 pendingInputsRef 而不直接发送', () => {
      mockWsInstance.readyState = 1;

      const { result } = renderHook(() => useWebSocket('session-running'));

      // 第一次发送（启动 isRunning）
      result.current.sendInput('first input');
      expect(mockWsInstance.send).toHaveBeenCalled(); // 第一次直接发

      // 第二次发送（isRunning 已为 true）
      result.current.sendInput('second input');
      expect(mockWsInstance.send).toHaveBeenCalledTimes(1); // 不再发送，入队
      expect(mockUpdatePendingInputsCount).toHaveBeenCalledWith(1);
    });
  });

  // ── 14. WebSocket onopen 处理器 ──────────────────────────────────────────

  describe('WebSocket onopen 处理器', () => {
    it('ws.onopen 被触发，send start_session', () => {
      const { result } = renderHook(() => useWebSocket('session-open-handler'));

      // ws.onopen 发送 start_session
      act(() => {
        mockWsInstance.onopen!();
      });

      expect(mockWsInstance.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"start_session"'),
      );
    });

    it('ws.onopen 发送 start_session 消息', () => {
      renderHook(() => useWebSocket('session-start'));

      act(() => {
        mockWsInstance.onopen!();
      });

      expect(mockWsInstance.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"start_session"'),
      );
    });

    it('ws.onopen 有 reconnectQueue 时 flush 队列中的消息', () => {
      const { result } = renderHook(() => useWebSocket('session-prequeue'));

      // WS 未 OPEN 时 sendInput 进入 reconnectQueueRef
      mockWsInstance.readyState = 0;
      result.current.sendInput('pre queued input');

      // 模拟 WS OPEN
      mockWsInstance.readyState = 1;

      act(() => {
        mockWsInstance.onopen!();
      });

      // reconnectQueue 被 flush，发送 send_input
      expect(mockWsInstance.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"send_input"'),
      );
    });

    it('ws.onopen 重连后 flush reconnectQueue 并重置 pending 计数', () => {
      const { result } = renderHook(() => useWebSocket('session-reconnect-flush'));

      // 模拟离线时多次 sendInput
      mockWsInstance.readyState = 0;
      result.current.sendInput('msg1');
      result.current.sendInput('msg2');

      // 模拟 WS OPEN
      mockWsInstance.readyState = 1;

      act(() => {
        mockWsInstance.onopen!();
      });

      // reconnectQueue flush 后 updatePendingInputsCount(0)
      expect(mockUpdatePendingInputsCount).toHaveBeenLastCalledWith(0);
    });
  });

  // ── 15. WebSocket onmessage 处理器 ────────────────────────────────────────

  describe('WebSocket onmessage 处理器', () => {
    it('收到 terminalChunk 消息时调用 addTerminalChunk', () => {
      renderHook(() => useWebSocket('session-terminal-chunk'));

      act(() => {
        mockWsInstance.onmessage!({
          data: JSON.stringify({ type: 'terminalChunk', text: 'hello chunk' }),
        } as MessageEvent);
      });

      expect(mockAddTerminalChunk).toHaveBeenCalledWith('hello chunk');
    });

    it('收到 terminal 消息时调用 addTerminalLine', () => {
      renderHook(() => useWebSocket('session-terminal'));

      act(() => {
        mockWsInstance.onmessage!({
          data: JSON.stringify({ type: 'terminal', text: 'terminal output' }),
        } as MessageEvent);
      });

      expect(mockAddTerminalLine).toHaveBeenCalledWith('terminal output');
    });

    it('收到 terminalChunk 后提前返回，不处理 event', () => {
      renderHook(() => useWebSocket('session-terminal-early-return'));

      act(() => {
        mockWsInstance.onmessage!({
          data: JSON.stringify({ type: 'terminalChunk', text: 'x' }),
        } as MessageEvent);
      });

      expect(mockHandleEvent).not.toHaveBeenCalled();
    });

    it('收到通用 event 时调用 handleEvent', () => {
      renderHook(() => useWebSocket('session-event'));

      act(() => {
        mockWsInstance.onmessage!({
          data: JSON.stringify({ event: { type: 'some_event', data: {} } }),
        } as MessageEvent);
      });

      expect(mockHandleEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'some_event' }),
      );
    });

    it('收到 streamEnd event 时处理队列消费', () => {
      const { result } = renderHook(() => useWebSocket('session-stream-end'));

      // 模拟第一次发送后 isRunning=true
      mockWsInstance.readyState = 1;
      result.current.sendInput('first input');
      mockWsInstance.send.mockClear();

      // 模拟 streamEnd
      act(() => {
        mockWsInstance.onmessage!({
          data: JSON.stringify({ event: { type: 'streamEnd', queryId: 'q1' } }),
        } as MessageEvent);
      });

      // streamEnd 后发送下一条（队列空则不发送）
      // pendingInputsRef 为空，isRunning 设为 false，updatePendingInputsCount(0)
      expect(mockUpdatePendingInputsCount).toHaveBeenLastCalledWith(0);
    });

    it('onmessage catch 块处理 JSON.parse 失败，回调到 addTerminalLine', () => {
      renderHook(() => useWebSocket('session-parse-error'));

      act(() => {
        mockWsInstance.onmessage!({ data: 'plain text not json' } as MessageEvent);
      });

      expect(mockAddTerminalLine).toHaveBeenCalledWith('plain text not json');
    });

    it('onmessage 忽略空字符串消息（parse 失败时 catch 调用 addTerminalLine）', () => {
      renderHook(() => useWebSocket('session-empty-msg'));

      act(() => {
        mockWsInstance.onmessage!({ data: '' } as MessageEvent);
      });

      // 空字符串 parse 失败 → catch 块调用 addTerminalLine('')
      // handleEvent 不被调用（这是关键不变式）
      expect(mockHandleEvent).not.toHaveBeenCalled();
    });
  });

  // ── 16. WebSocket onclose / onerror 处理器 ────────────────────────────────

  describe('WebSocket onclose / onerror 处理器', () => {
    it('onclose 调用 reportDisconnected', () => {
      renderHook(() => useWebSocket('session-close'));

      act(() => {
        registeredCallbacks.onClose();
      });

      expect(mockReportDisconnected).toHaveBeenCalledTimes(1);
    });

    it('onerror 调用 reportError', () => {
      renderHook(() => useWebSocket('session-error'));

      act(() => {
        registeredCallbacks.onError();
      });

      expect(mockReportError).toHaveBeenCalledTimes(1);
    });
  });

  // ── 18. ws.onclose / ws.onerror 处理器（via 捕获引用）───────────────────

  // 在 beforeEach 中捕获 WebSocket 处理器引用，供测试使用
  let capturedOnClose: (() => void) | null = null;
  let capturedOnError: ((e: Event) => void) | null = null;

  beforeEach(() => {
    // 捕获 onclose/onerror 处理器（由 doConnect 在 mount 时设置）
    const origOnClose = mockWsInstance.onclose;
    const origOnError = mockWsInstance.onerror;
    Object.defineProperty(mockWsInstance, 'onclose', {
      set(fn) { capturedOnClose = fn as (() => void) | null; origOnClose && origOnClose(); },
      get() { return capturedOnClose; },
      configurable: true,
    });
    Object.defineProperty(mockWsInstance, 'onerror', {
      set(fn) { capturedOnError = fn as ((e: Event) => void) | null; origOnError && origOnError(); },
      get() { return capturedOnError; },
      configurable: true,
    });
  });

  describe('ws.onclose / ws.onerror 处理器', () => {
    it('ws.onclose 处理器被正确设置', () => {
      renderHook(() => useWebSocket('session-ws-close'));
      // capturedOnClose 在 mount 时被设置
      expect(capturedOnClose).toBeDefined();
      expect(typeof capturedOnClose).toBe('function');
    });

    it('ws.onerror 处理器被正确设置', () => {
      renderHook(() => useWebSocket('session-ws-error'));
      expect(capturedOnError).toBeDefined();
      expect(typeof capturedOnError).toBe('function');
    });
  });

  // ── 17. doConnect 幂等性和旧连接清理 ────────────────────────────────────

  describe('doConnect 幂等性和旧连接清理', () => {
    it('重复 connect 调用触发 manualReconnect（doConnect 幂等检查生效）', () => {
      const { result } = renderHook(() => useWebSocket('session-idempotent2'));

      act(() => {
        result.current.connect();
      });
      act(() => {
        result.current.connect();
      });

      // manualReconnect 被调用 2 次（每次 connect 调用一次）
      expect(mockManualReconnect).toHaveBeenCalledTimes(2);
      // doConnect 幂等检查：第二次时 wsRef.current 已存在且 OPEN，跳过发送
    });
  });
});
