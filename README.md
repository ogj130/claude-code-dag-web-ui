# Claude Code DAG Web UI

<p align="center">
  <img src="screenshots/readme-full-view.png" alt="Claude Code DAG Web UI" width="100%" />
</p>

<p align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-blue?style=flat-square&logo=react)](https://react.dev/)
[![Electron](https://img.shields.io/badge/Electron-33-black?style=flat-square&logo=electron)](https://www.electronjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green?style=flat-square&logo=node.js)](https://nodejs.org/)

</p>

---

## 这个项目做什么？

将 Claude Code 的 Agent 执行过程以 **DAG（有向无环图）** 的形式实时可视化，让你直观看到 AI 在思考什么、调用了什么工具、输出了什么结果——而不是面对一片滚动的终端日志。

---

## 适合哪些人？

| 群体 | 为什么需要它 |
|------|-------------|
| **Claude Code 重度用户** | 可视化理解 AI 的执行链路，不再靠猜 |
| **AI Agent 开发者** | 调试 Agent 行为，分析工具调用链路 |
| **学习 AI 编程的开发者** | 可视化理解 AI 如何分解任务、调用工具 |

---

## 效果预览

<details open>
<summary><strong>DAG 执行图（暗黑模式）</strong></summary>
<img src="screenshots/readme-dag-view.png" alt="DAG View" width="100%" />
</details>

<details>
<summary><strong>终端卡片视图（暗黑模式）</strong></summary>
<img src="screenshots/readme-card-view.png" alt="Card View" width="100%" />
</details>

<details>
<summary><strong>明亮模式</strong></summary>
<img src="screenshots/readme-light-mode.png" alt="Light Mode" width="100%" />
</details>

---

## 环境要求

- **Node.js** ≥ 20（推荐 22）
- **Claude Code CLI** 已安装

```bash
npm install -g @anthropic/claude-code
claude --version  # 验证安装
```

---

## 使用方式一：开发模式

```bash
# 克隆项目
git clone https://github.com/ogj130/claude-code-dag-web-ui.git
cd claude-code-dag-web-ui

# 安装依赖
npm install

# 启动（前端 + 后端同时运行）
npm run dev
```

浏览器打开 **http://localhost:5400**

---

## 使用方式二：安装桌面应用

👉 **[下载最新版本](https://github.com/ogj130/claude-code-dag-web-ui/releases/latest)**

### macOS

1. 下载 `.dmg` 镜像（Apple Silicon 选 arm64，Intel 选 x64）
2. 打开 DMG，拖入「应用程序」
3. 首次运行需在「系统设置 → 隐私与安全性」允许

### Windows

下载 `.exe` 安装包，双击运行即可。

### Linux

```bash
# AppImage（推荐）
chmod +x Claude-Code-Web-UI-*.AppImage
./Claude-Code-Web-UI-*.AppImage

# 或 deb
sudo dpkg -i claude-code-web-ui_*.deb
```

---

## 功能特性

| | |
|---|---|
| **DAG 执行图** | 可视化 Agent 思维链路，节点可折叠/展开 |
| **终端 + 工具卡片** | 实时工具调用展示，无需 Tab 切换 |
| **流式总结** | AI 回答逐字输出，卡片带打字机动画 |
| **Markdown 渲染** | GFM 支持，含表格、代码块等 |
| **暗黑/明亮模式** | CSS 变量驱动，一键切换 |
| **会话管理** | 多会话历史，随时切换 |
| **响应式布局** | 自适应窗口宽度 |
| **快捷键支持** | Cmd+K 搜索、Cmd+\\ 折叠等 |

---

## 界面说明

```
┌──────────────────────────────────────────────────────────────┐
│  Toolbar：会话列表 / 主题切换 / Token 统计 / 快捷键帮助       │
├──────────────────────────┬───────────────────────────────────┤
│                          │                                   │
│   DAG 可视化区域           │   终端视图区域                      │
│   实时展示 Agent 执行链路   │   原始工具日志 + 输入框              │
│   可折叠/展开查询节点       │                                    │
│                          │                                    │
├──────────────────────────┴───────────────────────────────────┤
│  Bottom Bar：最近工具调用 / Token 消耗                          │
└──────────────────────────────────────────────────────────────┘
```

### DAG 节点类型

| 节点 | 含义 | 颜色 |
|------|------|------|
| **Agent** | 根节点，Claude Agent 本身 | 蓝 |
| **Query** | 用户提问（可折叠） | 绿 |
| **Tool** | 工具调用（Read/Bash/Edit 等） | 黄 |
| **Summary** | 本轮总结，AI 生成的分析 | 紫 |

---

## 架构设计

### 系统架构

```mermaid
graph TB
    subgraph Frontend["前端 (React)"]
        UI["界面层\nDAG + Terminal + Cards"]
        Store["状态层 (Zustand)\n事件 → 状态 → 渲染"]
        WS["WebSocket 客户端\n:5300"]
    end

    subgraph Backend["后端 (Node.js)"]
        WSS["WebSocket 服务端\n:5300"]
        AP["ANSI 解析器\nstdout → JSON 事件"]
        CC["Claude Code 进程\nspawn"]
    end

    UI <--> Store
    Store <--> WS
    WS <-.-> WSS
    WSS <--> AP
    AP <-.-> CC

    style Frontend fill:#1a3a5c,color:#fff
    style Backend fill:#1a3a2c,color:#fff
```

### 事件驱动数据流

```mermaid
sequenceDiagram
    participant User as 用户
    participant UI as 前端 UI
    participant WS as WebSocket
    participant CC as Claude Code

    User->>UI: 发送问题
    UI->>WS: send_input
    WS->>CC: 转发输入
    CC-->>WS: stdout (ANSI)
    WS->>AP: 解析 ANSI
    AP-->>WS: JSON 事件
    WS->>UI: handleEvent(event)
    UI->>UI: 更新 DAG / Terminal / Cards
```

### 状态转换

```mermaid
stateDiagram-v2
    [*] --> Idle: session_start
    Idle --> Running: 发送问题
    Running --> Running: 新一轮问答
    Running --> QueryEnd: query_end
    QueryEnd --> Completed: query_summary
    Completed --> Running: 发送下一个问题
    Completed --> [*]: session_end
```

### 模块说明

| 模块 | 职责 |
|------|------|
| `src/stores/` | Zustand 状态管理，事件处理，IndexedDB 持久化 |
| `src/components/DAG/` | ReactFlow 可视化，节点渲染，布局算法 |
| `src/components/ToolView/` | 终端视图、工具卡片、Markdown 渲染 |
| `src/hooks/` | WebSocket 连接、主题、快捷键 |
| `server/` | WebSocket Server + ANSI Parser + Claude Code 进程管理 |
| `electron/` | Electron 主进程，HTTP 静态服务器，桌面打包 |

---

## 技术栈

```
前端                  后端                   Electron
───────────────     ────────────────       ─────────────
 React 18      →    Node.js WS Server      Electron 33
 TypeScript    →    tsx runner             WebSocket
 Zustand       →    Claude Code spawn     HTTP Server
 ReactFlow     →    ANSI Parser           electron-builder
 xterm.js      →                         (跨平台打包)
 react-markdown→
```

---

## 本地构建

```bash
# 克隆后
npm install

# 前端构建
npm run build

# Electron 桌面应用构建
cd electron
npm install
ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/" npm run dist

# 输出目录
electron/release/
├── *.dmg      # macOS
├── *.exe      # Windows
├── *.AppImage # Linux
├── *.deb
└── *.rpm
```

---

## License

MIT · Made with by [ogj130](https://github.com/ogj130)
