import { WebSocketServer, WebSocket } from 'ws';
import { ClaudeCodeProcess } from './ClaudeCodeProcess.js';
import { child as log } from './utils/logger.js';
import type { WSMessage, WSClientMessage } from '../src/types/events.js';

const PORT = 5300;
const logger = log('server');

const wss = new WebSocketServer({ port: PORT });
const processManager = new ClaudeCodeProcess();
const clients = new Map<string, Set<WebSocket>>();

function broadcast(sessionId: string, message: string): void {
  const sockets = clients.get(sessionId);
  if (sockets) {
    for (const socket of sockets) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(message);
      }
    }
  }
}

wss.on('connection', (ws: WebSocket) => {
  logger.info('Client connected');

  ws.on('message', (data: Buffer) => {
    try {
      const msg: WSClientMessage = JSON.parse(data.toString());

      switch (msg.type) {
        case 'start_session': {
          const { sessionId, projectPath, prompt } = msg;
          logger.info({ sessionId, projectPath }, 'Starting session');

          if (!clients.has(sessionId)) {
            clients.set(sessionId, new Set());
          }
          clients.get(sessionId)!.add(ws);

          processManager.spawn(sessionId, projectPath, prompt);

          processManager.on('event', (payload: WSMessage) => {
            if (payload.sessionId === sessionId) {
              broadcast(sessionId, JSON.stringify(payload));
            }
          });

          processManager.on('close', ({ sessionId, code }) => {
            logger.info({ sessionId, code }, 'Session closed');
            broadcast(sessionId, JSON.stringify({
              event: { type: 'session_end', sessionId, reason: `exit:${code}` },
              sessionId,
              timestamp: Date.now()
            }));
          });
          break;
        }
        case 'send_input': {
          processManager.sendInput(msg.sessionId, msg.input);
          break;
        }
        case 'kill_session': {
          logger.info({ sessionId: msg.sessionId }, 'Killing session');
          processManager.kill(msg.sessionId);
          clients.delete(msg.sessionId);
          break;
        }
      }
    } catch (err) {
      logger.error({ err }, 'Parse error');
    }
  });

  ws.on('close', () => {
    logger.info('Client disconnected');
  });
});

logger.info(`WebSocket server running on ws://localhost:${PORT}`);
