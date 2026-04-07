import { useEffect, useRef, useCallback } from 'react';
import { useTaskStore } from '../stores/useTaskStore';
import { useSessionStore } from '../stores/useSessionStore';
import { createLogger } from '../utils/logger';
import type { WSMessage, WSClientMessage, WSTerminalMessage, WSTerminalChunkMessage, ClaudeEvent } from '../types/events';

const log = createLogger('WebSocket');
const WS_URL = `ws://localhost:5300`;

export function useWebSocket(sessionId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const pendingInputsRef = useRef<string[]>([]);
  // 在 WebSocket OPEN 前用户尝试发送的消息（StrictMode 等场景）
  const preConnectQueueRef = useRef<string[]>([]);
  const isRunningRef = useRef(false);
  // 跟踪当前连接的 sessionId，防止 StrictMode 双重调用导致重复连接
  const connectedSessionRef = useRef<string | null>(null);
  const { handleEvent, addTerminalLine, addTerminalChunk, reset } = useTaskStore();

  const connect = useCallback(() => {
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

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      // 从 store 动态读取当前会话的 projectPath
      const session = useSessionStore.getState().sessions.find(s => s.id === sessionId);
      const projectPath = session?.projectPath ?? '/Users/ouguangji/2026/cc-web-ui';

      const msg: WSClientMessage = {
        type: 'start_session',
        sessionId,
        projectPath,
      };
      ws.send(JSON.stringify(msg));

      // 有预连接队列中的消息？立即发送第一条（后续由 streamEnd 驱动队列消费）
      const preInput = preConnectQueueRef.current.shift();
      if (preInput) {
        log.info('Sending pre-connection queued input');
        ws.send(JSON.stringify({ type: 'send_input', sessionId, input: preInput } as WSClientMessage));
        // queryId 由服务端生成并广播过来，客户端等待 WS 消息即可
        isRunningRef.current = true;
        // 队列里还有剩余
        if (preConnectQueueRef.current.length > 0) {
          useTaskStore.getState().updatePendingInputsCount(preConnectQueueRef.current.length);
        }
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
            // pendingInputsRef[0] 是当前正在处理的 queryId
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
            // 还有排队的输入，立即发送
            log.info('Sending next queued input');
            useTaskStore.getState().updatePendingInputsCount(pendingInputsRef.current.length);
            wsRef.current.send(JSON.stringify({
              type: 'send_input',
              sessionId,
              input: nextInput,
            } as WSClientMessage));
            // queryId 由服务端生成并广播过来
          } else {
            // 队列空了，设置为 idle
            isRunningRef.current = false;
            useTaskStore.getState().updatePendingInputsCount(0);
          }
        }
      } catch {
        addTerminalLine(event.data);
      }
    };

    ws.onclose = () => {
      log.info('Disconnected');
      // 同步清空 ref，防止 StrictMode 第二次 connect() 时误判已有连接
      if (wsRef.current === ws) {
        wsRef.current = null;
      }
      connectedSessionRef.current = null;
      pendingInputsRef.current = [];
      isRunningRef.current = false;
    };

    ws.onerror = (err) => {
      log.error('Connection error', err);
    };
  }, [sessionId, handleEvent, addTerminalLine, addTerminalChunk]);

  const disconnect = useCallback(() => {
    pendingInputsRef.current = [];
    isRunningRef.current = false;
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'kill_session', sessionId } as WSClientMessage));
      }
      wsRef.current.close();
      // 同步清空 ref（onclose 会在之后异步触发，但 ref 需要立即可见）
      wsRef.current = null;
      connectedSessionRef.current = null;
    }
    reset();
  }, [sessionId, reset]);

  const sendInput = useCallback((input: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // 已连接，立即发送
      if (isRunningRef.current) {
        // 当前有任务在运行，入队
        log.info('Queueing input (running)');
        pendingInputsRef.current.push(input);
        useTaskStore.getState().updatePendingInputsCount(pendingInputsRef.current.length);
        return;
      }
      isRunningRef.current = true;
      wsRef.current.send(JSON.stringify({ type: 'send_input', sessionId, input } as WSClientMessage));
      // queryId 由服务端生成并广播过来，客户端等待 WS 消息即可
    } else {
      // 未连接，加入预连接队列（StrictMode 等场景），OPEN 后自动发送
      log.info('WS not ready, queueing for later');
      preConnectQueueRef.current.push(input);
      useTaskStore.getState().updatePendingInputsCount(preConnectQueueRef.current.length);
    }
  }, [sessionId]);

  // 自动重连 + 连接初始化：监听 WebSocket 断开，超时后自动重连
  useEffect(() => {
    if (!sessionId) return;

    // 立即连接
    connect();

    // 每 3 秒检查一次，如果断了就自动重连
    const timer = setInterval(() => {
      if (wsRef.current?.readyState !== WebSocket.OPEN) {
        log.info('Auto-reconnect: WebSocket not open, reconnecting...');
        connect();
      }
    }, 3000);

    return () => {
      clearInterval(timer);
      disconnect();
    };
  }, [sessionId, connect, disconnect]);

  return { sendInput, disconnect, connect };
}
