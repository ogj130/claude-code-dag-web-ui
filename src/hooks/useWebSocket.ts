import { useEffect, useRef, useCallback } from 'react';
import { useTaskStore } from '../stores/useTaskStore';
import { createLogger } from '../utils/logger';
import type { WSMessage, WSClientMessage, WSTerminalMessage, WSTerminalChunkMessage } from '../types/events';

const log = createLogger('WebSocket');
const WS_URL = `ws://localhost:5300`;

export function useWebSocket(sessionId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const { handleEvent, addTerminalLine, addTerminalChunk, reset } = useTaskStore();

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
        const msg = event.data;
        const parsed = JSON.parse(msg);
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
        handleEvent((parsed as WSMessage).event!);
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
  }, [sessionId, handleEvent, addTerminalLine, addTerminalChunk]);

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
