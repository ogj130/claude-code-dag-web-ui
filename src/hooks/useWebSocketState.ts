import { useCallback, useRef, useReducer } from 'react';
import { createLogger } from '../utils/logger';

const log = createLogger('WebSocketState');

/** WebSocket 连接状态 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed';

/** 指数退避重试延迟序列（毫秒） */
const RECONNECT_DELAYS = [5_000, 10_000, 30_000] as const;
const MAX_RETRIES = 3;

/** 内部状态：合并 connectionState 和 retryCount，确保同步更新 */
interface InternalState {
  connectionState: ConnectionState;
  retryCount: number;
}

type InternalAction =
  | { type: 'SET_CONNECTING' }
  | { type: 'SET_CONNECTED' }
  | { type: 'SCHEDULE_RECONNECT'; currentRetry: number }
  | { type: 'RESET' }
  | { type: 'MANUAL_RECONNECT' };

function reducer(_prev: InternalState, action: InternalAction): InternalState {
  switch (action.type) {
    case 'SET_CONNECTING':
      return { connectionState: 'connecting', retryCount: 0 };
    case 'SET_CONNECTED':
      return { connectionState: 'connected', retryCount: 0 };
    case 'SCHEDULE_RECONNECT': {
      const retry = action.currentRetry;
      if (retry >= MAX_RETRIES) {
        return { connectionState: 'failed', retryCount: retry };
      }
      return { connectionState: 'reconnecting', retryCount: retry };
    }
    case 'MANUAL_RECONNECT':
      return { connectionState: 'connecting', retryCount: 0 };
    case 'RESET':
      return { connectionState: 'disconnected', retryCount: 0 };
    default:
      return { connectionState: 'disconnected', retryCount: 0 };
  }
}

/** 连接状态 Hook 配置项 */
export interface UseWebSocketStateOptions {
  /** WebSocket URL（预留，供未来日志/调试使用） */
  url?: string;
  /** 手动重连回调 */
  onReconnect: () => void;
  /** 连接成功回调 */
  onConnected?: () => void;
  /** 连接关闭回调 */
  onDisconnected?: () => void;
}

interface UseWebSocketStateReturn {
  /** 当前连接状态 */
  connectionState: ConnectionState;
  /** 当前重试次数（0-based，最大 2） */
  retryCount: number;
  /** 手动触发重连（仅在 disconnected / failed 状态有效） */
  manualReconnect: () => void;
  /** 报告连接成功 */
  reportConnected: () => void;
  /** 报告连接断开 */
  reportDisconnected: () => void;
  /** 报告连接出错 */
  reportError: () => void;
  /** 重置状态（断开连接时调用） */
  reset: () => void;
  /**
   * 注册 WebSocket 生命周期回调。
   * useWebSocket 在创建 WebSocket 对象后应调用此方法，
   * 以便状态机在 ws.onopen / ws.onclose / ws.onerror 时得到通知。
   */
  registerConnectionCallbacks: (callbacks: {
    onOpen: () => void;
    onClose: () => void;
    onError: () => void;
  }) => void;
}

/**
 * WebSocket 连接状态机 Hook
 *
 * 状态转换图：
 *
 *  disconnected ──[manual]──► connecting ──[WS open]──► connected
 *                      │                                    │
 *                      │                         [WS close/error]
 *                      │                                    │
 *                      │◄────────── reconnecting ◄──────────┘
 *                      │      [指数退避，最多 3 次]
 *                      │
 *                      └────────────► failed
 */
