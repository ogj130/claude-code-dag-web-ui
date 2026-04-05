# CC Web — 设计规格文档

> **版本：** v1.0
> **日期：** 2026-04-05
> **状态：** 已确认

---

## 一、项目概述

### 1.1 目标
将 Claude Code CLI 以可视化 Web 界面呈现，实现：
- 工具执行实时展示（终端模式 + 卡片模式）
- 多任务并行进度追踪
- 多 Agent DAG 动态渲染
- 会话管理
- Token 消耗实时统计

### 1.2 架构模式
**本地 Agent 直连模式** — Node.js 后端直接 spawn Claude Code CLI 进程，通过 WebSocket 拉取实时输出流，数据不过公网，适合本机开发场景。

```
Browser (React + WebSocket)
        ↕
Node.js Backend (WebSocket Server + ANSI Parser + Process Manager)
        ↕
Claude Code CLI (spawn)
```

---

## 二、技术选型

| 模块 | 选型 | 决策理由 |
|------|------|---------|
| 前端框架 | React + TypeScript | 组件化，生态丰富 |
| 实时通信 | WebSocket | 全双工，支持任务取消等反向推送 |
| DAG 渲染 | React Flow | React 原生，内置拖拽/缩放/动画 |
| 工具展示 | 混合模式 | 左侧 DAG + 右侧终端/卡片可切换 |
| CLI 解析 | ANSI 输出解析 | 零侵入 Claude Code，兼容所有版本 |
| 状态管理 | Zustand | 轻量，足够应对任务 + DAG 状态 |
| Token 展示 | 紧凑统计条 | 顶部工具栏显示 Input / Output / Total |
| 会话切换 | 下拉菜单 | 会话不常切换，下拉足够且节省空间 |

---

## 三、界面结构

### 3.1 整体布局

```
┌──────────────────────────────────────────────────────────┐
│ [新会话] │ 会话列表▾ │ Input: X | Output: X │ ● Connected │
├──────────────────────────────────────────────────────────┤
│                                                          │
│     DAG 执行图 (React Flow)  │   终端 / 卡片视图           │
│     (左侧主区域)            │   (右侧可切换)              │
│                            │   [终端] [卡片]             │
│                            │                            │
├──────────────────────────────────────────────────────────┤
│              最近工具调用: [Bash✓] [Read⟳] [Grep○]...   │
└──────────────────────────────────────────────────────────┘
```

### 3.2 顶部工具栏
- **新会话按钮**：创建新 Claude Code 会话
- **会话下拉菜单**：列出所有会话，点击切换
- **Token 统计条**：紧凑一行，显示 `Input: X | Output: X | Total: X`，右侧小圆点表示连接状态

### 3.3 DAG 画布（左侧）
- React Flow 渲染 DAG 执行图
- 节点：Agent / 子任务
- 边：依赖关系，方向从上到下
- 节点状态样式：
  - `pending`：灰虚线边框
  - `running`：黄边框 + 脉冲动画
  - `completed`：绿实线边框
  - `failed`：红实线边框

### 3.4 工具视图（右侧）
- **视图切换 Tab**：终端 / 卡片
- **终端视图**：xterm.js 模拟 CLI 输出，原生流式体验
- **卡片视图**：每个工具调用一张卡片（工具名、参数、执行状态、结果摘要）

### 3.5 底部工具面板
- 最近工具调用状态概览
- 绿色 ✓ = 完成，黄色 ⟳ = 执行中，灰色 ○ = 等待

---

## 四、核心数据流

### 4.1 Claude Code 输出解析流程

```
Claude Code CLI stdout (ANSI 彩色流)
        ↓
  ANSI Parser (parse-colorful-output)
        ↓
  标准化事件 { type, tool, status, payload, timestamp }
        ↓
  WebSocket Server 广播
        ↓
  前端 Zustand Store 更新
        ↓
  React Flow DAG 节点更新 / 工具卡片渲染
```

### 4.2 ANSI 解析事件类型

```typescript
type ClaudeEvent =
  | { type: 'agent_start'; agentId: string; prompt: string }
  | { type: 'agent_end'; agentId: string; result: string }
  | { type: 'tool_call'; toolId: string; tool: string; args: object }
  | { type: 'tool_result'; toolId: string; result: object; status: 'success' | 'error' }
  | { type: 'token_usage'; inputTokens: number; outputTokens: number }
  | { type: 'error'; message: string };
```

### 4.3 ANSI 解析策略
- 通过 ANSI 转义序列（`\x1b[...]`）识别彩色高亮
- 通过关键词前缀识别工具类型（如 `››› Bash`、`››› Read`）
- 通过状态标记识别执行结果（绿色 = 成功，红色 = 失败）
- 维护解析状态机，支持跨行参数

---

## 五、文件结构

