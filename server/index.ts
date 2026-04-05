import { WebSocketServer, WebSocket } from 'ws';
import { ClaudeCodeProcess } from './ClaudeCodeProcess.js';
import type { WSMessage, WSClientMessage } from '../src/types/events.js';

const PORT = 3001;
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
  console.log('[WS] Client connected');

  ws.on('message', (data: Buffer) => {
    try {
      const msg: WSClientMessage = JSON.parse(data.toString());

      switch (msg.type) {
        case 'start_session': {
          const { sessionId, projectPath, prompt } = msg;
          console.log(`[WS] Starting session: ${sessionId}`);

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
          processManager.kill(msg.sessionId);
          clients.delete(msg.sessionId);
          break;
        }
      }
    } catch (err) {
      console.error('[WS] Parse error:', err);
    }
  });

  ws.on('close', () => {
    console.log('[WS] Client disconnected');
  });
});

console.log(`[CC Web Server] WebSocket server running on ws://localhost:${PORT}`);
