# 全局终端多工作区流式展示设计

**日期：** 2026-04-20
**状态：** v2（修订版，根据 code-reviewer + Karpathy 评审修订）
**版本说明：** 新增 Phase 0（chunk 路由基础设施）、修正 Phase 1（复用已有组件）、修复竞态 bug、统一类型定义、补充现状分析

---

## 1. 背景与目标

全局终端发送消息后，需要触发所有已配置的工作区并行执行，并将各工作区的流式输出同时展示到 Terminal 和 DAG 执行图中。

- Terminal 与 DAG 共用同一视图切换（选中哪个工作区就显示哪个）
- 支持全局合并视图和各工作区独立视图的切换
- 流式输出按消息块（`terminalChunk`）粒度交错展示
- 动态标签页管理：执行时添加工作区标签，完成后自动移除

---

## 2. 交互模式

| 决策点 | 选择 |
|--------|------|
| 整体模式 | 混合模式 — 工作区独立窗口 + 全局汇总视图 |
| DAG 视图切换 | 可切换 — 全局合并 DAG ↔ 单工作区 DAG |
| Terminal 跟随 | Terminal 与 DAG 共用同一视图切换 |
| 触发方式 | 自动并行 — 发送后立即触发所有工作区 |
| 冲突处理 | 队列等待 — 工作区运行中时新消息排队（单个工作区层面） |
| UI 结构 | 单窗口标签切换 — 全局 \| 工作区A \| 工作区B... |
| 标签动态性 | 动态标签 — 执行时才添加工作区标签，执行完成后消失 |
| 全局 DAG 布局 | 容器节点包裹 — 每个工作区节点用容器节点包裹 |
| 流式粒度 | 按消息块交错（`terminalChunk` 为单位） |

> ⚠️ **评审修订**：原设计为"token 级交错"，但 `dispatchExecutePromptAdapter` 目前不转发中间 token。已降级为"消息块级交错"，以 `terminalChunk` 为最小交错单位，性能更优且可落地。如后续需要 token 级，再扩展。

---

## 3. 现状分析（已有组件）

本设计**复用或改造**以下已有组件，**不重复新增**：

| 已有组件 | 规划对应 | 处理方式 |
|----------|----------|----------|
| `src/components/ToolView/WorkspaceTagBar.tsx` | WorkspaceTabBar | 改造：增强状态管理和动态标签 |
| `src/stores/useTerminalWorkspaceStore.ts` | useGlobalWorkspaceTabs | 改造：扩展 `workspaceTabs` 状态 |
| `src/components/ToolView/GlobalSummaryPanel.tsx` | GlobalSummaryPanel | 保留：全局汇总视图 |
| `src/stores/useMultiDispatchStore.ts` | useMultiDispatchStore | 保留：batchResult 存储 |
| `src/services/globalDispatchService.ts` | dispatchGlobalPrompts | 改造：集成标签添加/移除 |
| `src/components/ToolView/TerminalView.tsx` | TerminalView | 改造：支持全局/单工作区模式 |
| `src/components/DAG/DAGCanvas.tsx` | DAGCanvas | 改造：支持容器节点模式 |

---

## 4. 架构设计

### 4.1 组件结构

```
App
  └── WorkspaceView (主视图容器)
        ├── WorkspaceTagBar (改造)     # 标签栏：全局 | 工作区A(运行中) | 工作区B | ...
        │     ├── GlobalTab (固定)
        │     └── DynamicWorkspaceTabs (执行时添加，完成后移除)
        │
        ├── GlobalView (改造)
        │     ├── TerminalView (改造)  # 全局终端，消息块交错展示所有工作区输出
        │     └── DAGCanvas (改造)     # 全局 DAG，容器节点包裹各工作区
        │
        └── WorkspaceDetailView (新增容器)
              ├── TerminalView (改造)  # 该工作区的流式终端输出
              └── DAGCanvas (改造)     # 该工作区的独立 DAG
```

### 4.2 数据流

