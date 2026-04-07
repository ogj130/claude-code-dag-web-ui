# 终端工具流式展示实施计划

**Goal:** 在终端内叠加展示结构化工具执行流（running/completed/failed/progress），追加模式。

**Architecture:** `useTaskStore` 新增 `toolProgressMessages` 存储 progress 累积文本；`ToolStreamNode` 单节点负责状态渲染；`ToolStreamView` 容器订阅 store，按 query 过滤渲染；`TerminalView` 将 `ToolStreamView` 插入 MarkdownCard 和 xterm 之间。

**Tech Stack:** React, TypeScript, Zustand, CSS Animations

---

## Task 1: useTaskStore — 新增 toolProgressMessages 状态和 handler

**Files:**
- Modify: `src/stores/useTaskStore.ts`

### Step 1: 添加 toolProgressMessages 字段

找到 `TaskState` 接口（约第 19 行），在 `toolCalls: ToolCall[];` 之后添加：

```typescript
toolProgressMessages: Map<string, string>; // toolId → 累积的 progress 文本
```

找到初始值（约第 47 行），在 `toolCalls: []` 之后添加：

```typescript
toolProgressMessages: new Map(),
```

### Step 2: 添加 tool_progress handler

找到 `handleEvent` 的 `case 'token_usage':`（约第 160 行）之前，添加：

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

### Step 3: reset 中也清空

找到 `reset` 函数（约第 276 行），在 `toolCalls: []` 之后添加：

```typescript
toolProgressMessages: new Map(),
```

### Step 4: 验证编译

Run: `npx tsc --noEmit`
Expected: 无错误

---

## Task 2: ToolStreamNode.tsx — 单个工具节点

**Files:**
- Create: `src/components/ToolView/ToolStreamNode.tsx`

### Step 1: 写入文件

```typescript
import React, { memo } from 'react';
import type { ToolCall } from '../../types/events';

interface Props {
  toolCall: ToolCall;
  progress: string;   // 累积的 progress 文本
  isRunning: boolean; // 该工具是否仍在 running（用于决定是否显示动画）
}

const STATUS_COLOR = {
  pending: 'var(--text-dim)',
  running: 'var(--accent)',
  completed: 'var(--success)',
  error: 'var(--error)',
};

const STATUS_LABEL = {
  pending: '等待',
  running: '进行中...',
  completed: '完成',
  error: '失败',
};

/** 格式化工具参数为一行摘要 */
function formatArgs(tool: string, args: Record<string, unknown> | undefined): string {
  if (!args || Object.keys(args).length === 0) return '';
  switch (tool) {
    case 'read': {
      const f = String(args.file ?? '');
      return f ? `path: ${f.split('/').pop() ?? f}` : '';
    }
    case 'Write':
    case 'Edit':
    case 'NotebookEdit': {
      const f = String(args.file ?? '');
      return f ? `path: ${f.split('/').pop() ?? f}` : '';
    }
    case 'Bash': {
      const cmd = String(args.command ?? args.cmd ?? '');
      return cmd.length > 40 ? cmd.slice(0, 40) + '…' : cmd;
    }
    case 'Grep':
    case 'WebSearch':
    case 'WebFetch': {
      const q = String(args.query ?? args.url ?? args.pattern ?? '');
      return q.length > 40 ? q.slice(0, 40) + '…' : q;
    }
    default: {
      const k = Object.keys(args).slice(0, 2);
      return k.map(key => `${key}=${String(args[key]).slice(0, 20)}`).join(', ');
    }
  }
}

/** 格式化执行时长 */
function formatDuration(start: number, end: number | undefined): string {
  if (!end) return '';
  const ms = end - start;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function ToolStreamNodeInner({ toolCall, progress, isRunning }: Props) {
  const { tool, args, status, startTime, endTime } = toolCall;
  const color = STATUS_COLOR[status] ?? 'var(--text-dim)';
  const label = STATUS_LABEL[status] ?? status;
  const argsSummary = formatArgs(tool, args);
  const duration = formatDuration(startTime, endTime);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      padding: '4px 0',
      minHeight: 28,
    }}>
      {/* 主行：图标 + 工具名 + 参数 + 状态 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
        lineHeight: 1.5,
      }}>
        {/* 状态图标 */}
        <div style={{ width: 14, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {status === 'running' && isRunning ? (
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              border: `1.5px solid ${color}`,
              borderTopColor: 'transparent',
              animation: 'tool-spin 0.8s linear infinite',
            }} />
          ) : status === 'completed' ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : status === 'error' ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, opacity: 0.5 }} />
          )}
        </div>

        {/* 工具名 */}
        <span style={{ color, fontWeight: 600, flexShrink: 0, minWidth: 56, textAlign: 'right' }}>
          {tool}
        </span>

        {/* 分隔符 */}
        <span style={{ color: 'var(--border)', flexShrink: 0 }}>·</span>

        {/* 参数摘要 */}
        {argsSummary && (
          <span style={{ color: 'var(--text-dim)', fontSize: 10, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {argsSummary}
          </span>
        )}

        {/* 状态/时长 */}
        <span style={{
          color,
          fontSize: 10,
          flexShrink: 0,
          fontWeight: status === 'running' ? 400 : 600,
        }}>
          {status === 'completed' ? `${duration}`
            : status === 'error' ? `[${label}]`
            : `[${label}]`}
        </span>
      </div>

      {/* Progress 追加行（running 状态下） */}
      {status === 'running' && progress && (
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          color: 'var(--text-dim)',
          paddingLeft: 20,
          marginTop: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          opacity: 0.75,
        }}>
          {progress}
        </div>
      )}
    </div>
  );
}

function propsAreEqual(prev: Props, next: Props): boolean {
  return (
    prev.toolCall.id === next.toolCall.id &&
    prev.toolCall.status === next.toolCall.status &&
    prev.toolCall.endTime === next.toolCall.endTime &&
    prev.progress === next.progress &&
    prev.isRunning === next.isRunning
  );
}

export const ToolStreamNode = memo(ToolStreamNodeInner, propsAreEqual);
```

