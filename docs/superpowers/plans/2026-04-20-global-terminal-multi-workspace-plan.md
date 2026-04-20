# 全局终端多工作区流式展示实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 全局终端发送后触发所有工作区并行执行，流式输出同时展示到 Terminal 和 DAG，且两者共用水槽式标签切换（全局 ↔ 单工作区）。

**Architecture:**
- Phase 0: 新建 `useGlobalTerminalStore`（消息块级交错存储） + 改造 `useWebSocket` 路由 `terminalChunk` 到该 store
- Phase 1: 改造 `useTerminalWorkspaceStore`（扩展动态标签状态） + 改造 `WorkspaceTagBar`（支持动态标签+状态图标） + 改造 `App.tsx`（集成 WorkspaceView 容器）
- Phase 2: 改造 `TerminalView`（支持 activeTab 模式切换：全局视图 / 单工作区视图） + 集成 `useGlobalTerminalStore` 全局视图渲染
- Phase 3: 新建 `WorkspaceContainerNode` + 改造 `DAGCanvas`（支持容器节点模式 + activeTab 切换）
- Phase 4: 改造 `dispatchGlobalPrompts`（集成标签添加/移除 + batchResult 完成状态联动）

**Tech Stack:** React, Zustand, xterm.js, ReactFlow, TypeScript

---

## 文件变更总览

| 文件 | 改动 |
|------|------|
| `src/stores/useGlobalTerminalStore.ts` | **新建** — 消息块级交错存储 |
| `src/hooks/useWebSocket.ts` | 改造 — `terminalChunk` 路由到 `useGlobalTerminalStore` |
| `src/stores/useTerminalWorkspaceStore.ts` | 改造 — 扩展 workspaceTabs 动态状态、竞态安全移除 |
| `src/components/ToolView/WorkspaceTagBar.tsx` | 改造 — 动态标签渲染 + 状态图标 |
| `src/components/ToolView/TerminalView.tsx` | 改造 — activeTab 模式切换 |
| `src/components/ToolView/GlobalTerminalView.tsx` | **新建** — 全局合并终端视图组件 |
| `src/components/DAG/WorkspaceContainerNode.tsx` | **新建** — DAG 容器节点 |
| `src/components/DAG/DAGCanvas.tsx` | 改造 — 容器节点模式 + activeTab 切换 |
| `src/services/globalDispatchService.ts` | 改造 — 集成标签状态联动 |
| `src/App.tsx` | 改造 — WorkspaceView 容器结构 |
| `src/__tests__/useGlobalTerminalStore.test.ts` | **新建** — 单元测试 |
| `src/__tests__/WorkspaceTagBar.test.tsx` | **新建** — 交互测试 |

---

## Phase 0：WebSocket Chunk 路由基础设施

### Task 0.1: 创建 useGlobalTerminalStore

**Files:**
- Create: `src/stores/useGlobalTerminalStore.ts`
- Test: `src/__tests__/useGlobalTerminalStore.test.ts`

- [ ] **Step 1: 编写失败的测试**

```typescript
// src/__tests__/useGlobalTerminalStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { create } from 'zustand/vanilla';
import { useGlobalTerminalStore } from '../../src/stores/useGlobalTerminalStore';

describe('useGlobalTerminalStore', () => {
  beforeEach(() => {
    useGlobalTerminalStore.setState({ workspaceChunks: {}, mergedOrder: [] });
  });

  it('appendChunk adds chunk to correct workspace', () => {
    useGlobalTerminalStore.getState().appendChunk('ws-A', 'hello');
    expect(useGlobalTerminalStore.getState().workspaceChunks['ws-A']).toEqual(['hello']);
  });

  it('appendChunk accumulates multiple chunks per workspace', () => {
    useGlobalTerminalStore.getState().appendChunk('ws-A', 'chunk1');
    useGlobalTerminalStore.getState().appendChunk('ws-A', 'chunk2');
    expect(useGlobalTerminalStore.getState().workspaceChunks['ws-A']).toEqual(['chunk1', 'chunk2']);
  });

  it('getMergedContent returns interleaved chunks in arrival order', () => {
    useGlobalTerminalStore.getState().appendChunk('ws-A', 'A1');
    useGlobalTerminalStore.getState().appendChunk('ws-B', 'B1');
    useGlobalTerminalStore.getState().appendChunk('ws-A', 'A2');
    const merged = useGlobalTerminalStore.getState().getMergedContent();
    expect(merged).toEqual([
      { workspaceId: 'ws-A', chunk: 'A1' },
      { workspaceId: 'ws-B', chunk: 'B1' },
      { workspaceId: 'ws-A', chunk: 'A2' },
    ]);
  });

  it('reset clears all state', () => {
    useGlobalTerminalStore.getState().appendChunk('ws-A', 'hello');
    useGlobalTerminalStore.getState().reset();
    expect(useGlobalTerminalStore.getState().workspaceChunks).toEqual({});
    expect(useGlobalTerminalStore.getState().mergedOrder).toEqual([]);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd /Users/ouguangji/2026/cc-web-ui && npx vitest run src/__tests__/useGlobalTerminalStore.test.ts`
