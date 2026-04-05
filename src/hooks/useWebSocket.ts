import { useEffect, useRef, useCallback } from 'react';
import { useTaskStore } from '../stores/useTaskStore';
import { createLogger } from '../utils/logger';
import type { WSMessage, WSClientMessage } from '../types/events';

const log = createLogger('WebSocket');
const WS_URL = `ws://localhost:5300`;

export function useWebSocket(sessionId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const { handleEvent, addTerminalLine, reset } = useTaskStore();

  const connect = useCallback(() => {
    if (!sessionId) return;

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
        const payload: WSMessage = JSON.parse(event.data);
        handleEvent(payload.event);
        addTerminalLine(JSON.stringify(payload.event));
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
    if (wsRef.current && sessionId) {
      wsRef.current.send(JSON.stringify({ type: 'kill_session', sessionId } as WSClientMessage));
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
