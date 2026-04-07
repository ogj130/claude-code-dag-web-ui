# Claude Code DAG Web UI

A modern web interface for visualizing Claude Code agent execution, featuring real-time DAG workflow graphs and terminal-style tool call logs.

## Features

- **DAG Execution Graph** — Visualize agent task flow with interactive nodes (query, tools, summary)
- **Terminal Tool View** — Real-time streaming of tool calls with collapsible Q&A cards
- **Live Card System** — Auto-updating cards showing query → tools → summary in real-time
- **Dark/Light Mode** — Seamless theme switching with CSS variable-based design
- **Session Management** — Multiple Claude Code sessions with history navigation
- **WebSocket Communication** — Real-time bidirectional communication with Claude Code backend

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **State Management**: Zustand
- **DAG Visualization**: @xyflow/react (ReactFlow)
- **Terminal**: @xterm/xterm
- **Markdown Rendering**: react-markdown + remark-gfm
- **Backend**: Node.js WebSocket server (tsx)

## Getting Started

### Prerequisites

- Node.js 18+
- Claude Code (running in server mode)

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

This starts both the frontend (Vite) and backend (WebSocket server) concurrently.

- Frontend: http://localhost:5400
- WebSocket Server: ws://localhost:5300

### Production Build

```bash
npm run build
npm run preview
```

## Project Structure

```
src/
├── components/
│   ├── DAG/          # DAG execution graph components
│   │   ├── DAGCanvas.tsx
│   │   ├── DAGNode.tsx
│   │   └── NodeDetailModal.tsx
│   ├── ToolView/     # Terminal and card view components
│   │   ├── TerminalView.tsx
│   │   ├── MarkdownCard.tsx
│   │   ├── LiveCard.tsx
│   │   ├── CardToolTimeline.tsx
│   │   └── ToolStreamView.tsx
│   └── Toolbar/      # Top toolbar components
├── stores/           # Zustand state stores
│   ├── useTaskStore.ts    # DAG & terminal state
│   └── useSessionStore.ts  # Session management
├── hooks/            # Custom React hooks
│   ├── useWebSocket.ts
│   └── usePathHistory.ts
├── types/            # TypeScript type definitions
│   └── events.ts
└── styles/           # CSS theme variables
    └── theme.css

server/
├── index.ts          # WebSocket server entry
├── ClaudeCodeProcess.ts  # Claude Code process management
└── AnsiParser.ts    # ANSI escape code parser
```

## Architecture

### Event-Driven State Management

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

### DAG Node Types

- **Agent** — Root Claude Agent node
- **Query** — User question node (collapsible)
- **Tool** — Tool execution node
- **Summary** — Query completion summary

### Card System

- **LiveCard** — Real-time in-progress card (query → tools → summary)
- **MarkdownCard** — Completed Q&A card with collapsible analysis section

## License

MIT