```
User Input (Global Terminal)
    │
    ▼
dispatchGlobalPrompts() ──并行──► 各 Workspace
    │                              │
    │                              ├─► terminalChunk ──► useGlobalTerminalStore
    │                              │                           │
    │                              │                     消息块级交错累积
    │                              │                           │
    │                              │                    ┌──────┴──────┐
    │                              ├─► summary_chunk ──► DAGCanvas 更新
    │                              │                           │
    │                              └─► streamEnd ─────────────┘
    │                                                 │
    ▼                                                 ▼
useMultiDispatchStore.batchResult[]         WorkspaceTagBar (动态增删)
```

---

## 5. 核心模块设计

### 5.1 WorkspaceTagBar（标签栏）— 改造已有

**现状：** `src/components/ToolView/WorkspaceTagBar.tsx` 已存在，支持静态标签展示。

**改造范围：**
- 增加 `workspaceTabs` 动态状态（`id`, `name`, `status`, `addedAt`）
- 增加运行时状态管理：`running` / `completed` / `error` / `idle`
- 集成 `useGlobalWorkspaceTabs` store（见 5.4）

**竞态修复（Critical Bug）：**
```typescript
// useGlobalWorkspaceTabs.ts — 修复 setTimeout 竞态
class GlobalWorkspaceTabsStore {
  private removalTimer: ReturnType<typeof setTimeout> | null = null;
  private executionBatchId = 0;  // 批次号，用于区分不同执行

  onExecutionStart(workspaces: Workspace[]): void {
    // 1. 取消待执行的移除计时器（防止误清除新标签）
    if (this.removalTimer !== null) {
      clearTimeout(this.removalTimer);
      this.removalTimer = null;
    }

    // 2. 使用批次号标记本次执行（覆盖式设值，符合业务语义：新分发启动时替换旧标签）
    this.executionBatchId++;
    const batchId = this.executionBatchId;

    set(state => ({
      workspaceTabs: workspaces.map(ws => ({
        id: ws.id,
        name: ws.name,
        status: 'running' as const,
        addedAt: Date.now(),
        batchId,  // 关联批次
      })),
    }));
  }

  onAllCompleted(): void {
    // 延迟移除：仅当当前批次与最后一次执行的批次相同时才移除
    const batchId = this.executionBatchId;
    this.removalTimer = setTimeout(() => {
      get(); // 获取最新状态
      if (this.executionBatchId === batchId) {
        set({ workspaceTabs: [] });
      }
    }, 5000);
  }
}
```

---

### 5.2 TerminalView（终端视图）— 改造已有

**职责：** 接收并展示各工作区的流式输出

**两种模式：**

**模式 A：全局合并视图（activeTab = 'global'）**
```typescript
// useGlobalTerminalStore.ts — 消息块级交错
interface GlobalTerminalStore {
  // key: workspaceId, value: 该工作区累积的消息块数组（每块为完整字符串）
  workspaceChunks: Record<string, string[]>;

  // 每个工作区的 terminalChunk 到达时调用
  appendChunk(workspaceId: string, chunk: string): void;

  // 全局合并视图的渲染数据：按时间顺序交错
  getMergedContent(): Array<{workspaceId: string, chunk: string}>;
}
```

**消息块级交错规则：**
1. 每收到一个 `terminalChunk`，追加到对应 `workspaceChunks[workspaceId]`
2. 全局视图按接收顺序交替渲染各工作区的最新 chunk
3. 每个 chunk 带上工作区 ID 样式（颜色/前缀）
4. 不改变 `pendingInputsRef` 的队列等待逻辑

> ⚠️ **简化说明**：相比 token 级 Generator 方案，消息块级方案更简单、性能更好，且 `terminalChunk` 本身已经是合理的最小展示单位。如未来需要 token 级体验，可在此基础上扩展。

**模式 B：单工作区视图（activeTab = workspaceId）**
- 直接使用现有 TerminalView 逻辑，展示该工作区的 `terminalChunks`

