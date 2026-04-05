# CC Web — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个完整的 CC Web 应用——本地运行 Claude Code CLI，通过 WebSocket 实时拉取输出，前端以 DAG + 终端/卡片视图可视化展示。

**Architecture:** Node.js 后端 spawn Claude Code CLI 进程，通过 ANSI Parser 解析彩色终端输出为结构化事件，通过 WebSocket 推送给 React 前端；前端用 Zustand 管理任务状态，React Flow 渲染 DAG。

**Tech Stack:** React 18 + TypeScript + Vite | React Flow | Zustand | xterm.js | Node.js WebSocket (ws) | child_process | parse-colorful-output

---

## 文件结构

```
cc-web-ui/
├── server/                          # Node.js 后端
│   ├── index.ts                      # WS Server 入口，端口 3001
│   ├── ClaudeCodeProcess.ts          # 进程管理（spawn/kill/input）
│   ├── AnsiParser.ts                 # ANSI 彩色输出 → 结构化事件
│   └── eventEmitter.ts               # 事件标准化与分发
├── src/                             # React 前端
│   ├── main.tsx                     # Vite 入口
│   ├── App.tsx                      # 根组件，主题 + 布局
│   ├── components/
│   │   ├── Toolbar/
│   │   │   ├── Toolbar.tsx          # 顶部工具栏容器
│   │   │   ├── TokenBar.tsx         # Token 统计条
│   │   │   ├── SessionDropdown.tsx  # 会话下拉菜单
│   │   │   └── ThemeToggle.tsx      # 主题切换按钮
│   │   ├── DAG/
│   │   │   ├── DAGCanvas.tsx        # React Flow 画布容器
│   │   │   └── DAGNode.tsx          # 自定义节点组件
│   │   ├── ToolView/
│   │   │   ├── ToolViewPanel.tsx    # 工具视图容器（终端+卡片切换）
│   │   │   ├── TerminalView.tsx     # xterm.js 终端
│   │   │   └── ToolCards.tsx        # 工具卡片列表
│   │   └── BottomBar/
│   │       └── RecentTools.tsx       # 底部最近工具状态
│   ├── stores/
│   │   ├── useTaskStore.ts          # DAG 节点 + 工具调用状态
│   │   └── useSessionStore.ts        # 会话列表 + 当前会话
│   ├── hooks/
│   │   └── useWebSocket.ts           # WS 连接管理 + 事件分发
│   └── types/
│       └── events.ts                 # ClaudeEvent 类型定义
├── package.json
├── tsconfig.json
├── vite.config.ts
└── index.html
```

---

## Phase 1 — 项目骨架 & 前后端通信

### Task 1: 项目初始化

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "cc-web-ui",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:client\"",
    "dev:client": "vite",
    "dev:server": "tsx watch server/index.ts",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@xyflow/react": "^12.3.6",
    "zustand": "^5.0.3",
    "@xterm/xterm": "^5.5.0",
    "@xterm/addon-fit": "^0.10.0",
    "ws": "^8.18.0",
    "parse-colorful-output": "^1.0.3"
  },
  "devDependencies": {
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "@types/ws": "^8.5.14",
    "@types/node": "^22.10.7",
    "typescript": "^5.7.3",
    "vite": "^6.0.11",
    "@vitejs/plugin-react": "^4.3.4",
    "tsx": "^4.19.2",
    "concurrently": "^9.1.2"
  }
}
```

- [ ] **Step 2: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src", "server"]
}
```

- [ ] **Step 3: 创建 vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: {
    port: 5173,
    proxy: { '/ws': { target: 'ws://localhost:3001', ws: true } }
  }
})
```

- [ ] **Step 4: 创建 index.html**

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <title>CC Web</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: 运行 npm install**

Run: `cd /Users/ouguangji/2026/cc-web-ui && npm install`
Expected: 所有依赖安装完成，无 error

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.json vite.config.ts index.html
git commit -m "chore: 初始化项目骨架，配置 Vite + TypeScript"
```

---

### Task 2: 事件类型定义

**Files:**
- Create: `src/types/events.ts`

- [ ] **Step 1: 创建事件类型定义**

```typescript
// src/types/events.ts

export type NodeStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface DAGNode {
  id: string;
  label: string;
  status: NodeStatus;
  type: 'agent' | 'tool';
  parentId?: string;
  startTime?: number;
  endTime?: number;
}

export interface ToolCall {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'error';
  result?: string;
  startTime: number;
  endTime?: number;
}

export interface TokenUsage {
  input: number;
  output: number;
}

export type ClaudeEvent =
  | { type: 'agent_start'; agentId: string; label: string; parentId?: string }
  | { type: 'agent_end'; agentId: string; result?: string }
  | { type: 'tool_call'; toolId: string; tool: string; args: Record<string, unknown> }
  | { type: 'tool_result'; toolId: string; result: unknown; status: 'success' | 'error' }
  | { type: 'tool_progress'; toolId: string; message: string }
  | { type: 'token_usage'; usage: TokenUsage }
  | { type: 'error'; message: string }
  | { type: 'session_start'; sessionId: string }
  | { type: 'session_end'; sessionId: string; reason?: string };

// WebSocket 消息格式
export interface WSMessage {
  event: ClaudeEvent;
  sessionId: string;
  timestamp: number;
}

// WS 客户端→服务端消息
export type WSClientMessage =
  | { type: 'start_session'; sessionId: string; projectPath: string; prompt?: string }
  | { type: 'send_input'; sessionId: string; input: string }
  | { type: 'kill_session'; sessionId: string };
```

- [ ] **Step 2: Commit**

```bash
git add src/types/events.ts
git commit -m "feat: 定义 ClaudeEvent 和相关类型"
```

---

### Task 3: 后端 WebSocket Server + ANSI Parser

**Files:**
- Create: `server/index.ts`
- Create: `server/ClaudeCodeProcess.ts`
- Create: `server/AnsiParser.ts`
- Create: `server/eventEmitter.ts`

