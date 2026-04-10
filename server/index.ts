import { WebSocketServer, WebSocket } from 'ws';
import { ClaudeCodeProcess } from './ClaudeCodeProcess.js';
import { child as log } from './utils/logger.js';
// @ts-ignore
import type { WSMessage, WSClientMessage } from '../types/events.js';

const PORT = 5300;
const logger = log('server');

const processManager = new ClaudeCodeProcess();
// 放宽监听器上限：StrictMode 等场景会快速创建多个 session
processManager.setMaxListeners(100);
const clients = new Map<string, Set<WebSocket>>();

// 为每个 sessionId 只注册一次事件监听器
const registeredSessions = new Set<string>();

// WebSocket 心跳：每 25 秒 ping 一次，防止代理超时断开
function startHeartbeat(wss: WebSocketServer) {
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    });
  }, 25_000);
  wss.on('close', () => clearInterval(interval));
}

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

export function start(wss: WebSocketServer): void {
  startHeartbeat(wss);

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

              processManager.on('terminalChunk', (payload: { text: string; sessionId: string; timestamp: number }) => {
                if (payload.sessionId === sessionId) {
                  broadcast(sessionId, JSON.stringify({
                    type: 'terminalChunk',
                    text: payload.text,
                    sessionId: payload.sessionId,
                    timestamp: payload.timestamp,
                  }));
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

            // 如果该 session 已有运行中的进程，先杀掉（支持路径切换场景）
            if (processManager.isRunning(sessionId)) {
              logger.info({ sessionId }, 'Killing existing process before re-spawn');
              processManager.kill(sessionId);
            }

            processManager.spawn(sessionId, projectPath, prompt);
            break;
          }
          case 'send_input': {
            logger.info({ sessionId: msg.sessionId, input: msg.input }, 'send_input');
            const queryId = processManager.sendInput(msg.sessionId, msg.input);
            if (queryId) {
              broadcast(msg.sessionId, JSON.stringify({
                event: {
                  type: 'user_input_sent',
                  queryId,
                  text: msg.input,
                },
                sessionId: msg.sessionId,
                timestamp: Date.now(),
              }));
              broadcast(msg.sessionId, JSON.stringify({
                event: {
                  type: 'query_start',
                  queryId,
                  label: msg.input.length > 30 ? msg.input.slice(0, 30) + '…' : msg.input,
                },
                sessionId: msg.sessionId,
                timestamp: Date.now(),
              }));
            }
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
}