Expected: FAIL — "useGlobalTerminalStore not exported"

- [ ] **Step 3: 实现 useGlobalTerminalStore**

```typescript
// src/stores/useGlobalTerminalStore.ts
import { create } from 'zustand';

export interface MergedChunk {
  workspaceId: string;
  chunk: string;
}

interface GlobalTerminalState {
  /** key: workspaceId, value: 该工作区累积的消息块数组 */
  workspaceChunks: Record<string, string[]>;
  /** 按接收顺序记录 chunk 的元组（用于 getMergedContent） */
  mergedOrder: MergedChunk[];
}

interface GlobalTerminalActions {
  appendChunk: (workspaceId: string, chunk: string) => void;
  getMergedContent: () => MergedChunk[];
  reset: () => void;
}

type GlobalTerminalStore = GlobalTerminalState & GlobalTerminalActions;

const initialState: GlobalTerminalState = {
  workspaceChunks: {},
  mergedOrder: [],
};

export const useGlobalTerminalStore = create<GlobalTerminalStore>((set, get) => ({
  ...initialState,

  appendChunk: (workspaceId, chunk) => {
    set(state => {
      const existing = state.workspaceChunks[workspaceId] ?? [];
      return {
        workspaceChunks: { ...state.workspaceChunks, [workspaceId]: [...existing, chunk] },
        mergedOrder: [...state.mergedOrder, { workspaceId, chunk }],
      };
    });
  },

  getMergedContent: () => get().mergedOrder,

  reset: () => set(initialState),
}));
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run src/__tests__/useGlobalTerminalStore.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/stores/useGlobalTerminalStore.ts src/__tests__/useGlobalTerminalStore.test.ts
git commit -m "feat(terminal): add useGlobalTerminalStore for message-block interleaving"
```

---

### Task 0.2: 改造 useWebSocket 路由 terminalChunk

**Files:**
- Modify: `src/hooks/useWebSocket.ts:158-160`

- [ ] **Step 1: 读取当前 onmessage 处理 terminalChunk 的位置**

确认第 158-160 行的 `addTerminalChunk` 调用位置。

- [ ] **Step 2: 在 terminalChunk 处理处追加路由到 useGlobalTerminalStore**

在 `addTerminalChunk((parsed as WSTerminalChunkMessage).text);` 后追加一行：

```typescript
// 同时路由到全局终端 store（用于全局合并视图）
import { useGlobalTerminalStore } from '../stores/useGlobalTerminalStore';
// 在 ws.onmessage 的 terminalChunk 分支中：
useGlobalTerminalStore.getState().appendChunk(
  sessionId ?? 'default',
  (parsed as WSTerminalChunkMessage).text
);
```

- [ ] **Step 3: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add src/hooks/useWebSocket.ts
git commit -m "feat(terminal): route terminalChunk to useGlobalTerminalStore for global view"
```

---

## Phase 1：基础结构

### Task 1.1: 改造 useTerminalWorkspaceStore

**Files:**
- Modify: `src/stores/useTerminalWorkspaceStore.ts`

- [ ] **Step 1: 读取现有文件确认结构**

- [ ] **Step 2: 新增 WorkspaceTab 类型和 workspaceTabs 状态**

在文件顶部 `ExecutionStatus` 类型定义后追加：

```typescript
// 动态工作区标签状态
export type TabStatus = 'idle' | 'running' | 'completed' | 'error';

