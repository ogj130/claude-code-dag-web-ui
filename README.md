# Claude Code DAG Web UI

<p align="center">
  <img src="docs/screenshots/readme-full-view.png" alt="Claude Code DAG Web UI" width="100%" />
</p>

<p align="center">
  <a href="https://github.com/ogj130/claude-code-dag-web-ui">
    <img src="https://img.shields.io/badge/GitHub-Repo-blue?style=flat-square&logo=github" alt="GitHub" />
  </a>
  <img src="https://img.shields.io/badge/React-18-blue?style=flat-square&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Zustand-State-orange?style=flat-square" alt="Zustand" />
  <img src="https://img.shields.io/badge/ReactFlow-DAG-green?style=flat-square" alt="ReactFlow" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
</p>

[English](#english) · [中文](#中文)

---

## English

> ✨ A modern web interface for visualizing Claude Code agent execution in real-time

### Features

| | |
|---|---|
| 🔥 **DAG Execution Graph** | Interactive task flow visualization with collapsible query nodes |
| 💻 **Terminal Tool View** | Real-time tool call streaming powered by xterm.js |
| 📝 **Live Card System** | Auto-updating cards: `query → tools → summary` |
| 📄 **Markdown Rendering** | Beautiful markdown with GFM support, tables, code blocks |
| 🌙 **Dark / Light Mode** | Seamless theme switching with CSS variables |
| 📁 **Session Management** | Multiple Claude Code sessions with history navigation |
| ⚡ **WebSocket** | Real-time bidirectional communication |

### Preview

<details open>
<summary><b>🗺️ DAG Execution Graph (Dark Mode)</b></summary>
<img src="docs/screenshots/readme-dag-view.png" alt="DAG View" width="100%" />
</details>

<details>
<summary><b>📋 Terminal Card View (Dark Mode)</b></summary>
<img src="docs/screenshots/readme-card-view.png" alt="Card View" width="100%" />
</details>

<details>
<summary><b>☀️ Light Mode Preview</b></summary>
<img src="docs/screenshots/readme-light-mode.png" alt="Light Mode" width="100%" />
</details>

### Quick Start

```bash
# Install
npm install

# Start (frontend + backend)
npm run dev
```

> 🌐 Frontend → http://localhost:5400
> ⚡ WebSocket → ws://localhost:5300

### Architecture

#### Event-Driven State

The UI is entirely driven by events from the Claude Code backend:

| Event | Description |
|---|---|
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
|---|---|
| 🟦 **Agent** | Root Claude Agent node |
| 🟩 **Query** | User question node (collapsible) |
| 🟨 **Tool** | Tool execution node |
| 🟪 **Summary** | Query completion summary |

#### Card System

| Card | Description |
|---|---|
| ⚡ **LiveCard** | Real-time in-progress card (streaming updates) |
| ✅ **MarkdownCard** | Completed Q&A card with collapsible analysis |

### Tech Stack

```
Frontend          Backend
─────────────     ─────────────
 React 18    →    Node.js WS
 TypeScript  →    tsx runner
 Zustand     →    ws server
 ReactFlow   →    Claude Code
 xterm.js    →    process
 react-md    →    ANSI parser
```

#### System Architecture

```mermaid
graph TB
    subgraph Backend["⚙️ Backend (Node.js)"]
        CC["🤖 Claude Code\nprocess"]
        WS["⚡ WebSocket Server\n:5300"]
        AP["📝 ANSI Parser"]
        CC -->|stdout/ events| AP
        AP -->|parsed events| WS
    end

    subgraph Frontend["🌐 Frontend (React)"]
        WH["🔌 WebSocket Handler"]
        Store["🗃️ Zustand Store"]
        DAG["🔥 DAGCanvas\n(ReactFlow)"]
        Terminal["💻 TerminalView\n(xterm.js)"]
        Cards["📋 Card System\nLiveCard + MarkdownCard"]
        WH -->|handleEvent| Store
        Store -->|nodes/ edges| DAG
        Store -->|toolCalls/ lines| Terminal
        Store -->|currentCard/ markdownCards| Cards
    end

    WS -.->|"WebSocket"| WH
    DAG -.->|onNodeClick| Cards
    Cards -.->|selectNode| DAG
```

#### Event-Driven Data Flow

```mermaid
sequenceDiagram
    participant User as 👤 User
    participant UI as 💻 Frontend
    participant WS as ⚡ WebSocket
    participant Backend as ⚙️ Claude Code
    participant Store as 🗃️ Zustand Store

    User->>UI: 发送问题
    UI->>WS: user_input_sent
    WS->>Backend: forward to Claude Code
    Backend-->>WS: session_start
    Backend-->>WS: query_start
    Backend-->>WS: tool_call
    Backend-->>WS: tool_result / tool_progress
    Backend-->>WS: query_end
    Backend-->>WS: query_summary
    WS->>Store: handleEvent(event)
    Store->>Store: update state
    Store->>UI: re-render DAG / Terminal / Cards

    rect rgba(0, 180, 120, 0.1)
        Note over User,Store: 🔄 Auto-Collapse: 新问题开始时<br/>DAG 和 Terminal 自动折叠上一个问题
    end
```

#### State Transition

```mermaid
stateDiagram-v2
    [*] --> Idle: session_start
    Idle --> Running: user_input_sent
    Running --> Running: query_start (next query)
    Running --> QueryEnd: query_end
    QueryEnd --> Completed: query_summary
    Completed --> Running: user_input_sent (next query)
    Completed --> [*]: session_end
```

---

## 中文

> ✨ 现代化 Claude Code 执行可视化 Web 界面

### 功能特性

| | |
|---|---|
| 🔥 **DAG 执行图** | 可交互的任务流程可视化，支持折叠/展开查询节点 |
| 💻 **终端工具视图** | 基于 xterm.js 的实时工具调用流式展示 |
| 📝 **实时卡片系统** | 自动更新的问答卡片：`问题 → 工具 → 总结` |
| 📄 **Markdown 渲染** | 支持 GFM 的精美渲染，含表格、代码块等 |
| 🌙 **暗黑/明亮模式** | 基于 CSS 变量的无缝主题切换 |
| 📁 **会话管理** | 多会话历史记录与导航 |
| ⚡ **WebSocket** | 与 Claude Code 后端的实时双向通信 |

### 效果预览

<details open>
<summary><b>🗺️ DAG 执行图（暗黑模式）</b></summary>
<img src="docs/screenshots/readme-dag-view.png" alt="DAG 视图" width="100%" />
<img src="docs/screenshots/image.png" alt="DAG 视图" width="100%" />
</details>

<details>
<summary><b>📋 终端卡片视图（暗黑模式）</b></summary>
<img src="docs/screenshots/readme-card-view.png" alt="卡片视图" width="100%" />
</details>

<details>
<summary><b>☀️ 明亮模式预览</b></summary>
<img src="docs/screenshots/readme-light-mode.png" alt="明亮模式" width="100%" />
<img src="docs/screenshots/image-2.png" alt="明亮模式" width="100%" />
</details>

### 快速开始

```bash
# 安装依赖
npm install

# 启动开发（前端 + 后端）
npm run dev
```

> 🌐 前端 → http://localhost:5400
> ⚡ WebSocket → ws://localhost:5300

### 架构设计

#### 事件驱动状态

UI 完全由 Claude Code 后端的事件驱动：

| 事件 | 说明 |
|---|---|
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
|---|---|
| 🟦 **Agent** | 根节点 — Claude Agent |
| 🟩 **Query** | 查询节点 — 用户问题（可折叠）|
| 🟨 **Tool** | 工具节点 — 工具执行 |
| 🟪 **Summary** | 总结节点 — 问题完成总结 |

#### 卡片系统

| 卡片 | 说明 |
|---|---|
| ⚡ **LiveCard** | 实时卡片 — 正在进行的问答（流式更新）|
| ✅ **MarkdownCard** | 完成卡片 — 已完成的问答，支持折叠分析内容 |

### 技术栈

```
前端              后端
─────────────     ─────────────
 React 18    →    Node.js WS
 TypeScript  →    tsx runner
 Zustand     →    ws server
 ReactFlow   →    Claude Code
 xterm.js    →    ANSI parser
 react-md    →    process
```

#### 系统架构图

```mermaid
graph TB
    subgraph Backend["⚙️ 后端 (Node.js)"]
        CC["🤖 Claude Code\nprocess"]
        WS["⚡ WebSocket Server\n:5300"]
        AP["📝 ANSI Parser"]
        CC -->|stdout/ events| AP
        AP -->|parsed events| WS
    end

    subgraph Frontend["🌐 前端 (React)"]
        WH["🔌 WebSocket Handler"]
        Store["🗃️ Zustand Store"]
        DAG["🔥 DAGCanvas\n(ReactFlow)"]
        Terminal["💻 TerminalView\n(xterm.js)"]
        Cards["📋 卡片系统\nLiveCard + MarkdownCard"]
        WH -->|handleEvent| Store
        Store -->|nodes/ edges| DAG
        Store -->|toolCalls/ lines| Terminal
        Store -->|currentCard/ markdownCards| Cards
    end

    WS -.->|"WebSocket"| WH
    DAG -.->|onNodeClick| Cards
    Cards -.->|selectNode| DAG
```

#### 事件驱动数据流

```mermaid
sequenceDiagram
    participant User as 👤 用户
    participant UI as 💻 前端
    participant WS as ⚡ WebSocket
    participant Backend as ⚙️ Claude Code
    participant Store as 🗃️ Zustand Store

    User->>UI: 发送问题
    UI->>WS: user_input_sent
    WS->>Backend: forward to Claude Code
    Backend-->>WS: session_start
    Backend-->>WS: query_start
    Backend-->>WS: tool_call
    Backend-->>WS: tool_result / tool_progress
    Backend-->>WS: query_end
    Backend-->>WS: query_summary
    WS->>Store: handleEvent(event)
    Store->>Store: update state
    Store->>UI: re-render DAG / Terminal / Cards

    rect rgba(0, 180, 120, 0.1)
        Note over User,Store: 🔄 自动折叠：新问题开始时<br/>DAG 和 Terminal 自动折叠上一个问题
    end
```

#### 状态转换图

```mermaid
stateDiagram-v2
    [*] --> Idle: session_start
    Idle --> Running: user_input_sent
    Running --> Running: query_start (下一个问题)
    Running --> QueryEnd: query_end
    QueryEnd --> Completed: query_summary
    Completed --> Running: user_input_sent (下一个问题)
    Completed --> [*]: session_end
```

---

## License

MIT · Made with 💙 by [ogj130](https://github.com/ogj130)
