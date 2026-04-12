import { WebSocketServer, WebSocket } from 'ws';
import { ClaudeCodeProcess } from './ClaudeCodeProcess.js';
import { child as log } from './utils/logger.js';
// @ts-ignore
import type { WSMessage, WSClientMessage } from '../types/events.js';

const DEFAULT_PORT = 5300;
const logger = log('server');

/**
 * Dev 模式入口：创建 WS 服务器并直接启动（端口固定）
 * 由 tsx server/index.ts 直接运行
 */
export function startServer(port: number = DEFAULT_PORT): WebSocketServer {
  const wss = new WebSocketServer({ port });
  start(wss, port);
  return wss;
}

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

/**
 * 注册 WebSocket 事件处理（不创建服务器）
 * Dev 模式由 startServer() 调用，Electron 打包模式由 main.ts 调用
 */
export function start(wss: WebSocketServer, port: number = DEFAULT_PORT): void {
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

  logger.info(`WebSocket server running on ws://localhost:${port}`);
}

// ── Dev 模式入口 ─────────────────────────────────────────────
// 直接运行 tsx server/index.ts 启动独立 WS 服务器（端口固定为 5300）
// 在 Electron 打包模式下，此文件由 main.ts 通过 import() 调用，
// 仅注册事件处理（由 main.ts 控制 WS Server 的创建和端口分配）
if (require.main === module) {
  startServer();
}