**与 WorkspaceTagBar 联动：**
```typescript
// TerminalView 内部
const activeTab = useGlobalWorkspaceTabs(s => s.activeTab);
const workspaceChunks = useGlobalTerminalStore(s => s.workspaceChunks);

const displayContent = activeTab === 'global'
  ? workspaceChunks  // 全局视图
  : { [activeTab]: workspaceChunks[activeTab] };  // 单工作区视图
```

---

### 5.3 DAGCanvas（DAG 画布）— 改造已有

**职责：** 渲染 DAG 执行图，支持全局合并和单工作区两种模式

**全局合并模式（activeTab = 'global'）：**
```typescript
// 每个工作区创建一个容器节点（WorkspaceContainerNode）
const globalFlowNodes: FlowNode[] = workspaces.map(ws => ({
  id: `container-${ws.id}`,
  type: 'workspaceContainer',
  data: { workspaceId: ws.id, workspaceName: ws.name },
  position: { x: 0, y: 0 },  // 由布局算法决定
}));
```

**容器节点设计（WorkspaceContainerNode）：**
- 圆角矩形，带工作区名称标题
- 背景色与 WorkspaceTagBar 标签颜色一致
- 包含该工作区所有 DAG 节点（作为子节点或使用 ReactFlow `parentId`）
- 可折叠/展开

**技术选型（待 Phase 3 前确认）：**
- 方案 A：ReactFlow 原生 `parentId` 子图（推荐，最简单）
- 方案 B：自定义节点类型 + 绝对定位
- 方案 C：dagre / ELK 布局算法（成本较高，Phase 3 评估）

> ⚠️ **评审建议**：Phase 3 开始前补充"DAG 容器节点技术选型"决策，评估 ReactFlow 原生子图 vs 自定义节点 vs 外部布局库。

**单工作区模式（activeTab = workspaceId）：**
- 直接渲染该工作区的 `useTaskStore.nodes`
- 无容器节点包裹

---

### 5.4 dispatchGlobalPrompts 改造

**现有逻辑保持不变：**
```typescript
// globalDispatchService.ts — 保持 Promise.all 并行
const results = await Promise.all(
  workspaces.map(ws => dispatchForWorkspace(ws, prompts))
);
```

**新增集成点：**
```typescript
// globalDispatchService.ts
import { useGlobalWorkspaceTabs } from '@/stores/useGlobalWorkspaceTabs';
import { useGlobalTerminalStore } from '@/stores/useGlobalTerminalStore';

async function dispatchGlobalPrompts(...) {
  // 1. 添加工作区标签（改造已有 WorkspaceTagBar）
  useGlobalWorkspaceTabs.getState().onExecutionStart(workspaces);

  // 2. 开始执行
  const results = await Promise.all(
    workspaces.map(ws => dispatchForWorkspace(ws, prompts))
  );

  // 3. 监听完成状态
  //    - 每个 ws 的 dispatchForWorkspace 在 streamEnd 时 resolve
  //    - useMultiDispatchStore 收集 batchResult
  //    - batchResult 全完成时触发 onAllCompleted()

  return results;
}
```

**关键链路（评审 Critical 问题）：**
```
dispatchForWorkspace()
    │
    ├─► streamEnd resolve ──► useMultiDispatchStore.batchResult 更新
    │                                            │
    │                              check: 所有 workspace 都完成了？
    │                                            │
    │                              是 ──► useGlobalWorkspaceTabs.onAllCompleted()
    │
    └─► terminalChunk ──► useGlobalTerminalStore.appendChunk(wsId, chunk)
```

---

## 6. Phase 0：WebSocket Chunk 路由基础设施（新增）

> ⚠️ **评审 Critical 问题**：这是所有后续阶段的前置依赖。原设计缺失此项，导致 Phase 2-3 无法落地。

### 6.1 目标

将 `dispatchExecutePromptAdapter` 中"静默等待 streamEnd"的模式，改造为"实时推送 `terminalChunk` 到 Zustand store"。

### 6.2 现有问题

