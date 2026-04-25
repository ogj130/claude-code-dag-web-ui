# CLAUDE.md — Claude Code Web UI

## 项目概述

- **项目名称**：Claude Code Web UI
- **技术栈**：Electron + React + TypeScript + Zustand + Vite
- **工作目录**：`/Users/ouguangji/2026/cc-web-ui/`

## Skills

### Bug 修复工作流（必须使用）

**`fix-bug-workflow`** — 规范化 Bug 修复工作流

当用户报告 Bug 时，必须使用此工作流：

```
Step 1: System Debug（根因分析）
Step 2: Code Review（代码评审）
Step 3: TDD（测试驱动开发）
Step 4: Browser Test（浏览器验证）
Step 5: 迭代循环（验证通过 → 提交；不通过 → 回 Step 1）
Step 6: Git Commit（提交修复）
Step 7: Documentation（输出文档到 ./docs/）
```

详细说明见：`.claude/skills/fix-bug-workflow/SKILL.md`

### 文档目录

- `docs/fix-bug-result/` — Bug 修复报告
- `docs/fix-bug-notes/` — Bug 修复错题本

## 项目结构

```
cc-web-ui/
├── electron/              # Electron 主进程
│   ├── src/main.ts       # 主进程入口
│   └── release/          # 构建产物
├── src/
│   ├── components/       # React 组件
│   ├── stores/           # Zustand 状态管理
│   ├── services/         # 服务层
│   └── __tests__/        # 测试用例
├── server/               # Node.js 服务端
└── docs/                 # 文档
```

## 常用命令

```bash
# 开发
npm run dev              # 启动开发服务器（前后端）
npm run dev:client       # 仅前端
npm run dev:server       # 仅后端

# 构建
npm run build            # 前端构建
cd electron && npm run dist  # Electron 打包

# 测试
npm run test             # 运行所有测试
npx vitest run path/to/test  # 运行单个测试
```

## 关键调试模式

详见：`memory/systematic_debugging_patterns.md`

### 常见 Bug 模式

1. **双 WS 连接重复处理**：StrictMode 导致 doConnect() 被调用两次
2. **数据源不一致**：读和写使用了不同的 IndexedDB 数据库
3. **Zustand 状态读取陷阱**：set() 后必须用 getState() 重新获取
4. **工作区状态覆盖**：全局单例状态被多工作区事件交错覆盖

## 构建验证

构建产物位于 `electron/release/`：
- macOS：`Claude Code Web UI-1.4.1.dmg`
- Windows：`Claude Code Web UI Setup 1.4.1.exe`