- [ ] **Step 1: 创建 ANSI Parser（事件解析器）**

```typescript
// server/AnsiParser.ts
import { EventEmitter } from 'events';
import type { ClaudeEvent } from '../src/types/events.js';

export class AnsiParser extends EventEmitter {
  private buffer = '';
  private currentTool: { id: string; tool: string; args: string } | null = null;

  feed(data: string): void {
    this.buffer += data;

    // 按行处理
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() ?? '';

    for (const line of lines) {
      const event = this.parseLine(line);
      if (event) {
        this.emit('event', event);
      }
    }
  }

  flush(): void {
    if (this.buffer) {
      const event = this.parseLine(this.buffer);
      if (event) this.emit('event', event);
      this.buffer = '';
    }
  }

  private parseLine(line: string): ClaudeEvent | null {
    // 去掉 ANSI 转义序列
    const clean = line.replace(/\x1b\[[0-9;]*m/g, '').trim();
    if (!clean) return null;

    // 检测 Agent 启动: ››› Agent: 子任务 A 启动
    const agentMatch = clean.match(/›››\s*Agent:\s*(.+?)\s*(启动|开始|start)/);
    if (agentMatch) {
      return { type: 'agent_start', agentId: `agent_${Date.now()}`, label: agentMatch[1] };
    }

    // 检测 Agent 完成
    const agentEnd = clean.match(/›››\s*Agent:\s*(.+?)\s*(✓|完成|end|done)/);
    if (agentEnd) {
      return { type: 'agent_end', agentId: `agent_${Date.now()}`, result: agentEnd[1] };
    }

    // 检测工具调用: ››› Bash, ››› Read, ››› Grep 等
    const toolMatch = clean.match(/›››\s*([A-Za-z]+)\s*(.*)/);
    if (toolMatch && !clean.includes('Agent')) {
      const tool = toolMatch[1].toLowerCase();
      const toolId = `tool_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      return {
        type: 'tool_call',
        toolId,
        tool,
        args: { raw: toolMatch[2] || '' }
      };
    }

    // 检测成功结果
    if (clean.startsWith('✓') || clean.includes('完成') || clean.includes('success')) {
      return { type: 'tool_result', toolId: 'last', result: clean, status: 'success' };
    }

    // 检测错误
    if (clean.includes('error') || clean.includes('Error') || clean.includes('失败')) {
      return { type: 'tool_result', toolId: 'last', result: clean, status: 'error' };
    }

    // 检测 Token 用量
    const tokenMatch = clean.match(/tokens?[:\s]+(\d+)/i);
    if (tokenMatch) {
      return { type: 'token_usage', usage: { input: parseInt(tokenMatch[1]), output: 0 } };
    }

    return null;
  }
}
```

- [ ] **Step 2: 创建 ClaudeCodeProcess（进程管理器）**

```typescript
// server/ClaudeCodeProcess.ts
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { AnsiParser } from './AnsiParser.js';
import type { ClaudeEvent } from '../src/types/events.js';

export class ClaudeCodeProcess extends EventEmitter {
  private processes = new Map<string, ChildProcess>();
  private parsers = new Map<string, AnsiParser>();

  spawn(sessionId: string, projectPath: string, prompt?: string): void {
    if (this.processes.has(sessionId)) {
      this.kill(sessionId);
    }

    const proc = spawn('claude', [], {
      cwd: projectPath,
      shell: true,
      env: { ...process.env, CLAUDE_NO_INTERACTION: '1' }
    });

    this.processes.set(sessionId, proc);

    const parser = new AnsiParser();
    this.parsers.set(sessionId, parser);

    parser.on('event', (event: ClaudeEvent) => {
      this.emit('event', { event, sessionId, timestamp: Date.now() });
    });

    proc.stdout?.on('data', (data: Buffer) => {
      parser.feed(data.toString());
    });

    proc.stderr?.on('data', (data: Buffer) => {
      parser.feed(data.toString());
    });

    proc.on('close', (code) => {
      parser.flush();
      this.emit('close', { sessionId, code });
      this.processes.delete(sessionId);
      this.parsers.delete(sessionId);
    });

    proc.on('error', (err) => {
      this.emit('error', { sessionId, error: err.message });
    });

    // 如果有初始 prompt，发送它
    if (prompt) {
      proc.stdin?.write(prompt + '\n');
    }

    this.emit('event', {
      event: { type: 'session_start', sessionId },
      sessionId,
      timestamp: Date.now()
    });
  }

  sendInput(sessionId: string, input: string): void {
    const proc = this.processes.get(sessionId);
    if (proc?.stdin) {
      proc.stdin.write(input + '\n');
    }
  }

  kill(sessionId: string): void {
    const proc = this.processes.get(sessionId);
    if (proc) {
      proc.kill('SIGTERM');
      this.processes.delete(sessionId);
      this.parsers.delete(sessionId);
      this.emit('event', {
        event: { type: 'session_end', sessionId, reason: 'killed' },
        sessionId,
        timestamp: Date.now()
      });
    }
  }

  isRunning(sessionId: string): boolean {
    return this.processes.has(sessionId);
  }
}
```

- [ ] **Step 3: 创建 WebSocket Server**

```typescript
// server/index.ts
import { WebSocketServer, WebSocket } from 'ws';
import { ClaudeCodeProcess } from './ClaudeCodeProcess.js';
import type { WSMessage, WSClientMessage } from '../src/types/events.js';

const PORT = 3001;
const wss = new WebSocketServer({ port: PORT });
const processManager = new ClaudeCodeProcess();

const clients = new Map<string, Set<WebSocket>>();