```typescript
// dispatchExecutePromptAdapter.ts — 现有逻辑（不转发中间 chunk）
return new Promise((resolve, reject) => {
  const handler = (event: ParsedMessage) => {
    if (event.type === 'streamEnd') resolve(event);
    if (event.type === 'error' || event.type === 'session_end') reject(event);
    // ❌ terminalChunk 在这里被忽略了（ws.onmessage 中处理，但 handler 只接收特定事件）
  };
});
```

### 6.3 改造方案

```typescript
// dispatchExecutePromptAdapter.ts — 改造后
return new Promise((resolve, reject) => {
  // 注册 workspaceId 对应的 chunk 处理器
  const workspaceId = sessionId;  // 或从参数传入

  const chunkHandler = (chunk: string) => {
    useGlobalTerminalStore.getState().appendChunk(workspaceId, chunk);
  };

  // 在 ws.onmessage 中，通过 workspaceId 路由 terminalChunk
  // 具体实现：在 useWebSocket.ts 的 onmessage 中增加 workspaceId 上下文
  // Phase 0 只需建立路由机制，不改变 TerminalView 渲染逻辑
});

// useWebSocket.ts — onmessage 改造
ws.onmessage = (event) => {
  const parsed = JSON.parse(event.data);

  if (parsed.type === 'terminalChunk') {
    const workspaceId = parsed.sessionId ?? getCurrentSessionId();
    // ✅ 路由到全局 store
    useGlobalTerminalStore.getState().appendChunk(workspaceId, parsed.text);
  }
  // ... 其他类型保持不变
};
```

### 6.4 验收标准

- [ ] `terminalChunk` 消息能通过 `useGlobalTerminalStore.appendChunk()` 存储
- [ ] `useGlobalTerminalStore.getMergedContent()` 返回正确交错顺序的内容
- [ ] 现有 `TerminalView` 渲染不受影响（单工作区模式）
- [ ] 单元测试覆盖 `appendChunk` 和 `getMergedContent`

---

## 7. 实现顺序

### Phase 0: Chunk 路由基础设施
1. 分析现有 `dispatchExecutePromptAdapter` 和 `useWebSocket.ts` 的消息路由
2. 在 `useWebSocket.ts` 的 `onmessage` 中建立 workspaceId 上下文
3. 实现 `useGlobalTerminalStore`（消息块级交错）
4. 编写单元测试验证交错逻辑

### Phase 1: 基础结构（改造已有组件）
1. 改造 `useTerminalWorkspaceStore.ts` → `useGlobalWorkspaceTabs`（增加 workspaceTabs 状态、竞态安全的 onAllCompleted）
2. 改造 `WorkspaceTagBar.tsx`（集成动态标签、状态图标）
3. 改造 `App.tsx` 集成 WorkspaceView 容器（GlobalView / WorkspaceDetailView）
4. 实现 `WorkspaceDetailView` 容器组件
5. 端到端测试：标签动态添加/移除

### Phase 2: Terminal 流式
1. Phase 0 建立的 chunk 路由已可用
2. 改造 `TerminalView` 支持 `activeTab` 模式切换（全局视图 / 单工作区视图）
3. 集成 `useGlobalTerminalStore.getMergedContent()` 到全局视图渲染
4. 端到端测试：消息块级交错展示

### Phase 3: DAG 流式
1. **Phase 3 开始前**：确认 DAG 容器节点技术选型（ReactFlow 子图 vs 自定义节点）
2. 实现 `WorkspaceContainerNode` 组件
3. 改造 `DAGCanvas` 支持容器节点模式（全局视图）
4. 改造 `DAGCanvas` 支持单工作区模式（`activeTab` 切换）
5. 端到端测试：容器节点布局和切换

### Phase 4: 状态联动
1. 改造 `dispatchGlobalPrompts` 集成 `onExecutionStart`
2. 集成 `batchResult` 完成状态 → `onAllCompleted` 触发
3. 端到端测试：完整的多工作区并行分发流程