export function useWebSocketState({
  onReconnect,
  onConnected,
  onDisconnected,
}: UseWebSocketStateOptions): UseWebSocketStateReturn {
  const [state, dispatch] = useReducer(reducer, { connectionState: 'disconnected', retryCount: 0 });

  // 防止多次同时触发
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 与 state 同步的 ref，避免闭包陷阱
  const retryCountRef = useRef(0);
  // 当前注册的生命周期回调（由外部 WebSocket 设置）
  const connectionCallbacksRef = useRef<{
    onOpen: () => void;
    onClose: () => void;
    onError: () => void;
  } | null>(null);

  // 清理所有定时器
  const clearTimers = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  /**
   * 进入 reconnecting 状态，安排下一次重连
   */
  const scheduleReconnect = useCallback(
    (currentRetry: number) => {
      clearTimers();
      retryCountRef.current = currentRetry;

      if (currentRetry >= MAX_RETRIES) {
        log.warn(`Max retries (${MAX_RETRIES}) reached, entering failed state`);
        dispatch({ type: 'SCHEDULE_RECONNECT', currentRetry });
        return;
      }

      const delay = RECONNECT_DELAYS[currentRetry] ?? RECONNECT_DELAYS[RECONNECT_DELAYS.length - 1];
      log.info(`Scheduling reconnect attempt ${currentRetry + 1}/${MAX_RETRIES} in ${delay}ms`);

      dispatch({ type: 'SCHEDULE_RECONNECT', currentRetry });

      reconnectTimerRef.current = setTimeout(() => {
        log.info(`Executing reconnect attempt ${currentRetry + 1}/${MAX_RETRIES}`);
        dispatch({ type: 'SET_CONNECTING' });
        onReconnect();
      }, delay);
    },
    [clearTimers, onReconnect],
  );

  /**
   * 报告连接成功
   */
  const reportConnected = useCallback(() => {
    clearTimers();
    retryCountRef.current = 0;
    log.info('Connection established');
    dispatch({ type: 'SET_CONNECTED' });
    onConnected?.();
  }, [clearTimers, onConnected]);

  /**
   * 报告连接断开（被动断连，触发自动重连）
   */
  const reportDisconnected = useCallback(() => {
    clearTimers();
    log.info('Connection lost, evaluating reconnection strategy');

    // 读取当前状态（而非闭包中的陈旧值）
    const prevState = state.connectionState;

    if (prevState === 'connecting') {
      // connecting 时断开 → 立即重试（不计入重试次数）
      log.info('Connecting failed, retrying immediately');
      dispatch({ type: 'SET_CONNECTING' });
      onReconnect();
      return;
    }

    if (prevState === 'connected' || prevState === 'reconnecting') {
      // 连接中正常断开或重连中断 → 开始/继续重连序列
      scheduleReconnect(retryCountRef.current);
      return;
    }

    // disconnected/failed 状态不需要处理
    onDisconnected?.();
  }, [clearTimers, onReconnect, onDisconnected, scheduleReconnect, state.connectionState]);

  /**
   * 报告连接出错（触发重连或进入 failed）
   */
  const reportError = useCallback(() => {
    log.warn('Connection error reported');
    clearTimers();

    const prevState = state.connectionState;

    if (prevState === 'connected' || prevState === 'connecting') {
      scheduleReconnect(retryCountRef.current);
      return;
    }
  }, [clearTimers, scheduleReconnect, state.connectionState]);

  /**
   * 手动触发重连
   */
  const manualReconnect = useCallback(() => {
    clearTimers();
    retryCountRef.current = 0;
    log.info('Manual reconnect triggered');
    dispatch({ type: 'MANUAL_RECONNECT' });
    onReconnect();
  }, [clearTimers, onReconnect]);

  /**
   * 重置状态（主动断开连接时）
   */
  const reset = useCallback(() => {
    clearTimers();
    retryCountRef.current = 0;
    dispatch({ type: 'RESET' });
    connectionCallbacksRef.current = null;
    onDisconnected?.();
  }, [clearTimers, onDisconnected]);

  /**
   * 注册 WebSocket 生命周期回调。
   * 每次创建新的 WebSocket 对象时，useWebSocket 应调用此方法更新回调引用。
   */
  const registerConnectionCallbacks = useCallback(
    (callbacks: { onOpen: () => void; onClose: () => void; onError: () => void }) => {
      connectionCallbacksRef.current = callbacks;
    },
    [],
  );

  return {
    connectionState: state.connectionState,
    retryCount: state.retryCount,
    manualReconnect,
    reportConnected,
    reportDisconnected,
    reportError,
    reset,
    registerConnectionCallbacks,
  };
}
