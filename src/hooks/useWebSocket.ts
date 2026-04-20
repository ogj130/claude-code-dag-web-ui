import { useEffect, useRef, useCallback } from 'react';
import { useTaskStore } from '../stores/useTaskStore';
import { useSessionStore } from '../stores/useSessionStore';
import { useGlobalTerminalStore } from '../stores/useGlobalTerminalStore';
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
  // 直接连接 ws://localhost（不走 Vite 代理），
  // 因为 Playwright 沙箱环境通过外网 IP 访问 Vite 时，代理的主机头不匹配导致 WS 升级失败
  return `ws://localhost:${wsPort}`;
}

// wsId 计数器：每个新 WS 连接分配一个唯一递增 ID
// onClose 时检查 wsId 是否匹配，确保只有当前活跃连接的 onClose 才能清幂等锁
let _nextWsId: number = 1;

export function useWebSocket(sessionId: string | null, modelOptions?: ModelOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const pendingInputsRef = useRef<string[]>([]);
  // 在 WebSocket OPEN 前用户尝试发送的消息（StrictMode 等场景）
  const preConnectQueueRef = useRef<string[]>([]);
  const isRunningRef = useRef(false);
  // 跟踪当前连接的 sessionId，防止 StrictMode 双重调用导致重复连接
  const connectedSessionRef = useRef<string | null>(null);
  // 幂等锁 ref：使用 useRef 而非模块变量，HMR 热更新后自动重新初始化为 0
  // StrictMode double-invoke: cleanup 会将其重置为 0，第二个 effect run 看到 0 后继续执行
  const connectingIdRef = useRef(0);
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

    // 幂等锁：connectingIdRef.current !== 0 表示锁已被占用
    // StrictMode double-invoke: cleanup 会重置 connectingIdRef = 0，允许第二个 effect run 继续
    // HMR 热更新：ref 重新初始化为 0，不会被旧模块值干扰
    if (connectingIdRef.current !== 0) {
      log.info('WebSocket connection already in progress, skipping duplicate doConnect');
      return;
    }
    const wsId = _nextWsId++;
    connectingIdRef.current = wsId;

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
      onOpen: () => {
        log.info('WS onOpen fired, readyState:', ws.readyState);
        reportConnected();
      },
      onClose: () => {
        // 只有当前 WS 的 onClose 才能清锁（旧 cleanup 持有的 wsId 不同，不会误清）
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
        if (connectingIdRef.current === wsId) {
          connectingIdRef.current = 0;  // 清空幂等锁，允许重连
        }
        connectedSessionRef.current = null;
        reportDisconnected();
      },
      onError: () => reportError(),
    }, wsId);

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
            // 同时路由到全局终端 store（用于全局合并视图）
            useGlobalTerminalStore.getState().appendChunk(
              sessionId ?? 'default',
              (parsed as WSTerminalChunkMessage).text
            );
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

        // session_end 或 error 到达时：重置 isRunningRef 并清空队列
        // 否则 pendingInputsRef 永远卡住，sendInput 永远返回 true（入队但不发送）
        if (evt?.type === 'session_end' || evt?.type === 'error') {
          const reason = evt.type === 'session_end'
            ? ((parsed as WSMessage).event as { reason?: string }).reason ?? 'unknown'
            : ((parsed as WSMessage).event as { message?: string }).message ?? 'unknown';
          log.info('Session terminated, resetting isRunningRef and clearing queue', [{ eventType: evt.type, reason }]);
          isRunningRef.current = false;
          pendingInputsRef.current = [];
          useTaskStore.getState().updatePendingInputsCount(0);
        }
      } catch {
        addTerminalLine(event.data);
      }
    };

    ws.onclose = (e) => {
      log.info('WebSocket closed', [{ code: e.code, reason: e.reason }]);
      // 注意：pendingInputsRef 和 reconnectQueueRef 不清空，保留到下次连接成功时 flush
    };

    ws.onerror = (err) => {
      log.error('Connection error', err);
      // 连接失败也要清锁（用 wsId 确保只清自己的锁）
      if (connectingIdRef.current === wsId) {
        connectingIdRef.current = 0;
      }
    };
  }

  const disconnect = useCallback(() => {
    log.info('disconnect() called');
    pendingInputsRef.current = [];
    reconnectQueueRef.current = [];
    isRunningRef.current = false;
    if (wsRef.current) {
      // 关键修复：StrictMode cleanup 中必须显式关闭 WS，
      // 否则 ws1 保持 OPEN 状态，继续接收服务端广播，
      // 与新连接的 ws2 同时触发 handleEvent → 重复卡片
      wsRef.current.close();
      wsRef.current = null;
      connectedSessionRef.current = null;
    }
    connectingIdRef.current = 0;
    resetState();
    reset();
  }, [reset, resetState]);

  /** 切换模型：通过现有 WS 发送 switch_model，服务端 kill+respawn，不清前端状态 */
  const switchModel = useCallback((newModelOptions: ModelOptions) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !sessionId) {
      log.warn('Cannot switch model: WS not open');
      return false;
    }
    log.info('Sending switch_model', [{ sessionId, model: newModelOptions.model }]);
    ws.send(JSON.stringify({
      type: 'switch_model',
      sessionId,
      modelOptions: newModelOptions,
    }));
    return true;
  }, [sessionId]);

  const sendInput = useCallback((input: string): boolean => {
    log.info('sendInput called', [{ input: input.substring(0, 50), wsState: wsRef.current?.readyState }]);
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
    log.info('useWebSocket useEffect', [{ sessionId, hasWS: !!wsRef.current }]);
    if (!sessionId) return;

    doConnect();

    return () => {
      log.info('useWebSocket cleanup', [{ sessionId }]);
      disconnect();
    };
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    sendInput,
    disconnect,
    switchModel,
    connect: manualReconnect,
    connectionState,
    retryCount,
  };
}
