# Claude Code DAG Web UI

[English](#english) | [中文](#中文)

---

## English

A modern web interface for visualizing Claude Code agent execution, featuring real-time DAG workflow graphs and terminal-style tool call logs.

### Features

- **DAG Execution Graph** — Interactive visualization of agent task flow with collapsible query nodes
- **Terminal Tool View** — Real-time streaming of tool calls with xterm.js
- **Live Card System** — Auto-updating cards showing `query → tools → summary` in real-time
- **Markdown Rendering** — Beautiful markdown rendering with GFM support
- **Dark/Light Mode** — Seamless theme switching with CSS variable-based design
- **Session Management** — Multiple Claude Code sessions with history navigation
- **WebSocket Communication** — Real-time bidirectional communication with Claude Code backend

### Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **State Management**: Zustand
- **DAG Visualization**: @xyflow/react (ReactFlow)
- **Terminal**: @xterm/xterm
- **Markdown**: react-markdown + remark-gfm
- **Backend**: Node.js WebSocket server (tsx)

### Getting Started

```bash
# Install dependencies
npm install

# Start development (frontend + backend)
npm run dev
```

- Frontend: http://localhost:5400
- WebSocket Server: ws://localhost:5300

### Architecture

#### Event-Driven State

The UI is driven by events from the Claude Code backend:

| Event | Description |
|-------|-------------|
| `session_start` | Agent session initialized |
| `query_start` | New user query begins |
| `query_end` | Query execution completes |
| `query_summary` | Final summary generated |
| `tool_call` | Tool invocation starts |
| `tool_result` | Tool execution result |
| `tool_progress` | Real-time progress updates |
| `token_usage` | Token consumption stats |

#### DAG Node Types

| Type | Description |
|------|-------------|
| **Agent** | Root Claude Agent node |
| **Query** | User question node (collapsible) |
| **Tool** | Tool execution node |
| **Summary** | Query completion summary |

#### Card System

| Card | Description |
|------|-------------|
| **LiveCard** | Real-time in-progress card (streaming updates) |
| **MarkdownCard** | Completed Q&A card with collapsible analysis |

### Project Structure

```
src/
├── components/
│   ├── DAG/           # DAG visualization (ReactFlow)
│   │   ├── DAGCanvas.tsx
│   │   ├── DAGNode.tsx
│   │   └── NodeDetailModal.tsx
│   ├── ToolView/      # Terminal and card views
│   │   ├── TerminalView.tsx
│   │   ├── MarkdownCard.tsx
│   │   ├── LiveCard.tsx
│   │   └── CardToolTimeline.tsx
│   └── Toolbar/       # Top toolbar
├── stores/             # Zustand state management
│   ├── useTaskStore.ts
│   └── useSessionStore.ts
├── hooks/              # Custom React hooks
│   ├── useWebSocket.ts
│   └── usePathHistory.ts
├── types/              # TypeScript definitions
│   └── events.ts
└── styles/             # CSS theme variables
    └── theme.css

server/
├── index.ts            # WebSocket server
├── ClaudeCodeProcess.ts # Process management
└── AnsiParser.ts      # ANSI escape parser
```

---

## 中文

一个现代化的 Claude Code 执行可视化 Web 界面，集成实时 DAG 工作流图和终端风格工具调用日志。

### 功能特性

- **DAG 执行图** — 可交互的任务流程可视化，支持折叠/展开查询节点
- **终端工具视图** — 基于 xterm.js 的实时工具调用流式展示
- **实时卡片系统** — 自动更新的问答卡片，展示 `问题 → 工具 → 总结` 全流程
- **Markdown 渲染** — 支持 GFM 的精美 Markdown 渲染
- **暗黑/明亮模式** — 基于 CSS 变量的无缝主题切换
- **会话管理** — 多会话历史记录与导航
- **WebSocket 通信** — 与 Claude Code 后端的实时双向通信

### 技术栈

- **前端**: React 18 + TypeScript + Vite
- **状态管理**: Zustand
- **DAG 可视化**: @xyflow/react (ReactFlow)
- **终端**: @xterm/xterm
- **Markdown**: react-markdown + remark-gfm
- **后端**: Node.js WebSocket 服务端 (tsx)

### 快速开始

```bash
# 安装依赖
npm install

# 启动开发（前端 + 后端）
npm run dev
```

- 前端: http://localhost:5400
- WebSocket 服务: ws://localhost:5300

### 架构设计

#### 事件驱动状态

UI 由 Claude Code 后端的事件驱动：

| 事件 | 说明 |
|------|------|
| `session_start` | Agent 会话初始化 |
| `query_start` | 新用户问题开始 |
| `query_end` | 问题执行完成 |
| `query_summary` | 最终总结生成 |
| `tool_call` | 工具调用开始 |
| `tool_result` | 工具执行结果 |
| `tool_progress` | 实时进度更新 |
| `token_usage` | Token 消耗统计 |

#### DAG 节点类型

| 类型 | 说明 |
|------|------|
| **Agent** | 根节点 — Claude Agent |
| **Query** | 查询节点 — 用户问题（可折叠）|
| **Tool** | 工具节点 — 工具执行 |
| **Summary** | 总结节点 — 问题完成总结 |

#### 卡片系统

| 卡片 | 说明 |
|------|------|
| **LiveCard** | 实时卡片 — 正在进行的问答（流式更新）|
| **MarkdownCard** | 完成卡片 — 已完成的问答，支持折叠分析内容 |

### 项目结构

```
src/
├── components/
│   ├── DAG/           # DAG 可视化（ReactFlow）
│   │   ├── DAGCanvas.tsx
│   │   ├── DAGNode.tsx
│   │   └── NodeDetailModal.tsx
│   ├── ToolView/      # 终端和卡片视图
│   │   ├── TerminalView.tsx
│   │   ├── MarkdownCard.tsx
│   │   ├── LiveCard.tsx
│   │   └── CardToolTimeline.tsx
│   └── Toolbar/       # 顶部工具栏
├── stores/             # Zustand 状态管理
│   ├── useTaskStore.ts
│   └── useSessionStore.ts
├── hooks/              # 自定义 React Hooks
│   ├── useWebSocket.ts
│   └── usePathHistory.ts
├── types/              # TypeScript 类型定义
│   └── events.ts
└── styles/             # CSS 主题变量
    └── theme.css

server/
├── index.ts            # WebSocket 服务端
├── ClaudeCodeProcess.ts # 进程管理
└── AnsiParser.ts      # ANSI 转义码解析
```

---

## License

MIT
