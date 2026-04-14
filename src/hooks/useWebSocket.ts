import { useEffect, useRef, useCallback } from 'react';
import { useTaskStore } from '../stores/useTaskStore';
import { useSessionStore } from '../stores/useSessionStore';
import { createLogger } from '../utils/logger';
import { useWebSocketState } from './useWebSocketState';
import type { WSMessage, WSClientMessage, WSTerminalMessage, WSTerminalChunkMessage, ClaudeEvent } from '../types/events';
import type { ModelOptions } from '@/types/events';

const log = createLogger('WebSocket');

/**
 * 从 URL 参数读取 WebSocket 端口（Electron 打包模式由 main.ts 通过 ?wsPort=xxx 传入）
 * Dev 模式 fallback 到默认端口 5300
 */
function getWsUrl(): string {
  const params = new URLSearchParams(window.location.search);
  const wsPort = params.get('wsPort') ?? '5300';
  return `ws://localhost:${wsPort}`;
}

export function useWebSocket(sessionId: string | null, modelOptions?: ModelOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const pendingInputsRef = useRef<string[]>([]);
  // 在 WebSocket OPEN 前用户尝试发送的消息（StrictMode 等场景）
  const preConnectQueueRef = useRef<string[]>([]);
  const isRunningRef = useRef(false);
  // 跟踪当前连接的 sessionId，防止 StrictMode 双重调用导致重复连接
  const connectedSessionRef = useRef<string | null>(null);
  const { handleEvent, addTerminalLine, addTerminalChunk, reset } = useTaskStore();

  // ── 消息队列（重连期间缓冲） ──────────────────────────
  const reconnectQueueRef = useRef<string[]>([]);

  // ── 状态机 ─────────────────────────────────────────
  const {
    connectionState,
    retryCount,
    manualReconnect,
    reportConnected,
    reportDisconnected,
    reportError,
    reset: resetState,
    registerConnectionCallbacks,
  } = useWebSocketState({
    url: getWsUrl(),
    onReconnect: doConnect,
    onConnected: undefined,
    onDisconnected: undefined,
  });

  /** 实际建立 WebSocket 连接的内部函数 */
  function doConnect() {
    if (!sessionId) return;

    // 幂等性检查：同一 sessionId 已连接（wsRef 有效）→ 跳过
    if (connectedSessionRef.current === sessionId && wsRef.current?.readyState === WebSocket.OPEN) {
      log.info('WebSocket already connected for this session, skipping');
      return;
    }

    // 有旧连接但不是当前 sessionId → 先断开
    if (wsRef.current) {
      log.info('Session changed, closing old connection');
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'kill_session', sessionId: connectedSessionRef.current } as WSClientMessage));
      }
      wsRef.current.close();
      wsRef.current = null;
    }

    connectedSessionRef.current = sessionId;
    useTaskStore.setState({ isStarting: true, error: null });

    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    // 注册生命周期回调（使状态机感知连接状态）
    registerConnectionCallbacks({
      onOpen: () => reportConnected(),
      onClose: () => {
        // 同步清空 ref，防止 StrictMode 第二次 connect() 时误判已有连接
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
        connectedSessionRef.current = null;
        reportDisconnected();
      },
      onError: () => reportError(),
    });

    ws.onopen = () => {
      // 从 store 动态读取当前会话的 projectPath
      const session = useSessionStore.getState().sessions.find(s => s.id === sessionId);
      const projectPath = session?.projectPath ?? '/Users/ouguangji/2026/cc-web-ui';

      const msg: WSClientMessage = {
        type: 'start_session',
        sessionId,
        projectPath,
        modelOptions,
      };
      ws.send(JSON.stringify(msg));

      // 有预连接队列中的消息？立即发送第一条（后续由 streamEnd 驱动队列消费）
      const preInput = preConnectQueueRef.current.shift();
      if (preInput) {
        log.info('Sending pre-connection queued input');
        ws.send(JSON.stringify({ type: 'send_input', sessionId, input: preInput } as WSClientMessage));
        isRunningRef.current = true;
        if (preConnectQueueRef.current.length > 0) {
          useTaskStore.getState().updatePendingInputsCount(preConnectQueueRef.current.length);
        }
      }

      // 重连后 flush 缓冲队列
      const reconnectQueue = reconnectQueueRef.current.splice(0);
      for (const input of reconnectQueue) {
        log.info('Flushing reconnect queue item');
        ws.send(JSON.stringify({ type: 'send_input', sessionId, input } as WSClientMessage));
      }
      if (reconnectQueue.length > 0) {
        isRunningRef.current = true;
        useTaskStore.getState().updatePendingInputsCount(0);
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = event.data;
        const parsed = JSON.parse(msg);
        if (typeof parsed === 'string' || !parsed) return;
        if ('type' in parsed) {
          if (parsed.type === 'terminalChunk') {
            addTerminalChunk((parsed as WSTerminalChunkMessage).text);
            return;
          }
          if (parsed.type === 'terminal') {
            addTerminalLine((parsed as WSTerminalMessage).text);
            return;
          }
        }
        const evt = (parsed as WSMessage).event;
        if (evt) {
          if (evt.type === 'streamEnd') {
            const queryId = pendingInputsRef.current[0] ?? useTaskStore.getState().currentQueryId;
            handleEvent({ ...evt, queryId } as ClaudeEvent);
          } else {
            handleEvent(evt);
          }
        }

        // 处理 streamEnd：complete 当前 query，检查队列
        if (evt?.type === 'streamEnd') {
          const currentQueryId = useTaskStore.getState().currentQueryId;
          if (currentQueryId) {
            useTaskStore.getState().handleEvent({ type: 'query_end', queryId: currentQueryId });
          }

          const nextInput = pendingInputsRef.current.shift();
          if (nextInput && wsRef.current?.readyState === WebSocket.OPEN) {
            log.info('Sending next queued input');
            useTaskStore.getState().updatePendingInputsCount(pendingInputsRef.current.length);
            wsRef.current.send(JSON.stringify({
              type: 'send_input',
              sessionId,
              input: nextInput,
            } as WSClientMessage));
          } else {
            isRunningRef.current = false;
            useTaskStore.getState().updatePendingInputsCount(0);
          }
        }
      } catch {
        addTerminalLine(event.data);
      }
    };

    ws.onclose = () => {
      log.info('WebSocket closed');
      // 注意：pendingInputsRef 和 reconnectQueueRef 不清空，保留到下次连接成功时 flush
    };

    ws.onerror = (err) => {
      log.error('Connection error', err);
    };
  }

  const disconnect = useCallback(() => {
    pendingInputsRef.current = [];
    reconnectQueueRef.current = [];
    isRunningRef.current = false;
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'kill_session', sessionId } as WSClientMessage));
      }
      wsRef.current.close();
      wsRef.current = null;
      connectedSessionRef.current = null;
    }
    resetState();
    reset();
  }, [sessionId, reset, resetState]);

  const sendInput = useCallback((input: string): boolean => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      // 未连接：加入重连缓冲队列，重连后自动 flush
      log.warn('WS not open, queueing for reconnect flush');
      reconnectQueueRef.current.push(input);
      useTaskStore.getState().updatePendingInputsCount(reconnectQueueRef.current.length);
      return false;
    }
    if (isRunningRef.current) {
      log.info('Queueing input (running)');
      pendingInputsRef.current.push(input);
      useTaskStore.getState().updatePendingInputsCount(pendingInputsRef.current.length);
      return true; // 已入队
    }
    try {
      isRunningRef.current = true;
      ws.send(JSON.stringify({ type: 'send_input', sessionId, input } as WSClientMessage));
      return true; // 发送成功
    } catch (err) {
      log.error('sendInput failed:', err);
      isRunningRef.current = false; // 发送失败时立即重置，避免永久阻塞
      pendingInputsRef.current.push(input); // 消息重新入队等待下次
      return false;
    }
  }, [sessionId]);

  // 自动连接：sessionId 变化时立即连接，断开时清理
  useEffect(() => {
    if (!sessionId) return;

    doConnect();

    return () => {
      disconnect();
    };
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    sendInput,
    disconnect,
    connect: manualReconnect,
    connectionState,
    retryCount,
  };
}
