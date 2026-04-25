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
// 正在切换模型的 sessionId（close 回调跳过清理）
const switchingModels = new Set<string>();

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
            const { sessionId, projectPath, prompt, modelOptions } = msg as any;
            logger.info({ sessionId, projectPath, modelOptions }, 'Starting session');

            if (!clients.has(sessionId)) {
              clients.set(sessionId, new Set());
            }
            clients.get(sessionId)!.add(ws);

            // 每个 session 只注册一次监听器（防止重复）
            if (!registeredSessions.has(sessionId)) {
              registeredSessions.add(sessionId);

              processManager.on('event', (payload: WSMessage) => {
                if (payload.sessionId === sessionId) {
                  // 模型切换期间：过滤掉 kill 触发的 session_end，避免前端误重置状态
                  if (switchingModels.has(sessionId) && (payload as any).event?.type === 'session_end') {
                    logger.info({ sessionId }, 'Suppressing session_end during model switch');
                    return;
                  }
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
                // code=null 表示 SIGTERM/SIGKILL（被杀），其他为自然退出
                const reason = code === null ? 'killed' : `exit:${code}`;
                logger.info({ sessionId: closedId, code, reason }, 'Session closed');

                // 模型切换期间：跳过清理，保留 clients 和 registeredSessions
                if (switchingModels.has(closedId)) {
                  logger.info({ sessionId: closedId }, 'Skipping close cleanup (model switching)');
                  switchingModels.delete(closedId);
                  return;
                }

                registeredSessions.delete(closedId);
                broadcast(closedId, JSON.stringify({
                  event: { type: 'session_end', sessionId: closedId, reason: `exit:${code}` },
                  sessionId: closedId,
                  timestamp: Date.now()
                }));
                clients.delete(closedId);
              });
            }

            // 幂等保护：相同 sessionId + 相同 projectPath 时，跳过 re-spawn
            // （React StrictMode 等场景会触发重复 start_session，避免误杀健康进程）
            if (processManager.isRunning(sessionId)) {
              const existingPath = processManager.getSessionPath(sessionId);
              if (existingPath === projectPath) {
                // 检查 ws 是否已在 clients 中（幂等：同一 ws 重连跳过添加）
                // 若 ws 不同（StrictMode 新建了第二个连接），则替换旧的闭包 ws
                const existingSockets = clients.get(sessionId)!;
                if (existingSockets.has(ws)) {
                  logger.info({ sessionId }, 'WebSocket already registered for session, skipping');
                } else {
                  logger.info({ sessionId, existingSockets: existingSockets.size }, 'Replacing stale WebSocket for session (StrictMode duplicate connection)');
                  // 清理可能已关闭的旧 ws（防止广播到死连接）
                  for (const oldWs of existingSockets) {
                    if (oldWs.readyState !== WebSocket.OPEN) {
                      existingSockets.delete(oldWs);
                    }
                  }
                  existingSockets.add(ws);
                }
                break;
              }
              // 路径改变时：正常切换（保留 kill 逻辑）
              logger.info({ sessionId, existingPath, newPath: projectPath }, 'Killing existing process (path changed)');
              processManager.kill(sessionId);
            }

            processManager.spawn(sessionId, projectPath, {
              prompt,
              model: modelOptions?.model,
              baseUrl: modelOptions?.baseUrl,
              apiKey: modelOptions?.apiKey,
            });
            break;
          }
          case 'send_input': {
            logger.info({ sessionId: msg.sessionId, input: msg.input }, 'send_input');
            // 检查会话进程是否存活：若已关闭，向客户端广播错误并重置 isRunning 状态
            if (!processManager.isRunning(msg.sessionId)) {
              logger.warn({ sessionId: msg.sessionId }, 'send_input to closed session, broadcasting error');
              broadcast(msg.sessionId, JSON.stringify({
                event: {
                  type: 'error',
                  message: '会话已结束（进程已退出），请刷新页面重新开始',
                },
                sessionId: msg.sessionId,
                timestamp: Date.now(),
              }));
              break;
            }
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
          case 'switch_model': {
            const { sessionId, modelOptions } = msg as any;
            logger.info({ sessionId, modelOptions }, 'Switching model');

            // 获取 session 对应的 projectPath
            const projectPath = processManager.getSessionPath(sessionId);
            if (!projectPath) {
              logger.warn({ sessionId }, 'Session path not found for model switch');
              break;
            }

            // 标记正在切换模型：close 回调跳过清理 clients/registeredSessions
            switchingModels.add(sessionId);

            // 先 kill 现有进程
            processManager.kill(sessionId);

            // 重新 spawn，使用新的模型选项
            processManager.spawn(sessionId, projectPath, {
              model: modelOptions?.model,
              baseUrl: modelOptions?.baseUrl,
              apiKey: modelOptions?.apiKey,
            });
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

// ESM 模式入口检测
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  startServer();
}