export interface WorkspaceTab {
  id: string;
  name: string;
  status: TabStatus;
  addedAt: number;
  batchId: number;
}
```

- [ ] **Step 3: 扩展 TerminalWorkspaceState 接口**

```typescript
// 新增字段（注意保持与现有字段兼容）
activeTab: 'global' | string;  // 替换 activeWorkspaceId，或新增
workspaceTabs: WorkspaceTab[];
```

> **决策点**：为保持向后兼容，`activeWorkspaceId` 保留，新增 `activeTab` 字段。后续 Task 1.3 统一迁移。

- [ ] **Step 4: 实现竞态安全的标签管理**

在 `TerminalWorkspaceActions` 中新增：

```typescript
// 开始执行时：添加所有工作区标签
onExecutionStart: (workspaces: Array<{id: string; name: string}>) => void;
// 单个状态更新
updateWorkspaceTab: (workspaceId: string, status: TabStatus) => void;
// 所有完成时：竞态安全的延迟移除
onAllCompleted: () => void;
// 重置标签
clearWorkspaceTabs: () => void;
```

实现 `onExecutionStart`（覆盖式，符合业务语义）：

```typescript
onExecutionStart: (workspaces) => {
  // 取消待执行的移除计时器
  if (removalTimer !== null) {
    clearTimeout(removalTimer);
    removalTimer = null;
  }
  executionBatchId++;
  set(state => ({
    workspaceTabs: workspaces.map(ws => ({
      id: ws.id,
      name: ws.name,
      status: 'running' as TabStatus,
      addedAt: Date.now(),
      batchId: executionBatchId,
    })),
  }));
},
```

实现 `onAllCompleted`（竞态安全）：

```typescript
// 模块级变量（store 外部）
let removalTimer: ReturnType<typeof setTimeout> | null = null;
let executionBatchId = 0;

onAllCompleted: () => {
  const batchId = executionBatchId;
  removalTimer = setTimeout(() => {
    // 只移除当前批次
    const current = useTerminalWorkspaceStore.getState();
    if (current.workspaceTabs.length > 0 && current.workspaceTabs[0].batchId === batchId) {
      useTerminalWorkspaceStore.setState({ workspaceTabs: [] });
    }
    removalTimer = null;
  }, 5000);
},
```

- [ ] **Step 5: 验证 TypeScript**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 6: 提交**

```bash
git add src/stores/useTerminalWorkspaceStore.ts
git commit -m "feat(workspace): extend useTerminalWorkspaceStore with dynamic workspace tabs and race-safe removal"
```

---

### Task 1.2: 改造 WorkspaceTagBar 支持动态标签

**Files:**
- Modify: `src/components/ToolView/WorkspaceTagBar.tsx`
- Create: `src/__tests__/WorkspaceTagBar.test.tsx`

- [ ] **Step 1: 读取现有 WorkspaceTagBar.tsx 确认样式**

现有文件只有约 40 行，props 接受 `workspaces`, `activeWorkspaceId`, `onSwitch`, `runningWorkspaces`。

- [ ] **Step 2: 扩展 WorkspaceTagBarProps 接口**

替换整个 `WorkspaceTagBarProps`：

```typescript
import type { TabStatus } from '../../stores/useTerminalWorkspaceStore';

export interface WorkspaceTab {
  id: string;
  name: string;
  status: TabStatus;
}