### Step 2: 验证编译

Run: `npx tsc --noEmit`
Expected: 无错误

---

## Task 3: ToolStreamView.tsx — 工具流容器

**Files:**
- Create: `src/components/ToolView/ToolStreamView.tsx`

### Step 1: 写入文件

```typescript
import React, { useMemo } from 'react';
import { useTaskStore } from '../../stores/useTaskStore';
import { ToolStreamNode } from './ToolStreamNode';

interface Props {
  theme: 'dark' | 'light';
}

export function ToolStreamView({ theme }: Props) {
  const { toolCalls, toolProgressMessages, currentQueryId, isRunning } = useTaskStore();

  // 只显示当前 query 的工具节点（通过 parentId 关联）
  const currentTools = useMemo(() => {
    const qid = currentQueryId ?? 'main-agent';
    return toolCalls.filter(t => {
      // tool.parentId 存在时用 parentId，否则用当前 queryId（通过 label 关联）
      return t.id.includes(qid) || qid === 'main-agent';
    });
  }, [toolCalls, currentQueryId]);

  // 按状态分组：running 在前，completed/error 在后
  const { activeTools, completedTools } = useMemo(() => {
    const active: typeof toolCalls = [];
    const completed: typeof toolCalls = [];
    for (const t of currentTools) {
      if (t.status === 'running') active.push(t);
      else completed.push(t);
    }
    return { activeTools: active, completedTools: completed.slice(-10) }; // 最多显示最近10条已完成
  }, [currentTools]);

  const isEmpty = activeTools.length === 0 && completedTools.length === 0;
  if (isEmpty) return null;

  return (
    <div style={{
      padding: '6px 14px',
      borderTop: '1px solid var(--term-border)',
      background: 'var(--term-bg)',
      display: 'flex',
      flexDirection: 'column',
      gap: 0,
    }}>
      {/* Running 工具 */}
      {activeTools.map(tool => (
        <ToolStreamNode
          key={tool.id}
          toolCall={tool}
          progress={toolProgressMessages.get(tool.id) ?? ''}
          isRunning={isRunning}
        />
      ))}

      {/* 已完成工具（追加新行模式） */}
      {completedTools.map(tool => (
        <ToolStreamNode
          key={`done-${tool.id}`}
          toolCall={tool}
          progress={toolProgressMessages.get(tool.id) ?? ''}
          isRunning={false}
        />
      ))}
    </div>
  );
}
```

**注意**：`currentTools` 的过滤逻辑依赖于 `toolCalls` 中每个工具的 `id` 包含 `queryId`。如果这个关联不可靠，可以改为从 `nodes` 中根据 `parentId = queryId` 查找工具节点 ID，然后用 ID 过滤 `toolCalls`。

### Step 2: 验证编译

Run: `npx tsc --noEmit`
Expected: 无错误

---

## Task 4: TerminalView.tsx — 插入 ToolStreamView

**Files:**
- Modify: `src/components/ToolView/TerminalView.tsx`

### Step 1: 添加 CSS keyframes

在文件顶部（import 之后）添加旋转动画样式：

```typescript
// ToolStreamView 旋转图标动画（内联 style 或全局 CSS）
const style = document.createElement('style');
style.textContent = `
  @keyframes tool-spin {
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);
```

或者在组件 return 的 JSX 中用 `<style>` 标签注入（推荐在 TerminalView 顶层容器）：

在 `TerminalView` 的 return `<div>` 最外层添加：

```tsx
<style>{`
  @keyframes tool-spin {
    to { transform: rotate(360deg); }
  }
`}</style>
```

### Step 2: 添加 ToolStreamView import

在文件顶部（第一个 import 之后）添加：

```typescript
import { ToolStreamView } from './ToolStreamView';
```

### Step 3: 在 MarkdownCard 和 xterm 之间插入 ToolStreamView

找到 MarkdownCard 列表结束的地方（约第 311 行）：

```tsx
        {/* xterm 工具调用日志 */}
        <div
          ref={containerRef}
```

在 `</div>` 之后、`{/* xterm 工具调用日志 */}` 之前，插入：

```tsx
        {/* 工具流展示（叠加在终端上方） */}
        <ToolStreamView theme={theme} />
```

### Step 4: 验证编译

Run: `npx tsc --noEmit`
Expected: 无错误

---

## 实现优先级与依赖

| Task | 描述 | 依赖 |
|------|------|------|
| Task 1 | useTaskStore 新增 toolProgressMessages | 无 |
| Task 2 | ToolStreamNode 单节点 | Task 1 |
| Task 3 | ToolStreamView 容器 | Task 2 |
| Task 4 | TerminalView 集成 | Task 3 |

顺序实施，每个 Task 完成后验证 `npx tsc --noEmit`。