```
cc-web-ui/
├── docs/
│   └── superpowers/
│       └── specs/
│           └── 2026-04-05-cc-web-design.md
├── server/
│   ├── index.ts               # WebSocket server 入口
│   ├── ClaudeCodeProcess.ts    # 进程管理 (spawn/kill/restart)
│   ├── AnsiParser.ts          # ANSI 彩色输出解析器
│   └── eventEmitter.ts        # 事件标准化与分发
├── src/
│   ├── App.tsx                # 主应用入口
│   ├── components/
│   │   ├── Toolbar/
│   │   │   ├── TokenBar.tsx      # Token 统计条
│   │   │   └── SessionDropdown.tsx # 会话下拉菜单
│   │   ├── DAG/
│   │   │   ├── DAGCanvas.tsx    # React Flow 主画布
│   │   │   └── DAGNode.tsx      # 自定义 DAG 节点组件
│   │   ├── ToolView/
│   │   │   ├── ToolViewPanel.tsx # 工具视图容器
│   │   │   ├── TerminalView.tsx # xterm.js 终端
│   │   │   └── ToolCards.tsx    # 工具卡片列表
│   │   └── BottomBar/
│   │       └── RecentTools.tsx  # 最近工具状态概览
│   ├── stores/
│   │   ├── useTaskStore.ts     # 任务/DAG 状态
│   │   └── useSessionStore.ts  # 会话管理状态
│   ├── hooks/
│   │   └── useWebSocket.ts     # WS 连接管理
│   └── types/
│       └── events.ts           # 事件类型定义
├── package.json
└── tsconfig.json
```

---

## 六、组件设计

### 6.1 DAGCanvas
- **职责**：React Flow 画布容器，管理 DAG 节点和边的增删改
- **状态来源**：Zustand `useTaskStore`
- **事件**：接收 WS 推送的 `agent_start` / `agent_end` / `tool_call` 事件，实时更新节点

### 6.2 DAGNode
- **职责**：自定义 React Flow 节点组件
- **样式**：根据状态（pending/running/completed/failed）显示不同边框和动画
- **交互**：点击展开详情，支持拖拽

### 6.3 TerminalView
- **职责**：xterm.js 终端模拟器，原样显示 Claude Code 输出
- **数据流**：WS 消息直接写入 xterm buffer
- **交互**：支持复制、搜索、滚动

### 6.4 ToolCards
- **职责**：结构化展示工具调用
- **卡片信息**：工具名、调用时间、执行耗时、参数摘要、结果摘要
- **交互**：点击展开详情，支持折叠

### 6.5 TokenBar
- **职责**：顶部 Token 消耗统计
- **数据来源**：WS 推送 `token_usage` 事件
- **显示格式**：`Input: X | Output: X | Total: X`

### 6.6 SessionDropdown
- **职责**：会话列表下拉菜单
- **功能**：新建会话、切换会话、删除会话
- **状态来源**：Zustand `useSessionStore`

---

## 七、后端设计

### 7.1 ClaudeCodeProcess
```typescript
class ClaudeCodeProcess {
  spawn(sessionId: string, projectPath: string): void
  kill(sessionId: string): void
  sendInput(sessionId: string, input: string): void
  onOutput(callback: (data: string) => void): void
}
```

### 7.2 AnsiParser
```typescript
class AnsiParser {
  feed(data: string): ClaudeEvent | null
  // 维护解析状态机，处理跨行工具参数
}
```

### 7.3 WebSocket Server
- 端口：默认 `3001`
- 协议：JSON over WebSocket
- 消息方向：后端 → 前端（事件推送）、前端 → 后端（任务取消）

---

## 八、实现优先级

### Phase 1 — 核心骨架
1. 项目初始化（React + Node.js + TypeScript）
2. WebSocket 双向通信基础
3. Claude Code 进程 spawn + kill
4. ANSI 解析器基础版

### Phase 2 — 可视化
5. React Flow DAG 画布
6. 节点状态样式
7. 工具卡片视图
8. 终端视图（xterm.js）

### Phase 3 — 增强功能
9. Token 统计条
10. 会话管理（下拉菜单）
11. 视图切换（终端/卡片）
12. DAG 边动画（依赖关系可视化）

---

## 九、设计约束

1. **零侵入 Claude Code**：不修改 Claude Code CLI 本身，纯解析输出
2. **向前兼容**：ANSI 解析规则通过配置管理，支持版本更新时调整
3. **离线优先**：所有数据存储在本地，无服务端依赖
4. **性能优先**：DAG 更新使用 React Flow 内置 diffing，不全量重渲染

---

## 十、待确认事项

> 以下事项在实现前需进一步确认：

1. **Claude Code 版本**：当前解析规则基于的 Claude Code 版本号（不同版本 ANSI 格式可能不同）
2. **Token 统计来源**：Claude Code 是否直接输出 token 用量，还是需要从 API 响应估算
3. **多会话并行**：是否支持同时运行多个 Claude Code 进程（当前设计支持）