export interface WorkspaceTagBarProps {
  // 固定标签："全局"
  activeTab: 'global' | string;
  onTabChange: (tab: 'global' | string) => void;
  // 动态工作区标签（执行时填充）
  workspaceTabs?: WorkspaceTab[];
  // 回退：静态工作区列表（仅用于单工作区模式）
  workspaces?: Array<{ id: string; name: string; enabled: boolean }>;
  runningWorkspaces?: Set<string>;
}
```

- [ ] **Step 3: 实现动态标签渲染**

替换组件 return 内容：

```typescript
export function WorkspaceTagBar({
  activeTab,
  onTabChange,
  workspaceTabs = [],
  workspaces = [],
  runningWorkspaces = new Set(),
}: WorkspaceTagBarProps) {
  const enabled = workspaces.filter(ws => ws.enabled);

  return (
    <div className={styles.bar} role="tablist" aria-label="视图切换">
      {/* 全局标签（固定） */}
      <button
        role="tab"
        aria-selected={activeTab === 'global'}
        data-active={activeTab === 'global' ? 'true' : 'false'}
        className={styles.tag}
        onClick={() => onTabChange('global')}
      >
        全局
      </button>

      {/* 动态工作区标签（执行时显示） */}
      {workspaceTabs.map(tab => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            data-active={isActive ? 'true' : 'false'}
            data-status={tab.status}
            className={styles.tag}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.status === 'running' && <span className={styles.pulse} aria-hidden="true" />}
            {tab.status === 'completed' && <span aria-hidden="true">✓</span>}
            {tab.status === 'error' && <span aria-hidden="true">✗</span>}
            {tab.name}
          </button>
        );
      })}

      {/* 静态工作区标签（无动态标签时降级显示） */}
      {workspaceTabs.length === 0 && enabled.map(ws => {
        const isActive = ws.id === activeTab;
        const isRunning = runningWorkspaces.has(ws.id);
        return (
          <button
            key={ws.id}
            role="tab"
            aria-selected={isActive}
            data-active={isActive ? 'true' : 'false'}
            data-running={isRunning ? 'true' : 'false'}
            className={styles.tag}
            onClick={() => onTabChange(ws.id)}
          >
            {isRunning && <span className={styles.pulse} aria-hidden="true" />}
            {ws.name}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: 补充 CSS 样式**

在 `WorkspaceTagBar.module.css` 中追加：

```css
/* 状态样式 */
[data-status="running"] {
  border-color: var(--success);
  color: var(--success);
}

[data-status="completed"] {
  border-color: var(--text-muted);
  color: var(--text-muted);
}

[data-status="error"] {
  border-color: var(--error);
  color: var(--error);
}
```

- [ ] **Step 5: 编写 WorkspaceTagBar 测试**

```typescript
// src/__tests__/WorkspaceTagBar.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkspaceTagBar } from '../../src/components/ToolView/WorkspaceTagBar';

describe('WorkspaceTagBar', () => {
  it('renders global tab by default', () => {
    render(<WorkspaceTagBar activeTab="global" onTabChange={() => {}} />);
    expect(screen.getByRole('tab', { name: '全局' })).toBeInTheDocument();
  });

  it('calls onTabChange when global tab clicked', () => {
    const onTabChange = vi.fn();
    render(<WorkspaceTagBar activeTab="ws-A" onTabChange={onTabChange} />);
    fireEvent.click(screen.getByRole('tab', { name: '全局' }));
    expect(onTabChange).toHaveBeenCalledWith('global');
  });

  it('renders dynamic workspace tabs', () => {
    const tabs = [
      { id: 'ws-A', name: '工作区 A', status: 'running' as const },
      { id: 'ws-B', name: '工作区 B', status: 'completed' as const },
    ];
    render(<WorkspaceTagBar activeTab="global" onTabChange={() => {}} workspaceTabs={tabs} />);
    expect(screen.getByRole('tab', { name: /工作区 A/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /工作区 B/ })).toBeInTheDocument();
  });

  it('calls onTabChange with workspaceId when workspace tab clicked', () => {
    const onTabChange = vi.fn();
    const tabs = [{ id: 'ws-A', name: 'A', status: 'running' as const }];
    render(<WorkspaceTagBar activeTab="global" onTabChange={onTabChange} workspaceTabs={tabs} />);
    fireEvent.click(screen.getByRole('tab', { name: /A/ }));
    expect(onTabChange).toHaveBeenCalledWith('ws-A');
  });
});
```

- [ ] **Step 6: 运行测试**

Run: `npx vitest run src/__tests__/WorkspaceTagBar.test.tsx`
Expected: PASS

- [ ] **Step 7: 提交**

```bash
git add src/components/ToolView/WorkspaceTagBar.tsx src/components/ToolView/WorkspaceTagBar.module.css src/__tests__/WorkspaceTagBar.test.tsx
git commit -m "feat(workspace): WorkspaceTagBar supports dynamic workspace tabs with status icons"
```

---

### Task 1.3: 改造 App.tsx 集成 WorkspaceView 容器

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: 读取 App.tsx 确认当前 renderMainContent 结构**

当前第 207-241 行 `renderMainContent()` 渲染 `<DAGCanvas>` 和 `<TerminalView>` 并排。

- [ ] **Step 2: 引入 useTerminalWorkspaceStore 的 activeTab**

在 App.tsx 顶部添加：

```typescript
import { useTerminalWorkspaceStore } from './stores/useTerminalWorkspaceStore';
```

在组件内部：

```typescript
const activeTab = useTerminalWorkspaceStore(s => s.activeTab);
const workspaceTabs = useTerminalWorkspaceStore(s => s.workspaceTabs);
```

- [ ] **Step 3: 统一迁移 activeWorkspaceId → activeTab**

替换 `activeWorkspaceId` 的使用位置（第 93 行附近）：
- `useTerminalWorkspaceStore(s => s.activeWorkspaceId)` → `activeTab`
- `setActiveWorkspace` → `useTerminalWorkspaceStore.getState().setActiveWorkspace`
  或新增 `setActiveTab: (tab) => useTerminalWorkspaceStore.setState({ activeTab: tab })`

在 `TerminalWorkspaceActions` 中新增：

```typescript
setActiveTab: (tab: 'global' | string) => void;
```

实现：

```typescript
setActiveTab: (tab) => set({ activeTab: tab }),
```

- [ ] **Step 4: 验证 TypeScript**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 5: 提交**

```bash
git add src/App.tsx
git commit -m "refactor(app): migrate activeWorkspaceId to activeTab for workspace view switching"
```

---

## Phase 2：Terminal 流式

### Task 2.1: 改造 TerminalView 支持 activeTab 模式切换

**Files:**
- Modify: `src/components/ToolView/TerminalView.tsx`

- [ ] **Step 1: 读取 TerminalView 确认当前 WorkspaceTagBar 调用位置**

当前第 487-492 行调用 `<WorkspaceTagBar workspaces={workspaceList} ...>`。

- [ ] **Step 2: 替换 WorkspaceTagBar props**

```typescript
// 替换旧的 WorkspaceTagBar props
<WorkspaceTagBar
  activeTab={activeTab}
  onTabChange={useTerminalWorkspaceStore.getState().setActiveTab}
  workspaceTabs={workspaceTabs}
  workspaces={workspaceList}
  runningWorkspaces={runningWorkspaces}
/>
```

- [ ] **Step 3: 新增全局终端视图渲染（activeTab = 'global'）**

在 `{/* Task 5: UpperPane */}` 之前添加条件渲染：

```typescript
{activeTab === 'global' ? (
  // 全局合并视图（现有内容不变）
  <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
    {/* 现有 UpperPane 内容... */}
  </div>
) : (
  // 单工作区视图（展示该工作区的 Terminal + DAG）
  <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
    {/* 当前工作区的 MarkdownCard / LiveCard / summaryChunks */}
    {/* 使用 workspaceId 过滤当前工作区的数据 */}
  </div>
)}
```

- [ ] **Step 4: 引入 useGlobalTerminalStore**

在文件顶部 import 中添加：

```typescript
import { useGlobalTerminalStore } from '../../stores/useGlobalTerminalStore';
```

在组件内读取：

```typescript
const workspaceChunks = useGlobalTerminalStore(s => s.workspaceChunks);
const mergedOrder = useGlobalTerminalStore(s => s.getMergedContent());
```

- [ ] **Step 5: 全局视图渲染 mergedOrder**

在单工作区视图的 div 内，追加全局合并终端内容：

```typescript
{/* 全局合并终端输出（交错展示） */}
<div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)' }}>
  <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 6, fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
    全局终端输出
  </div>
  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
    {mergedOrder.map((item, i) => (
      <span key={i} data-workspace={item.workspaceId} style={{ color: getWorkspaceColor(item.workspaceId) }}>
        [{item.workspaceId}] {item.chunk}
      </span>
    ))}
  </div>
</div>
```

辅助函数：

```typescript
const WORKSPACE_COLORS = ['#4a8eff', '#2ecc71', '#f1c40f', '#e74c3c', '#9b59b6', '#1abc9c'];
function getWorkspaceColor(workspaceId: string): string {
  // 简单的 hash 颜色分配
  const hash = workspaceId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return WORKSPACE_COLORS[hash % WORKSPACE_COLORS.length];
}
```

- [ ] **Step 6: 验证 TypeScript**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 7: 提交**

```bash
git add src/components/ToolView/TerminalView.tsx
git commit -m "feat(terminal): TerminalView supports activeTab mode switch with global merge view"
```

---

## Phase 3：DAG 流式

### Task 3.1: Phase 3 技术选型决策（手动执行）

> ⚠️ **此 Task 需要人工决策**，在开始 Phase 3 前确认。

在终端中打开设计文档：

Run: `open /Users/ouguangji/2026/cc-web-ui/docs/superpowers/specs/2026-04-20-global-terminal-multi-workspace-design.md`

确认 DAG 容器节点的技术选型：

| 方案 | 描述 | 推荐场景 |
|------|------|----------|
| **A: ReactFlow parentId 子图** | 使用 `parentId` 将节点包裹在容器节点内 | 推荐 — 最简单，利用已有 ReactFlow API |
| B: 自定义节点类型 + 绝对定位 | 自己实现容器节点的渲染和折叠 | 需要自定义布局时 |
| C: dagre / ELK 布局库 | 使用外部布局算法计算坐标 | 需要复杂 DAG 布局时 |

---

### Task 3.2: 创建 WorkspaceContainerNode

**Files:**
- Create: `src/components/DAG/WorkspaceContainerNode.tsx`

- [ ] **Step 1: 实现容器节点组件（ReactFlow 自定义节点）**

```typescript
// src/components/DAG/WorkspaceContainerNode.tsx
import { Handle, Position, type NodeProps } from '@xyflow/react';

export const WORKSPACE_CONTAINER_NODE_TYPE = 'workspaceContainer';

export interface WorkspaceContainerData {
  workspaceId: string;
  workspaceName: string;
  collapsed?: boolean;
  status?: 'idle' | 'running' | 'completed' | 'error';
  onToggleCollapse?: (workspaceId: string) => void;
}

export function WorkspaceContainerNode({ data }: NodeProps) {
  const d = data as WorkspaceContainerData;

  return (
    <div style={{
      background: 'rgba(30, 30, 50, 0.9)',
      border: `1px solid ${getStatusColor(d.status)}`,
      borderRadius: 8,
      minWidth: 200,
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    }}>
      {/* 标题栏 */}
      <div style={{
        padding: '6px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        cursor: 'pointer',
      }}>
        <span style={{ color: getStatusColor(d.status), fontSize: 10 }}>{getStatusIcon(d.status)}</span>
        <span style={{ color: '#c0c0c0', fontSize: 12, fontWeight: 600, fontFamily: 'monospace' }}>
          {d.workspaceName}
        </span>
        <button
          onClick={() => d.onToggleCollapse?.(d.workspaceId)}
          style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 10 }}
        >
          {d.collapsed ? '▼' : '▲'}
        </button>
      </div>
      {/* 子节点区域（ReactFlow parentId 关联） */}
      {!d.collapsed && (
        <div style={{ padding: 8 }}>
          {/* 子节点由 ReactFlow 自动渲染 */}
        </div>
      )}
    </div>
  );
}

function getStatusColor(status?: string): string {
  switch (status) {
    case 'running': return '#2ecc71';
    case 'completed': return '#666';
    case 'error': return '#e74c3c';
    default: return '#4a8eff';
  }
}

function getStatusIcon(status?: string): string {
  switch (status) {
    case 'running': return '●';
    case 'completed': return '✓';
    case 'error': return '✗';
    default: return '○';
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add src/components/DAG/WorkspaceContainerNode.tsx
git commit -m "feat(dag): add WorkspaceContainerNode for workspace grouping in global DAG view"
```

---

### Task 3.3: 改造 DAGCanvas 支持容器节点和 activeTab 切换

**Files:**
- Modify: `src/components/DAG/DAGCanvas.tsx`

- [ ] **Step 1: 读取 DAGCanvas.tsx 完整内容确认 nodeTypes 注册位置**

找到 `nodeTypes` 定义处（约第 35-45 行）。

- [ ] **Step 2: 注册 WorkspaceContainerNode 类型**

```typescript
import WorkspaceContainerNode, { WORKSPACE_CONTAINER_NODE_TYPE } from './WorkspaceContainerNode';

// 在 nodeTypes 中添加：
[WORKSPACE_CONTAINER_NODE_TYPE]: WorkspaceContainerNode,
```

- [ ] **Step 3: 读取 activeTab 和 workspaceTabs**

在 DAGCanvas 组件中：

```typescript
import { useTerminalWorkspaceStore } from '../../stores/useTerminalWorkspaceStore';

const activeTab = useTerminalWorkspaceStore(s => s.activeTab);
const workspaceTabs = useTerminalWorkspaceStore(s => s.workspaceTabs);
```

- [ ] **Step 4: 全局视图模式：注入容器节点**

在计算 `positionedNodes` 之后、`overlapOptimizedNodes` 之前，如果 `activeTab === 'global'` 且 `workspaceTabs.length > 0`，则注入容器节点：

```typescript
const containerNodes: Node[] = workspaceTabs.map((tab, idx) => ({
  id: `container-${tab.id}`,
  type: WORKSPACE_CONTAINER_NODE_TYPE,
  position: { x: idx * 350, y: 0 },  // 泳道式横向排列
  data: {
    workspaceId: tab.id,
    workspaceName: tab.name,
    status: tab.status,
    collapsed: false,
    onToggleCollapse: (wsId: string) => {
      // 可选：折叠/展开容器
    },
  },
  // ReactFlow 子图：子节点通过 parentId 关联
  style: { width: 320, height: 600 },
}));

// 全局视图：容器节点 + 子节点（子节点的 parentId 设为容器 id）
const allNodes = activeTab === 'global'
  ? [...containerNodes, ...overlapOptimizedNodes.map(n => ({
      ...n,
      parentId: findContainerId(n.id, workspaceTabs),  // 查找归属容器
      extent: 'parent' as const,
    }))]
  : overlapOptimizedNodes;
```

辅助函数 `findContainerId`：

```typescript
// 简单的容器归属逻辑：根据节点 ID 前缀或 workspaceId 字段
function findContainerId(nodeId: string, tabs: WorkspaceTab[]): string | undefined {
  // 从 nodes 数据中读取 workspaceId（需确保 DAGNode 有此字段）
  const node = storeNodes.get(nodeId);
  if (node?.workspaceId) {
    return `container-${node.workspaceId}`;
  }
  return undefined;
}
```

> **注意**：如果现有 `DAGNode` 类型没有 `workspaceId` 字段，需要先在 Phase 0 路由 `terminalChunk` 时在 `useTaskStore` 中为节点打标，或在 Phase 4 由 `dispatchGlobalPrompts` 注入。

- [ ] **Step 5: 单工作区模式**

当 `activeTab !== 'global'` 时，直接渲染该工作区的节点（保持现有逻辑不变）：

```typescript
const workspaceNodes = activeTab !== 'global'
  ? [...storeNodes.values()].filter(n => (n as any).workspaceId === activeTab)
  : allNodes;
```

- [ ] **Step 6: 验证 TypeScript**

Run: `npx tsc --noEmit`
Expected: 无错误（可能需要类型断言处理 workspaceId 扩展）

- [ ] **Step 7: 提交**

```bash
git add src/components/DAG/DAGCanvas.tsx
git commit -m "feat(dag): DAGCanvas supports workspace container nodes and activeTab switching"
```

---

## Phase 4：状态联动

### Task 4.1: 改造 dispatchGlobalPrompts 集成标签状态

**Files:**
- Modify: `src/services/globalDispatchService.ts`

- [ ] **Step 1: 读取 globalDispatchService.ts 确认导入位置**

- [ ] **Step 2: 在 dispatchGlobalPrompts 中集成标签添加**

在 `dispatchForWorkspace` 调用之前：

```typescript
import { useTerminalWorkspaceStore } from '../stores/useTerminalWorkspaceStore';

export async function dispatchGlobalPrompts(input: DispatchGlobalPromptsInput) {
  // 1. 解析输入（保持现有逻辑）
  const { mode, prompts } = parsePromptInput(input.rawInput);
  const policy = resolveSessionPolicy({ createNewSession: input.createNewSession });

  // 2. 添加工作区标签（Phase 1 扩展的 store）
  useTerminalWorkspaceStore.getState().onExecutionStart(
    input.workspaces.map(ws => ({ id: ws.id, name: ws.name }))
  );

  // 3. 并行执行（保持现有逻辑）
  const workspaceResults: DispatchWorkspaceResult[] = await Promise.all(
    input.workspaces.map(workspace =>
      dispatchForWorkspace(workspace, prompts, input.createNewSession, input.executePrompt),
    ),
  );

  return {
    batchId: generateBatchId(),
    mode: mode as GlobalInputMode,
    policy: policy as GlobalSessionPolicy,
    workspaceResults,
  };
}
```

- [ ] **Step 3: 监听完成状态触发 onAllCompleted**

在 `dispatchForWorkspace` 的返回值中注入完成通知：

```typescript
// 在 dispatchForWorkspace 内部，runtimeResult 返回后：
// 通知标签状态更新
const tabStatus = runtimeResult.status === 'success' ? 'completed' : 'error';
useTerminalWorkspaceStore.getState().updateWorkspaceTab(workspace.id, tabStatus);
```

在 `dispatchGlobalPrompts` 顶层检查是否所有工作区都完成：

```typescript
// Promise.all 之后
const allCompleted = workspaceResults.every(r =>
  r.status === 'success' || r.status === 'failed'
);
if (allCompleted) {
  useTerminalWorkspaceStore.getState().onAllCompleted();
}
```

- [ ] **Step 4: 验证 TypeScript**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 5: 提交**

```bash
git add src/services/globalDispatchService.ts
git commit -m "feat(dispatch): integrate workspace tab state with dispatchGlobalPrompts lifecycle"
```

---

### Task 4.2: 端到端测试

**Files:**
- Create: `src/__tests__/globalDispatchWorkspaceTabs.test.ts`

- [ ] **Step 1: 编写 E2E 测试**

```typescript
// src/__tests__/globalDispatchWorkspaceTabs.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTerminalWorkspaceStore } from '../../src/stores/useTerminalWorkspaceStore';

describe('dispatch + workspace tabs integration', () => {
  beforeEach(() => {
    useTerminalWorkspaceStore.setState({
      activeTab: 'global',
      workspaceTabs: [],
    });
  });

  it('onExecutionStart adds all workspace tabs with running status', () => {
    const workspaces = [
      { id: 'ws-A', name: '工作区 A' },
      { id: 'ws-B', name: '工作区 B' },
    ];
    act(() => {
      useTerminalWorkspaceStore.getState().onExecutionStart(workspaces);
    });
    const tabs = useTerminalWorkspaceStore.getState().workspaceTabs;
    expect(tabs).toHaveLength(2);
    expect(tabs.map(t => t.status)).toEqual(['running', 'running']);
  });

  it('updateWorkspaceTab updates individual tab status', () => {
    const workspaces = [{ id: 'ws-A', name: 'A' }];
    act(() => {
      useTerminalWorkspaceStore.getState().onExecutionStart(workspaces);
      useTerminalWorkspaceStore.getState().updateWorkspaceTab('ws-A', 'completed');
    });
    const tabs = useTerminalWorkspaceStore.getState().workspaceTabs;
    expect(tabs[0].status).toBe('completed');
  });

  it('consecutive executions cancel previous removal timer', () => {
    vi.useFakeTimers();
    const workspaces1 = [{ id: 'ws-A', name: 'A' }];
    const workspaces2 = [{ id: 'ws-B', name: 'B' }];

    act(() => {
      useTerminalWorkspaceStore.getState().onExecutionStart(workspaces1);
      useTerminalWorkspaceStore.getState().onAllCompleted();
    });

    // 快速第二次执行
    act(() => {
      useTerminalWorkspaceStore.getState().onExecutionStart(workspaces2);
    });

    // 第一个 timer 标记的 batchId 已过期，5秒后不应清空
    act(() => { vi.advanceTimersByTime(5000); });

    const tabs = useTerminalWorkspaceStore.getState().workspaceTabs;
    expect(tabs.map(t => t.id)).toEqual(['ws-B']);

    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: 运行测试**

Run: `npx vitest run src/__tests__/globalDispatchWorkspaceTabs.test.ts`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add src/__tests__/globalDispatchWorkspaceTabs.test.ts
git commit -m "test: add E2E tests for workspace tabs lifecycle with race condition protection"
```

---

## 验收清单

完成所有 Task 后，验证以下场景：

- [ ] 全局终端发送 → 标签栏出现所有工作区标签（running 状态）
- [ ] 各工作区输出 → 全局视图交错展示（不同颜色区分工作区）
- [ ] 切换到单工作区标签 → Terminal/DAG 同时切换到该工作区视图
- [ ] 所有工作区完成 → 标签延迟 5 秒后自动消失
- [ ] DAG 全局视图 → 容器节点包裹各工作区节点，泳道式横向排列
- [ ] DAG 单工作区视图 → 无容器节点，直接渲染该工作区 DAG
- [ ] 连续触发 → 第二次触发的标签不受第一次的 setTimeout 影响
