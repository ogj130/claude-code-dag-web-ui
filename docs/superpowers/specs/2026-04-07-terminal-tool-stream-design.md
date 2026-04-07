# 终端工具流式展示

## 1. 问题

当前终端只显示原始文本日志（xterm.js），`tool_call` / `tool_result` / `tool_progress` 事件虽然已存入 store，但完全没有渲染。用户希望终端内叠加展示结构化的工具执行过程。

## 2. 目标效果

```
› 你好啊
  ↳ Grep     [pattern: "TODO"]                        [进行中...]
  ↳ Read     [file: "src/main.tsx"]                   [完成✓]
  ↳ Bash     [command: "npm run dev"]                  [完成✓]

  [Claude Code 执行日志...]
```

- 紧凑内联风格（小图标 + 工具名 + 参数摘要）
- 追加新行：running 行不消失，completed 时在下方追加新行
- 与 xterm.js 原始日志叠加展示
- 实时流式进度（`tool_progress` 事件）

## 3. 架构

### 3.1 新组件：ToolStreamView

```
src/components/ToolView/
  ToolStreamView.tsx   ← 新增
  ToolStreamNode.tsx  ← 新增（单个工具节点）
```

**ToolStreamView 职责**：
- 订阅 `toolCalls` 和 `tool_progress` 事件
- 按 query 分组渲染工具节点（当前 query 的工具显示在顶部）
- 追加模式：running 行保留，completed 时追加新行
- 流式进度：接收 `tool_progress` 事件，实时追加到 running 节点

**数据来源**：

| 事件 | 用途 |
|------|------|
| `tool_call` | 创建 running 节点（追加到列表） |
| `tool_result` | 追加 completed 行（running 行保留） |
| `tool_progress` | 更新 running 节点的进度文本 |

### 3.2 ToolStreamView 位置

在 `TerminalView.tsx` 中，插入到 MarkdownCard 列表和 xterm 终端之间：

```
┌─────────────────────────────────┐
│ TopStatusBar (token/连接状态)     │
├─────────────────────────────────┤
│ MarkdownCard (Q1 回答)            │
│ MarkdownCard (Q2 回答)            │
├─────────────────────────────────┤
│ ToolStreamView (新)               │  ← 新增
│   ↳ Grep    [进行中...]           │
│   ↳ Read    [完成✓]              │
│   ↳ Read    [完成✓]              │  ← 追加行
├─────────────────────────────────┤
│ xterm.js (原始执行日志)           │
├─────────────────────────────────┤
│ 输入框                           │
└─────────────────────────────────┘
```

### 3.3 ToolStreamNode 单节点样式

**Running 状态**：
```
↳ [旋转图标] Read   [file: "src/App.tsx"]   [进行中...]
```
- 左侧旋转圆点动画（CSS spin）
- 工具名：accent 蓝色
- 参数：dim 灰色，截断 40 字符
- 状态：`进行中...`，accent 蓝色

**Completed 状态**：
```
  [✓] Read   [file: "src/App.tsx"]   0.32s
```
- 左侧绿色对勾
- 工具名：success 绿色
- 执行时长（可选，根据 startTime/endTime 计算）
- 追加到 running 行下方

**Failed 状态**：
```
  [✗] Bash   [command: "npm run build"]   [失败]
```
- 左侧红色叉
- 工具名：error 红色
- 状态：`[失败]`

**Progress 更新**：
```
↳ [旋转图标] Bash   [进行中...]           [streaming output...]
```
- running 节点底部追加 progress 文本行
- 每次 `tool_progress` 事件，追加一行 dim 文本

### 3.4 按 query 分组

每个 query 有独立的工具流，同一时刻只显示当前 query 的工具：

```typescript
// store 里新增
activeToolCallsByQuery: Map<queryId, ToolCall[]>
```

或者直接从 `toolCalls` 数组过滤当前 query 的工具（`tool.parentId` = queryId）。

### 3.5 store 新增字段

```typescript
// useTaskStore.ts - TaskState
toolProgressMessages: Map<string, string>; // toolId → 累积的 progress 文本
```

`tool_progress` 事件 handler：
```typescript
case 'tool_progress': {
  const msg = event.message;
  set(state => {
    const m = new Map(state.toolProgressMessages);
    m.set(event.toolId, (m.get(event.toolId) ?? '') + msg);
    return { toolProgressMessages: m };
  });
  break;
}
```

## 4. 组件设计

### ToolStreamView

```typescript
interface Props {
  theme: 'dark' | 'light';
}
```

- 从 `useTaskStore` 获取 `toolCalls` + `toolProgressMessages`
- 按 `currentQueryId` 过滤，只显示当前 query 的工具
- 运行中工具 + 已完成工具分开区域
- 已完成工具最多显示最近 10 条，超出滚动

### ToolStreamNode

```typescript
interface Props {
  toolCall: ToolCall;
  progress: string;  // 累积的 progress 文本
  theme: 'dark' | 'light';
}
```

- 状态机：pending → running → completed/failed
- Running: 旋转图标 + 实时 progress 追加
- Completed: 绿色对勾 + 执行时长
- Failed: 红色叉 + 错误摘要

## 5. 样式系统

沿用 `ui-ux-pro-max` 设计指南：

- **颜色**：accent 蓝（running）、success 绿（completed）、error 红（failed）
- **字体**：JetBrains Mono 12px，参数摘要 10px dim
- **动画**：running 图标旋转（1s linear infinite），状态文字淡入
- **间距**：节点间距 6px，左侧缩进 16px
- **Touch target**：最小 32px 高度（可点击展开详情）

## 6. 事件映射

| Claude Code stdout 行 | 触发事件 | ToolStreamView 行为 |
|---------------------|---------|------------------|
| `Executing tool: Grep` | `tool_call` | 创建 running 节点 |
| `Tool progress: ...` | `tool_progress` | 追加 progress 文本到 running 节点 |
| `Tool result: ...` | `tool_result` | 追加 completed 节点，running 节点保留 |

注：`terminalLines` 不再直接渲染工具行，改为由 `tool_call` / `tool_result` / `tool_progress` 事件驱动结构化展示。

## 7. 组件变更

| 文件 | 变更 |
|------|------|
| `src/stores/useTaskStore.ts` | 新增 `toolProgressMessages: Map<string, string>`；`tool_progress` handler |
| `src/components/ToolView/ToolStreamView.tsx` | 新增，工具流主容器 |
| `src/components/ToolView/ToolStreamNode.tsx` | 新增，单个工具节点 |
| `src/components/ToolView/TerminalView.tsx` | 引用 ToolStreamView，插入到 MarkdownCard 和 xterm 之间 |

## 8. 实现优先级

1. **P0**：基础结构渲染（tool_call → running 节点）
2. **P0**：`tool_result` → completed 追加行
3. **P1**：`tool_progress` 流式进度追加
4. **P2**：执行时长显示
5. **P2**：点击展开参数详情