wss.on('connection', (ws: WebSocket) => {
  console.log('[WS] Client connected');

  ws.on('message', (data: Buffer) => {
    try {
      const msg: WSClientMessage = JSON.parse(data.toString());

      switch (msg.type) {
        case 'start_session': {
          const { sessionId, projectPath, prompt } = msg;
          console.log(`[WS] Starting session: ${sessionId}`);

          // 订阅该 session 的进程事件
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

console.log(`[CC Web Server] WebSocket server running on ws://localhost:${PORT}`);
```

- [ ] **Step 4: Commit**

```bash
git add server/
git commit -m "feat(server): WebSocket server + ANSI parser + Claude 进程管理"
```

---

### Task 4: 前端基础 — 入口 + App + 主题系统

**Files:**
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles/theme.css`

- [ ] **Step 1: 创建 main.tsx**

```tsx
// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles/theme.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 2: 创建全局主题 CSS（支持暗黑/亮色）**

```css
/* src/styles/theme.css */

:root {
  --bg-root: #0d0d1a;
  --bg-panel: #0a0a14;
  --bg-card: #13132a;
  --bg-card-hover: #161630;
  --bg-input: #1a1a30;
  --bg-terminal: #050508;
  --bg-bar: #0c0c1a;
  --bg-tab: #1a1a30;
  --border: #1e1e3f;
  --border-card: #1e1e3f;
  --border-hover: #333;
  --text-primary: #e0e0e0;
  --text-secondary: #aaa;
  --text-muted: #666;
  --text-dim: #444;
  --accent: #4a8eff;
  --accent-dim: #3a7eef;
  --success: #2ecc71;
  --success-bg: #0a1f0e;
  --success-border: #1a4020;
  --warn: #f1c40f;
  --warn-bg: #1a1500;
  --warn-border: #3a3000;
  --error: #e74c3c;
  --error-bg: #1f0a0a;
  --error-border: #3a1a1a;
  --pending: #555;
  --pending-bg: #111120;
  --pending-border: #222240;
  --dag-bg: #0a0a14;
  --dag-dot: #1a1a30;
  --dag-node-border: #2a2a50;
  --term-bg: #050508;
  --term-border: #1a1a2a;
}

.theme-light {
  --bg-root: #f5f6fa;
  --bg-panel: #ffffff;
  --bg-card: #f8f9fc;
  --bg-card-hover: #eff1f7;
  --bg-input: #eff1f7;
  --bg-terminal: #fafafa;
  --bg-bar: #f0f1f5;
  --bg-tab: #eef0f5;
  --border: #e2e4ec;
  --border-card: #e2e4ec;
  --border-hover: #c8ccd8;
  --text-primary: #1a1a2e;
  --text-secondary: #5a5a7a;
  --text-muted: #8888aa;
  --text-dim: #b0b0cc;
  --accent: #3a6fd8;
  --accent-dim: #2a5fc8;
  --success: #1a9e50;
  --success-bg: #edfaf2;
  --success-border: #c0ecd0;
  --warn: #c07800;
  --warn-bg: #fff8e0;
  --warn-border: #f0d880;
  --error: #d03030;
  --error-bg: #fff0f0;
  --error-border: #f0c0c0;
  --pending: #aaaacc;
  --pending-bg: #f0f0fa;
  --pending-border: #d8d8f0;
  --dag-bg: #fafbfe;
  --dag-dot: #e8eaf2;
  --dag-node-border: #d8d8ec;
  --term-bg: #fafafa;
  --term-border: #e0e0e8;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: var(--bg-root);
  color: var(--text-primary);
  min-height: 100vh;
  overflow: hidden;
  transition: background 0.3s, color 0.3s;
}

#root {
  display: flex;
  flex-direction: column;
  height: 100vh;
}
```

- [ ] **Step 3: 创建 App.tsx（主题 + 整体布局）**

```tsx
// src/App.tsx
import { useState } from 'react';
import { Toolbar } from './components/Toolbar/Toolbar';
import { DAGCanvas } from './components/DAG/DAGCanvas';
import { ToolViewPanel } from './components/ToolView/ToolViewPanel';
import { BottomBar } from './components/BottomBar/RecentTools';
import { useTaskStore } from './stores/useTaskStore';

export function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [viewMode, setViewMode] = useState<'terminal' | 'cards'>('terminal');

  const applyTheme = (t: 'dark' | 'light') => {
    setTheme(t);
    document.documentElement.classList.remove('theme-dark', 'theme-light');
    document.documentElement.classList.add(`theme-${t}`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Toolbar
        theme={theme}
        onThemeChange={applyTheme}
      />
      <div style={{
        display: 'flex',
        flex: 1,
        overflow: 'hidden',
        borderTop: '1px solid var(--border)'
      }}>
        <DAGCanvas style={{ flex: 1 }} />
        <ToolViewPanel
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          style={{ width: 420, borderLeft: '1px solid var(--border)' }}
        />
      </div>
      <BottomBar />
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/main.tsx src/App.tsx src/styles/theme.css
git commit -m "feat: 前端入口 + 主题系统 + 整体布局"
```

---

## Phase 2 — Zustand 状态管理

### Task 5: Zustand Stores

**Files:**
- Create: `src/stores/useTaskStore.ts`
- Create: `src/stores/useSessionStore.ts`

- [ ] **Step 1: 创建 useTaskStore**

```typescript
// src/stores/useTaskStore.ts
import { create } from 'zustand';
import type { DAGNode, ToolCall, TokenUsage, ClaudeEvent } from '../types/events';

interface TaskState {
  // DAG 节点
  nodes: Map<string, DAGNode>;
  // 工具调用记录
  toolCalls: ToolCall[];
  // Token 统计
  tokenUsage: TokenUsage;
  // 原始终端输出（用于 TerminalView）
  terminalLines: string[];
  // 当前运行状态
  isRunning: boolean;

  // Actions
  handleEvent: (event: ClaudeEvent) => void;
  addTerminalLine: (line: string) => void;
  reset: () => void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  nodes: new Map(),
  toolCalls: [],
  tokenUsage: { input: 0, output: 0 },
  terminalLines: [],
  isRunning: false,

  handleEvent: (event: ClaudeEvent) => {
    const { nodes, toolCalls } = get();

    switch (event.type) {
      case 'agent_start': {
        const newNodes = new Map(nodes);
        const newNode: DAGNode = {
          id: event.agentId,
          label: event.label,
          status: 'running',
          type: 'agent',
          parentId: event.parentId,
          startTime: Date.now(),
        };
        newNodes.set(event.agentId, newNode);
        set({ nodes: newNodes, isRunning: true });
        break;
      }
      case 'agent_end': {
        const newNodes = new Map(nodes);
        const node = newNodes.get(event.agentId);
        if (node) {
          newNodes.set(event.agentId, { ...node, status: 'completed', endTime: Date.now() });
        }
        set({ nodes: newNodes });
        break;
      }
      case 'tool_call': {
        const toolCall: ToolCall = {
          id: event.toolId,
          tool: event.tool,
          args: event.args,
          status: 'running',
          startTime: Date.now(),
        };
        set({ toolCalls: [...toolCalls, toolCall] });
        break;
      }
      case 'tool_result': {
        const idx = toolCalls.findIndex(t => t.id === event.toolId || t.id === 'last');
        if (idx >= 0) {
          const updated = [...toolCalls];
          updated[idx] = {
            ...updated[idx],
            status: event.status === 'success' ? 'completed' : 'error',
            result: String(event.result),
            endTime: Date.now(),
          };
          set({ toolCalls: updated });
        }
        break;
      }
      case 'token_usage': {
        set({ tokenUsage: event.usage });
        break;
      }
      case 'session_end': {
        set({ isRunning: false });
        break;
      }
    }
  },

  addTerminalLine: (line: string) => {
    set(state => ({
      terminalLines: [...state.terminalLines.slice(-500), line]
    }));
  },

  reset: () => {
    set({
      nodes: new Map(),
      toolCalls: [],
      tokenUsage: { input: 0, output: 0 },
      terminalLines: [],
      isRunning: false,
    });
  },
}));
```

- [ ] **Step 2: 创建 useSessionStore**

```typescript
// src/stores/useSessionStore.ts
import { create } from 'zustand';

export interface Session {
  id: string;
  name: string;
  projectPath: string;
  createdAt: number;
  isActive: boolean;
}

interface SessionState {
  sessions: Session[];
  activeSessionId: string | null;

  addSession: (session: Session) => void;
  removeSession: (id: string) => void;
  setActive: (id: string) => void;
  renameSession: (id: string, name: string) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  sessions: [],
  activeSessionId: null,

  addSession: (session) => {
    set(state => ({
      sessions: [...state.sessions, session],
      activeSessionId: session.id,
    }));
  },

  removeSession: (id) => {
    set(state => {
      const sessions = state.sessions.filter(s => s.id !== id);
      const activeSessionId = state.activeSessionId === id
        ? (sessions[0]?.id ?? null)
        : state.activeSessionId;
      return { sessions, activeSessionId };
    });
  },

  setActive: (id) => {
    set({ activeSessionId: id });
  },

  renameSession: (id, name) => {
    set(state => ({
      sessions: state.sessions.map(s => s.id === id ? { ...s, name } : s),
    }));
  },
}));
```

- [ ] **Step 3: Commit**

```bash
git add src/stores/useTaskStore.ts src/stores/useSessionStore.ts
git commit -m "feat: Zustand 状态管理 stores"
```

---

## Phase 3 — 核心组件实现

### Task 6: WebSocket Hook + 连接管理

**Files:**
- Create: `src/hooks/useWebSocket.ts`

- [ ] **Step 1: 创建 useWebSocket hook**

```typescript
// src/hooks/useWebSocket.ts
import { useEffect, useRef, useCallback } from 'react';
import { useTaskStore } from '../stores/useTaskStore';
import type { WSMessage, WSClientMessage } from '../types/events';

const WS_URL = `ws://${window.location.hostname}:3001`;

export function useWebSocket(sessionId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const { handleEvent, addTerminalLine, reset } = useTaskStore();

  const connect = useCallback(() => {
    if (!sessionId) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected');
      // 通知后端启动会话
      const msg: WSClientMessage = {
        type: 'start_session',
        sessionId,
        projectPath: window.location.pathname || process.cwd(),
      };
      ws.send(JSON.stringify(msg));
    };

    ws.onmessage = (event) => {
      try {
        const payload: WSMessage = JSON.parse(event.data);
        handleEvent(payload.event);
        addTerminalLine(JSON.stringify(payload.event));
      } catch {
        // 原始行（用于 TerminalView）
        addTerminalLine(event.data);
      }
    };

    ws.onclose = () => {
      console.log('[WS] Disconnected');
      wsRef.current = null;
    };

    ws.onerror = (err) => {
      console.error('[WS] Error:', err);
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
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useWebSocket.ts
git commit -m "feat: WebSocket hook"
```

---

### Task 7: 顶部工具栏组件

**Files:**
- Create: `src/components/Toolbar/Toolbar.tsx`
- Create: `src/components/Toolbar/TokenBar.tsx`
- Create: `src/components/Toolbar/SessionDropdown.tsx`
- Create: `src/components/Toolbar/ThemeToggle.tsx`

- [ ] **Step 1: 创建 ThemeToggle**

```tsx
// src/components/Toolbar/ThemeToggle.tsx
import React from 'react';

interface Props {
  theme: 'dark' | 'light';
  onChange: (t: 'dark' | 'light') => void;
}

export function ThemeToggle({ theme, onChange }: Props) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      background: 'var(--bg-input)',
      border: '1px solid var(--border)',
      borderRadius: 20,
      padding: 4,
    }}>
      <button
        onClick={() => onChange('dark')}
        title="暗黑模式"
        style={{
          width: 26, height: 26, borderRadius: '50%', border: 'none',
          background: theme === 'dark' ? 'var(--accent)' : 'transparent',
          color: theme === 'dark' ? 'white' : 'var(--text-dim)',
          cursor: 'pointer', fontSize: 13, transition: 'all 0.2s',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >🌙</button>
      <button
        onClick={() => onChange('light')}
        title="明亮模式"
        style={{
          width: 26, height: 26, borderRadius: '50%', border: 'none',
          background: theme === 'light' ? 'var(--accent)' : 'transparent',
          color: theme === 'light' ? 'white' : 'var(--text-dim)',
          cursor: 'pointer', fontSize: 13, transition: 'all 0.2s',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >☀️</button>
    </div>
  );
}
```

- [ ] **Step 2: 创建 TokenBar**

```tsx
// src/components/Toolbar/TokenBar.tsx
import React from 'react';
import { useTaskStore } from '../../stores/useTaskStore';

export function TokenBar() {
  const { tokenUsage } = useTaskStore();

  const fmt = (n: number) => n.toLocaleString();

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      background: 'var(--success-bg)',
      border: '1px solid var(--success-border)',
      padding: '5px 10px', borderRadius: 6, fontSize: 11,
    }}>
      <span style={{ color: 'var(--text-muted)' }}>Input:</span>
      <span style={{ fontWeight: 600, color: '#3498db' }}>{fmt(tokenUsage.input)}</span>
      <span style={{ color: 'var(--border)' }}>|</span>
      <span style={{ color: 'var(--text-muted)' }}>Output:</span>
      <span style={{ fontWeight: 600, color: 'var(--success)' }}>{fmt(tokenUsage.output)}</span>
      <span style={{ color: 'var(--border)' }}>|</span>
      <span style={{ color: 'var(--text-muted)' }}>Total:</span>
      <span style={{ fontWeight: 600, color: 'var(--accent)' }}>
        {fmt(tokenUsage.input + tokenUsage.output)}
      </span>
    </div>
  );
}
```

- [ ] **Step 3: 创建 SessionDropdown**

```tsx
// src/components/Toolbar/SessionDropdown.tsx
import React, { useState, useRef, useEffect } from 'react';
import { useSessionStore } from '../../stores/useSessionStore';

interface Props {
  onNewSession: () => void;
}

export function SessionDropdown({ onNewSession }: Props) {
  const { sessions, activeSessionId, setActive, removeSession } = useSessionStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const active = sessions.find(s => s.id === activeSessionId);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'var(--bg-input)', border: '1px solid var(--border)',
          padding: '6px 12px', borderRadius: 6, fontSize: 12,
          color: 'var(--text-secondary)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
          fontFamily: 'inherit', transition: 'all 0.2s',
        }}
      >
        <span style={{ color: 'var(--accent)' }}>●</span>
        <span>{active?.name ?? '选择会话'}</span>
        <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 8, minWidth: 220, zIndex: 200,
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)', overflow: 'hidden',
        }}>
          {sessions.map(s => (
            <div
              key={s.id}
              onClick={() => { setActive(s.id); setOpen(false); }}
              style={{
                padding: '10px 14px', fontSize: 12,
                color: s.id === activeSessionId ? 'var(--accent)' : 'var(--text-secondary)',
                background: s.id === activeSessionId ? 'var(--bg-input)' : 'transparent',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = s.id === activeSessionId ? 'var(--bg-input)' : 'transparent')}
            >
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'currentColor', flexShrink: 0,
              }}/>
              <span style={{ flex: 1 }}>{s.name}</span>
              <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                {new Date(s.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
          <div
            onClick={() => { onNewSession(); setOpen(false); }}
            style={{
              borderTop: '1px solid var(--border)', padding: '8px 14px',
              color: 'var(--accent)', fontSize: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-input)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >+ 新建会话</div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: 创建 Toolbar 容器**

```tsx
// src/components/Toolbar/Toolbar.tsx
import React from 'react';
import { TokenBar } from './TokenBar';
import { SessionDropdown } from './SessionDropdown';
import { ThemeToggle } from './ThemeToggle';
import { useSessionStore } from '../../stores/useSessionStore';

interface Props {
  theme: 'dark' | 'light';
  onThemeChange: (t: 'dark' | 'light') => void;
}

export function Toolbar({ theme, onThemeChange }: Props) {
  const { addSession } = useSessionStore();

  const handleNewSession = () => {
    const id = `session_${Date.now()}`;
    addSession({
      id,
      name: `会话 ${Date.now()}`,
      projectPath: '/',
      createdAt: Date.now(),
      isActive: true,
    });
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 16px',
      background: 'var(--bg-bar)',
      borderBottom: '1px solid var(--border)',
      transition: 'background 0.3s, border-color 0.3s',
    }}>
      <button
        onClick={handleNewSession}
        style={{
          background: 'var(--accent)', color: 'white',
          border: 'none', padding: '6px 14px', borderRadius: 6,
          fontSize: 12, fontWeight: 500, cursor: 'pointer',
          fontFamily: 'inherit', transition: 'background 0.2s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-dim)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent)')}
      >+ 新会话</button>

      <span style={{ color: 'var(--border)', fontSize: 12 }}>|</span>
      <SessionDropdown onNewSession={handleNewSession} />
      <span style={{ color: 'var(--border)', fontSize: 12 }}>|</span>
      <TokenBar />

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 7, height: 7, borderRadius: '50%',
          background: 'var(--success)',
          animation: 'pulse-green 2s infinite',
        }}/>
        <span style={{ fontSize: 11, color: 'var(--success)' }}>Connected</span>
        <span style={{ color: 'var(--border)', fontSize: 12 }}>|</span>
        <ThemeToggle theme={theme} onChange={onThemeChange} />
        <button style={{
          background: 'transparent', color: 'var(--text-muted)',
          border: '1px solid var(--border)', padding: '6px 12px',
          borderRadius: 6, fontSize: 12, cursor: 'pointer',
          fontFamily: 'inherit', transition: 'all 0.2s',
        }}>⚙ 设置</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/Toolbar/
git commit -m "feat: 顶部工具栏组件（TokenBar + SessionDropdown + ThemeToggle）"
```

---

### Task 8: DAG 画布（React Flow）

**Files:**
- Create: `src/components/DAG/DAGCanvas.tsx`
- Create: `src/components/DAG/DAGNode.tsx`

- [ ] **Step 1: 创建 DAGNode 自定义组件**

```tsx
// src/components/DAG/DAGNode.tsx
import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { DAGNode as DAGNodeType } from '../../types/events';

interface Props {
  data: DAGNodeType;
}

const statusStyle: Record<string, React.CSSProperties> = {
  pending: { borderColor: 'var(--dag-node-border)', opacity: 0.6 },
  running: {
    borderColor: 'var(--warn)',
    background: 'var(--warn-bg)',
    animation: 'node-pulse 1.5s infinite',
  },
  completed: { borderColor: 'var(--success)', background: 'var(--success-bg)' },
  failed: { borderColor: 'var(--error)', background: 'var(--error-bg)' },
};

const statusLabel: Record<string, string> = {
  pending: '○ 等待',
  running: '⟳ 运行中',
  completed: '✓ 完成',
  failed: '✗ 失败',
};

const statusColor: Record<string, string> = {
  pending: 'var(--text-dim)',
  running: 'var(--warn)',
  completed: 'var(--success)',
  failed: 'var(--error)',
};

export const DAGNodeComponent = memo(({ data }: Props) => {
  const s = statusStyle[data.status] ?? statusStyle.pending;

  return (
    <div style={{
      background: 'var(--dag-node)',
      border: '1.5px solid',
      borderRadius: 10,
      padding: '10px 14px',
      minWidth: 120,
      textAlign: 'center',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      transition: 'all 0.3s',
      ...s,
    }}>
      {data.parentId && (
        <Handle type="target" position={Position.Top} style={{ background: 'var(--accent)' }} />
      )}
      <div style={{ fontSize: 16, marginBottom: 4 }}>
        {data.type === 'agent' ? '🤖' : '🔧'}
      </div>
      <div style={{ color: 'var(--text-primary)', fontWeight: 500, fontSize: 12 }}>
        {data.label}
      </div>
      <div style={{ fontSize: 10, marginTop: 4, color: statusColor[data.status] ?? 'var(--text-dim)' }}>
        {statusLabel[data.status] ?? '○ 等待'}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: 'var(--accent)' }} />
    </div>
  );
});

DAGNodeComponent.displayName = 'DAGNodeComponent';
```

- [ ] **Step 2: 创建 DAGCanvas**

```tsx
// src/components/DAG/DAGCanvas.tsx
import React, { useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { DAGNodeComponent } from './DAGNode';
import { useTaskStore } from '../../stores/useTaskStore';
import type { Node, Edge } from '@xyflow/react';
import type { DAGNode } from '../../types/events';

const nodeTypes = { dagNode: DAGNodeComponent };

interface Props {
  style?: React.CSSProperties;
}

function dagNodeToFlowNode(node: DAGNode): Node {
  return {
    id: node.id,
    type: 'dagNode',
    data: node,
    position: { x: 0, y: 0 }, // 自动布局后由 React Flow 计算
  };
}

export function DAGCanvas({ style }: Props) {
  const { nodes: storeNodes } = useTaskStore();

  // 从 store 转换
  const flowNodes: Node[] = Array.from(storeNodes.values()).map(dagNodeToFlowNode);

  // 简单层级布局
  const positionedNodes = React.useMemo(() => {
    const nodeMap = new Map<string, Node>();
    const roots: Node[] = [];
    const children: Node[][] = [[], [], []];

    for (const n of flowNodes) {
      const parent = storeNodes.get((n.data as DAGNode).parentId ?? '');
      const level = parent ? (storeNodes.get(parent.id) ? 1 : 2) : 0;
      if (level === 0 && !(n.data as DAGNode).parentId) {
        roots.push(n);
      } else {
        children[level]?.push(n);
      }
      nodeMap.set(n.id, n);
    }

    const result: Node[] = [];
    const centerX = 300;
    const yStep = 150;

    roots.forEach((n, i) => {
      result.push({ ...n, position: { x: centerX, y: 20 } });
    });

    children[1].forEach((n, i) => {
      const offset = (i - (children[1].length - 1) / 2) * 180;
      result.push({ ...n, position: { x: centerX + offset, y: 20 + yStep } });
    });

    children[2].forEach((n, i) => {
      const parentIdx = Math.floor(i / 3);
      const offset = (i % 3 - 1) * 140;
      result.push({ ...n, position: { x: centerX + offset, y: 20 + yStep * 2 } });
    });

    return result.length > 0 ? result : flowNodes;
  }, [flowNodes, storeNodes]);

  // 生成边
  const edges: Edge[] = Array.from(storeNodes.values())
    .filter(n => n.parentId && storeNodes.has(n.parentId))
    .map(n => ({
      id: `${n.parentId}-${n.id}`,
      source: n.parentId!,
      target: n.id,
      style: {
        stroke: n.status === 'completed' ? 'var(--success)'
          : n.status === 'running' ? 'var(--warn)'
          : 'var(--accent)',
        strokeWidth: 1.5,
        strokeDasharray: n.status === 'pending' ? '4,3' : undefined,
      },
    }));

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      background: 'var(--dag-bg)',
      backgroundImage: 'radial-gradient(circle, var(--dag-dot) 1px, transparent 1px)',
      backgroundSize: '24px 24px',
      ...style,
    }}>
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-bar)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          DAG 执行图
        </span>
      </div>
      <div style={{ flex: 1 }}>
        <ReactFlow
          nodes={positionedNodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          panOnDrag
          zoomOnScroll
          nodesDraggable
          style={{ background: 'transparent' }}
        >
          <Background color="var(--dag-dot)" gap={24} variant={BackgroundVariant.Dots} />
          <Controls style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }} />
        </ReactFlow>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/DAG/
git commit -m "feat: DAG 画布（React Flow + 自定义节点）"
```

---

### Task 9: 工具视图（Terminal + Cards）

**Files:**
- Create: `src/components/ToolView/ToolViewPanel.tsx`
- Create: `src/components/ToolView/TerminalView.tsx`
- Create: `src/components/ToolView/ToolCards.tsx`

- [ ] **Step 1: 创建 TerminalView（xterm.js）**

```tsx
// src/components/ToolView/TerminalView.tsx
import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { useTaskStore } from '../../stores/useTaskStore';

export function TerminalView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const { terminalLines } = useTaskStore();

  useEffect(() => {
    if (!containerRef.current || terminalRef.current) return;

    const term = new Terminal({
      theme: {
        background: '#050508',
        foreground: '#c0c0c0',
        cursor: '#4a8eff',
        black: '#000000',
        red: '#e74c3c',
        green: '#2ecc71',
        yellow: '#f1c40f',
        blue: '#4a8eff',
        magenta: '#c56cff',
        cyan: '#6cf',
        white: '#e0e0e0',
      },
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontSize: 12,
      lineHeight: 1.6,
      scrollback: 500,
      cursorBlink: true,
    });

    term.open(containerRef.current);
    terminalRef.current = term;

    // 初始化引导信息
    term.writeln('\x1b[2m$ claude "分析代码库"\x1b[0m');
    term.writeln('\x1b[90m正在启动 Claude Agent...\x1b[0m');

    return () => {
      term.dispose();
      terminalRef.current = null;
    };
  }, []);

  // 追加新行
  useEffect(() => {
    const term = terminalRef.current;
    if (!term || terminalLines.length === 0) return;

    const lastLine = terminalLines[terminalLines.length - 1];
    if (lastLine) {
      try {
        const parsed = JSON.parse(lastLine);
        // 格式化显示结构化事件
        term.writeln(`\x1b[36m››› ${parsed.event?.type ?? 'unknown'}\x1b[0m`);
      } catch {
        term.writeln(lastLine);
      }
    }
  }, [terminalLines]);

  return (
    <div
      ref={containerRef}
      style={{
        background: 'var(--term-bg)',
        border: '1px solid var(--term-border)',
        borderRadius: 8,
        padding: 12,
        minHeight: 300,
        transition: 'background 0.3s, border-color 0.3s',
      }}
    />
  );
}
```

- [ ] **Step 2: 创建 ToolCards**

```tsx
// src/components/ToolView/ToolCards.tsx
import React, { useState } from 'react';
import { useTaskStore } from '../../stores/useTaskStore';

const TOOL_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  bash:   { bg: 'var(--success-bg)',  color: 'var(--success)', border: 'var(--success-border)' },
  read:   { bg: '#e8f4fd',           color: '#3498db',       border: '#c0dff5' },
  write:  { bg: 'var(--warn-bg)',    color: 'var(--warn)',    border: 'var(--warn-border)' },
  edit:   { bg: '#f3e8ff',            color: '#9055db',       border: '#e0c8f8' },
  grep:   { bg: '#e8f7e0',           color: '#5a9e20',       border: '#c8e8a0' },
  agent:  { bg: 'var(--warn-bg)',    color: '#ff8c40',       border: 'var(--warn-border)' },
};

function getToolStyle(tool: string) {
  return TOOL_COLORS[tool.toLowerCase()] ?? {
    bg: 'var(--pending-bg)',
    color: 'var(--pending)',
    border: 'var(--pending-border)',
  };
}

export function ToolCards() {
  const { toolCalls } = useTaskStore();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const reversed = [...toolCalls].reverse();

  if (reversed.length === 0) {
    return (
      <div style={{ color: 'var(--text-dim)', fontSize: 12, textAlign: 'center', marginTop: 40 }}>
        暂无工具调用记录
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {reversed.map(tool => {
        const isExpanded = expanded.has(tool.id);
        const style = getToolStyle(tool.tool);
        const duration = tool.endTime
          ? `${((tool.endTime - tool.startTime) / 1000).toFixed(1)}s`
          : '';

        return (
          <div
            key={tool.id}
            onClick={() => toggle(tool.id)}
            style={{
              background: 'var(--bg-card)',
              border: `1px solid ${isExpanded ? 'var(--border-hover)' : 'var(--border-card)'}`,
              borderRadius: 8, padding: '10px 12px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{
                padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                fontFamily: 'monospace',
                background: style.bg, color: style.color, border: `1px solid ${style.border}`,
              }}>
                {tool.tool.toUpperCase()}
              </span>
              <span style={{ color: 'var(--text-primary)', fontSize: 12 }}>
                {tool.args?.raw ?? tool.tool}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 'auto', fontFamily: 'monospace' }}>
                {tool.status === 'running' ? `⟳ ${duration || '0.0s'}` : duration}
              </span>
            </div>
            {isExpanded && tool.result && (
              <div style={{
                marginTop: 8, background: 'var(--bg-root)',
                padding: '4px 8px', borderRadius: 4,
                fontSize: 10, fontFamily: 'monospace',
                color: tool.status === 'error' ? 'var(--error)' : 'var(--success)',
                wordBreak: 'break-all',
              }}>
                {tool.result}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: 创建 ToolViewPanel**

```tsx
// src/components/ToolView/ToolViewPanel.tsx
import React from 'react';
import { TerminalView } from './TerminalView';
import { ToolCards } from './ToolCards';

interface Props {
  viewMode: 'terminal' | 'cards';
  onViewModeChange: (m: 'terminal' | 'cards') => void;
  style?: React.CSSProperties;
}

export function ToolViewPanel({ viewMode, onViewModeChange, style }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-root)', ...style }}>
      <div style={{
        display: 'flex', borderBottom: '1px solid var(--border)',
        padding: '0 12px', background: 'var(--bg-bar)',
      }}>
        {(['terminal', 'cards'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => onViewModeChange(tab)}
            style={{
              padding: '10px 14px', fontSize: 12, cursor: 'pointer',
              color: viewMode === tab ? 'var(--accent)' : 'var(--text-dim)',
              borderBottom: `2px solid ${viewMode === tab ? 'var(--accent)' : 'transparent'}`,
              background: 'transparent', border: 'none', borderTop: 0, borderRight: 0, borderLeft: 0,
              borderRadius: 0, marginBottom: -1,
              transition: 'all 0.2s', fontFamily: 'inherit',
            }}
          >
            {tab === 'terminal' ? '终端' : '卡片'}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {viewMode === 'terminal' ? <TerminalView /> : <ToolCards />}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/ToolView/
git commit -m "feat: 工具视图（Terminal + Cards 可切换）"
```

---

### Task 10: 底部工具栏

**Files:**
- Create: `src/components/BottomBar/RecentTools.tsx`

- [ ] **Step 1: 创建 RecentTools**

```tsx
// src/components/BottomBar/RecentTools.tsx
import React from 'react';
import { useTaskStore } from '../../stores/useTaskStore';

export function BottomBar() {
  const { toolCalls } = useTaskStore();
  const recent = [...toolCalls].reverse().slice(0, 8);

  const pillStyle = (status: string) => {
    const base = {
      padding: '3px 10px', borderRadius: 20, fontSize: 11,
      fontFamily: 'monospace', fontWeight: 500, border: '1px solid',
    };
    switch (status) {
      case 'completed': return { ...base, background: 'var(--success-bg)', color: 'var(--success)', borderColor: 'var(--success-border)' };
      case 'running':   return { ...base, background: 'var(--warn-bg)',    color: 'var(--warn)',    borderColor: 'var(--warn-border)' };
      case 'error':     return { ...base, background: 'var(--error-bg)',   color: 'var(--error)',   borderColor: 'var(--error-border)' };
      default:          return { ...base, background: 'var(--pending-bg)', color: 'var(--pending)', borderColor: 'var(--pending-border)' };
    }
  };

  const icon = (status: string) => {
    switch (status) {
      case 'completed': return '✓';
      case 'running':   return '⟳';
      case 'error':     return '✗';
      default:          return '○';
    }
  };

  return (
    <div style={{
      background: 'var(--bg-bar)',
      borderTop: '1px solid var(--border)',
      padding: '8px 16px',
      display: 'flex', alignItems: 'center', gap: 8,
      transition: 'background 0.3s, border-color 0.3s',
    }}>
      <span style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5, marginRight: 4 }}>
        最近工具
      </span>
      {recent.length === 0 && (
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>暂无工具调用</span>
      )}
      {recent.map(tool => (
        <span key={tool.id} style={pillStyle(tool.status)}>
          {icon(tool.status)} {tool.tool}
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/BottomBar/RecentTools.tsx
git commit -m "feat: 底部最近工具状态栏"
```

---

## Phase 4 — 联调与增强

### Task 11: 全流程联调

- [ ] **Step 1: 更新 App.tsx 集成 WebSocket**

```tsx
// src/App.tsx（更新版本）
import { useState } from 'react';
import { Toolbar } from './components/Toolbar/Toolbar';
import { DAGCanvas } from './components/DAG/DAGCanvas';
import { ToolViewPanel } from './components/ToolView/ToolViewPanel';
import { BottomBar } from './components/BottomBar/RecentTools';
import { useSessionStore } from './stores/useSessionStore';
import { useWebSocket } from './hooks/useWebSocket';

export function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [viewMode, setViewMode] = useState<'terminal' | 'cards'>('terminal');
  const { activeSessionId, addSession } = useSessionStore();

  // 自动创建默认会话
  React.useEffect(() => {
    if (!activeSessionId) {
      const id = `session_${Date.now()}`;
      addSession({
        id,
        name: '会话 1',
        projectPath: '/Users/ouguangji/2026/cc-web-ui',
        createdAt: Date.now(),
        isActive: true,
      });
    }
  }, [activeSessionId, addSession]);

  useWebSocket(activeSessionId);

  const applyTheme = (t: 'dark' | 'light') => {
    setTheme(t);
    document.documentElement.classList.remove('theme-dark', 'theme-light');
    document.documentElement.classList.add(`theme-${t}`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Toolbar theme={theme} onThemeChange={applyTheme} />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <DAGCanvas style={{ flex: 1 }} />
        <ToolViewPanel
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          style={{ width: 420 }}
        />
      </div>
      <BottomBar />
    </div>
  );
}
```

- [ ] **Step 2: 添加 CSS 动画到 theme.css**

```css
/* src/styles/theme.css 追加 */
@keyframes pulse-green { 0%,100%{opacity:1} 50%{opacity:0.4} }
```

- [ ] **Step 3: 验证项目能启动**

Run: `npm run dev`（后台运行）
Expected: Vite 启动在 5173 端口，WebSocket server 启动在 3001 端口

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/styles/theme.css
git commit -m "feat: 全流程联调，App 集成 WebSocket"
```

---

## 规划完成检查清单

**Spec 覆盖率：**
- ✅ 工具执行实时展示（TerminalView + ToolCards + ToolViewPanel）
- ✅ 多任务并行进度追踪（DAGCanvas + DAGNode + NodeStatus）
- ✅ 多 Agent DAG 动态渲染（React Flow）
- ✅ 会话管理（SessionDropdown + useSessionStore）
- ✅ Token 消耗实时统计（TokenBar + useTaskStore）
- ✅ 明亮/暗黑主题切换（ThemeToggle + theme.css）

**Placeholder 扫描：** 无 TBD/TODO

**类型一致性：**
- `ClaudeEvent` 类型在 Task 2 定义，所有后续任务引用一致
- `DAGNode.status` 使用 `'pending' | 'running' | 'completed' | 'failed'` 四种状态
- `WSMessage` 结构在 server → client 方向统一使用 `{ event, sessionId, timestamp }`
