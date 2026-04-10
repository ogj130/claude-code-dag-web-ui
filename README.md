# Claude Code DAG Web UI

> 现代化 Web 界面，实时可视化 Claude Code Agent 执行流程

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-blue?style=flat-square&logo=react)](https://react.dev/)
[![Electron](https://img.shields.io/badge/Electron-33-black?style=flat-square&logo=electron)](https://www.electronjs.org/)

---

## 这个项目做什么？

Claude Code DAG Web UI 是一个桌面应用，将 Claude Code 的 Agent 执行过程以 **DAG（有向无环图）** 的形式实时可视化出来。

当你向 Claude Code 发送一个问题时，应用会：
- 在 DAG 图中实时展示 AI 的思考链路、工具调用顺序
- 在终端视图中同步显示原始执行日志
- 用卡片系统记录每轮问答的完整分析

---

## 适合哪些人？

| 群体 | 为什么需要它 |
|------|-------------|
| **Claude Code 重度用户** | 想直观看到 AI 在做什么，而不是只看终端滚动的日志 |
| **AI Agent 开发者** | 调试 Agent 行为，分析工具调用链路 |
| **学习 AI 编程的开发者** | 可视化理解 AI 是怎么分解任务、调用工具的 |

---

## 环境要求

- **Node.js** ≥ 20（推荐 22）
- **Claude Code CLI** 已安装
  ```bash
  npm install -g @anthropic/claude-code
  claude --version  # 验证安装
  ```

---

## 使用方式一：开发模式（推荐调试时用）

```bash
# 克隆项目
git clone https://github.com/ogj130/claude-code-dag-web-ui.git
cd claude-code-dag-web-ui

# 安装依赖
npm install

# 启动开发服务器（前端 + 后端）
npm run dev
```

然后浏览器打开 **http://localhost:5400**

---

## 使用方式二：安装独立应用（生产使用）

从 GitHub Releases 下载对应平台安装包：

👉 **https://github.com/ogj130/claude-code-dag-web-ui/releases/latest**

### macOS

1. 下载 `Claude Code Web UI-x.x.x-arm64.dmg`（Apple Silicon）
   或 `Claude Code Web UI-x.x.x.dmg`（Intel）
2. 打开 DMG，将应用拖入「应用程序」
3. 首次启动时，如提示"无法打开"，去「系统设置 → 隐私与安全性」允许运行

### Windows

1. 下载 `.exe` 安装包
2. 双击运行，安装程序会自动安装
3. 从开始菜单启动应用

### Linux

**AppImage（推荐）**
```bash
chmod +x Claude-Code-Web-UI-*.AppImage
./Claude-Code-Web-UI-*.AppImage
```

**Debian / Ubuntu**
```bash
sudo dpkg -i claude-code-web-ui_*.deb
```

**Fedora / RHEL**
```bash
sudo rpm -i claude-code-web-ui-*.rpm
```

---

## 界面介绍

启动后，应用分为三个区域：

```
┌─────────────────────────────────────────────────┐
│  Toolbar（会话管理 / 主题切换 / 快捷键）          │
├────────────────────────┬────────────────────────┤
│                        │                        │
│   DAG 可视化区域        │   终端视图区域          │
│   展示 Agent 执行链路   │   原始工具日志          │
│   可折叠/展开查询节点   │   输入框发送问题        │
│                        │                        │
├────────────────────────┴────────────────────────┤
│  Bottom Bar（最近工具 / Token 统计）            │
└─────────────────────────────────────────────────┘
```

### DAG 节点类型

| 节点 | 含义 |
|------|------|
| 🟦 Agent | 根节点，Claude Agent 本身 |
| 🟩 Query | 用户提问，对应一轮问答（可折叠） |
| 🟨 Tool | 工具调用（如 Bash 执行、文件读写等） |
| 🟪 Summary | 本轮问答总结，AI 生成的分析 |

---

## 技术架构

```
  ┌─────────────┐     WebSocket      ┌──────────────────┐
  │   浏览器     │ ←──────────────→  │  Node.js WS Server│
  │  (React)    │   ws://:5300      │                  │
  └─────────────┘                   │  解析 Claude Code │
                                     │  stdout 事件      │
                                     │  ANSI 转 JSON     │
                                     └────────┬─────────┘
                                              │ spawn
                                     ┌────────▼─────────┐
                                     │  Claude Code CLI  │
                                     └──────────────────┘
```

- **前端**：React 18 + TypeScript + ReactFlow + Zustand + xterm.js
- **后端**：Node.js WebSocket Server + tsx runner
- **Electron 桌面版**：独立打包，可离线运行

---

## 本地构建

```bash
# 克隆后
npm install

# 前端构建（Vite）
npm run build    # 输出到 dist/

# Electron 桌面应用构建
cd electron
npm install
ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/" npm run dist
# 输出：electron/release/*.dmg / *.exe / *.AppImage
```

---

## License

MIT · Made with 💙 by [ogj130](https://github.com/ogj130)