---

## 8. 数据流详细设计

### 8.1 terminalChunk 路由（Phase 0）

```
useWebSocket.ts — ws.onmessage
    │
    ├── type: 'terminalChunk'
    │       │
    │       ├─► sessionId / workspaceId 上下文
    │       │
    │       └─► useGlobalTerminalStore.appendChunk(workspaceId, text)
    │               │
    │               ├─► workspaceChunks[workspaceId].push(text)
    │               └─► trigger re-render
    │
    ├── type: 'summary_chunk'
    │       │
    │       └─► useTaskStore.handleEvent({ type: 'summary_chunk', ... })
    │               │
    │               ├─► DAGCanvas 节点更新
    │               └─► summaryChunks[] 追加
    │
    └── type: 'streamEnd' / 'session_end' / 'error'
            │
            ├─► resolve / reject dispatchExecutePromptAdapter Promise
            ├─► useMultiDispatchStore.updateBatchResult()
            │       │
            │       └─► check: 所有 workspace 都完成？
            │               │
            │               └─► 是 ──► useGlobalWorkspaceTabs.onAllCompleted()
            │
            └─► useGlobalWorkspaceTabs.updateWorkspaceStatus(workspaceId, status)
```

### 8.2 summary_chunk 全局视图展示规则（补充）

| 视图模式 | summary_chunk 行为 |
|----------|-------------------|
| 全局视图（activeTab = 'global'） | 追加到对应工作区容器内的 DAG 节点；Terminal 不单独显示 |
| 单工作区视图（activeTab = workspaceId） | DAG 节点更新 + TerminalView summary 区域显示 |

---

## 9. 风险与边界情况（更新）

| 风险 | 处理方式 |
|------|----------|
| ~~token 交错性能问题~~（已降级为消息块） | 不需要 Web Worker，先以消息块为单位 |
| 大量工作区标签溢出 | WorkspaceTagBar 横向滚动 + 折叠按钮 |
| 工作区执行时间差异大 | 容器节点可折叠；长等待工作区灰色显示 |
| WebSocket 断开重连 | 保持 workspaceId 上下文；重连后继续追加 |
| 极端情况：同时 20+ 工作区 | DAG 泳道自动缩放；Terminal 虚拟滚动 |
| DAG 容器节点技术风险 | Phase 3 前补充技术选型评估 |
| 连续触发的标签竞态 | ✅ 已通过 `executionBatchId` + `clearTimeout` 修复 |
| 已有组件改造冲突 | ✅ 已在第 3 节明确改造范围 |

---

## 10. 测试策略

| 阶段 | 测试内容 |
|------|----------|
| Phase 0 | `useGlobalTerminalStore` 单元测试：appendChunk、getMergedContent、并发追加 |
| Phase 1 | WorkspaceTagBar 交互测试：动态添加/移除、状态切换 |
| Phase 2 | TerminalView 集成测试：消息块级交错渲染、activeTab 切换 |
| Phase 3 | DAGCanvas 集成测试：容器节点布局、折叠/展开、切换 |
| Phase 4 | E2E 测试：完整全局分发流程 |

---

## 附录：评审修复记录

| 问题 | 修复方式 |
|------|----------|
| Token 级交错不可行 | 降级为消息块级（terminalChunk 为单位） |
| Phase 0 缺失 | 新增 Phase 0：WebSocket chunk 路由基础设施 |
| onAllCompleted 竞态 | 使用 `executionBatchId` + `clearTimeout` 修复 |
| workspaceChunks 类型矛盾 | 统一为 `Record<string, string[]>`（数组，每元素为一个 chunk） |
| 已有组件被忽视 | 新增第 3 节"现状分析"，明确改造范围 |
| summary_chunk 全局视图行为缺失 | 新增 8.2 节，明确两种视图的展示规则 |
| Phase 3 DAG 技术选型缺失 | 在 Phase 3 前添加技术选型决策点 |
| 测试策略缺失 | 新增第 10 节测试策略 |
