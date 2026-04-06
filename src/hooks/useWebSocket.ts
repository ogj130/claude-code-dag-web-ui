import { useEffect, useRef, useCallback } from 'react';
import { useTaskStore } from '../stores/useTaskStore';
import { createLogger } from '../utils/logger';
import type { WSMessage, WSClientMessage, WSTerminalMessage } from '../types/events';

const log = createLogger('WebSocket');
const WS_URL = `ws://localhost:5300`;

export function useWebSocket(sessionId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const { handleEvent, addTerminalLine, reset } = useTaskStore();

  const connect = useCallback(() => {
    if (!sessionId) return;

    useTaskStore.setState({ isStarting: true, error: null });

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      log.info(`Connected (session: ${sessionId})`);
      const msg: WSClientMessage = {
        type: 'start_session',
        sessionId,
        projectPath: '/Users/ouguangji/2026/cc-web-ui',
      };
      ws.send(JSON.stringify(msg));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WSMessage | WSTerminalMessage;
        if ('type' in msg && msg.type === 'terminal') {
          // 终端原始文本：直接追加显示
          addTerminalLine((msg as WSTerminalMessage).text);
        } else {
          // 结构化事件：发给 store 处理
          handleEvent((msg as WSMessage).event!);
        }
      } catch {
        addTerminalLine(event.data);
      }
    };

    ws.onclose = () => {
      log.info('Disconnected');
      wsRef.current = null;
    };

    ws.onerror = (err) => {
      log.error('Connection error', err);
    };
  }, [sessionId, handleEvent, addTerminalLine]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'kill_session', sessionId } as WSClientMessage));
      }
      wsRef.current.close();
      wsRef.current = null;
    }
    reset();
  }, [sessionId, reset]);

  const sendInput = useCallback((input: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && sessionId) {
      wsRef.current.send(JSON.stringify({
        type: 'send_input',
        sessionId,
        input,
      } as WSClientMessage));
    }
  }, [sessionId]);

  useEffect(() => {
    if (sessionId) {
      connect();
    }
    return () => { disconnect(); };
  }, [sessionId, connect, disconnect]);

  return { sendInput, disconnect };
}
