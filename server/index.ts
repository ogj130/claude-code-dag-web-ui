import { WebSocketServer, WebSocket } from 'ws';
import { ClaudeCodeProcess } from './ClaudeCodeProcess.js';
import { child as log } from './utils/logger.js';
import type { WSMessage, WSClientMessage } from '../src/types/events.js';

const PORT = 5300;
const logger = log('server');

const wss = new WebSocketServer({
  port: PORT,
  // 允许长连接，避免被代理或网关超时断开
  clientTracking: true,
});

const processManager = new ClaudeCodeProcess();
const clients = new Map<string, Set<WebSocket>>();

// WebSocket 心跳：每 25 秒 ping 一次，防止代理超时断开
function startHeartbeat() {
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    });
  }, 25_000);
  wss.on('close', () => clearInterval(interval));
}
startHeartbeat();

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

// 为每个 sessionId 只注册一次事件监听器
const registeredSessions = new Set<string>();

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

          // 每个 session 只注册一次监听器（防止重复）
          if (!registeredSessions.has(sessionId)) {
            registeredSessions.add(sessionId);

            processManager.on('event', (payload: WSMessage) => {
              if (payload.sessionId === sessionId) {
                broadcast(sessionId, JSON.stringify(payload));
              }
            });

            processManager.on('terminalLine', (payload: { text: string; sessionId: string; timestamp: number }) => {
              if (payload.sessionId === sessionId) {
                broadcast(sessionId, JSON.stringify({ type: 'terminal', text: payload.text, sessionId, timestamp: payload.timestamp }));
              }
            });

            processManager.on('close', ({ sessionId: closedId, code }) => {
              logger.info({ sessionId: closedId, code }, 'Session closed');
              registeredSessions.delete(closedId);
              broadcast(closedId, JSON.stringify({
                event: { type: 'session_end', sessionId: closedId, reason: `exit:${code}` },
                sessionId: closedId,
                timestamp: Date.now()
              }));
              clients.delete(closedId);
            });
          }

          processManager.spawn(sessionId, projectPath, prompt);
          break;
        }
        case 'send_input': {
          logger.info({ sessionId: msg.sessionId, input: msg.input }, 'send_input');
          processManager.sendInput(msg.sessionId, msg.input);
          break;
        }
        case 'kill_session': {
          logger.info({ sessionId: msg.sessionId }, 'Killing session');
          processManager.kill(msg.sessionId);
          break;
        }
      }
    } catch (err) {
      logger.error({ err }, 'Parse error');
    }
  });

  ws.on('close', () => {
    logger.info('Client disconnected');
    // 清理空客户端引用
    for (const [sid, socks] of clients.entries()) {
      socks.delete(ws);
      if (socks.size === 0) clients.delete(sid);
    }
  });

  ws.on('error', (err) => {
    logger.error({ err }, 'WebSocket error');
  });
});

logger.info(`WebSocket server running on ws://localhost:${PORT}`);
