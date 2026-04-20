# 全局终端多工作区流式展示设计

**日期：** 2026-04-20
**状态：** 设计中

---

## 1. 背景与目标

全局终端发送消息后，需要触发所有已配置的工作区并行执行，并将各工作区的流式输出同时展示到 Terminal 和 DAG 执行图中。

- Terminal 与 DAG 共用同一视图切换（选中哪个工作区就显示哪个）
- 支持全局合并视图和各工作区独立视图的切换
- 流式输出按 token 粒度交错展示

---

## 2. 交互模式

| 决策点 | 选择 |
|--------|------|
| 整体模式 | 混合模式 — 工作区独立窗口 + 全局汇总视图 |
| DAG 视图切换 | 可切换 — 全局合并 DAG ↔ 单工作区 DAG |
| Terminal 跟随 | Terminal 与 DAG 共用同一视图切换 |
| 触发方式 | 自动并行 — 发送后立即触发所有工作区 |
| 冲突处理 | 队列等待 — 工作区运行中时新消息排队 |
| UI 结构 | 单窗口标签切换 — 全局 \| 工作区A \| 工作区B... |
| 标签动态性 | 动态标签 — 执行时才添加工作区标签，执行完成后消失 |
| 全局 DAG 布局 | 容器节点包裹 — 每个工作区节点用容器节点包裹 |
| 流式粒度 | 按 token 交错 — 字符级打字机效果 |

---

## 3. 架构设计

### 3.1 组件结构

```
App
  └── WorkspaceView (主视图容器)
        ├── WorkspaceTabBar          # 标签栏：全局 | 工作区A(运行中) | 工作区B | ...
        │     ├── GlobalTab (固定)
        │     └── DynamicWorkspaceTabs (执行时添加，完成后移除)
        │
        ├── GlobalView
        │     ├── TerminalView      # 全局终端，流式交错展示所有工作区输出
        │     └── DAGCanvas         # 全局 DAG，容器节点包裹各工作区
        │
        └── WorkspaceDetailView     # 单工作区视图
              ├── TerminalView       # 该工作区的流式终端输出
              └── DAGCanvas         # 该工作区的独立 DAG
```

### 3.2 数据流

```
User Input (Global Terminal)
    │
    ▼
dispatchGlobalPrompts()
    │
    ├─► Promise.all(workspaces.map(executeInWorkspace))
    │       │
    │       ├─► Workspace A ──► WebSocket.send() ──► terminalChunk / summary_chunk
    │       ├─► Workspace B ──► WebSocket.send() ──► terminalChunk / summary_chunk
    │       └─► Workspace C ──► WebSocket.send() ──► terminalChunk / summary_chunk
    │
    ▼
useMultiDispatchStore.batchResult[]   # 各工作区批量结果
    │
    ▼
TerminalView / DAGCanvas             # 终端和 DAG 同步展示
    │
    ▼
WorkspaceTabBar                      # 动态增删工作区标签
```

---

## 4. 核心模块设计

### 4.1 WorkspaceTabBar（标签栏）

**职责：** 管理视图切换的标签页

**状态：**
```typescript
interface WorkspaceTabBarState {
  activeTab: 'global' | string;       // 当前激活的 tab
  workspaceTabs: WorkspaceTab[];       // 动态工作区 tab
}

interface WorkspaceTab {
  id: string;                          // workspace id
  name: string;                        // 显示名称
  status: 'idle' | 'running' | 'completed' | 'error';
  addedAt: number;                     // 用于排序
}
```

**行为：**
- 固定显示"全局"标签
- 执行开始时动态添加工作区标签（按添加时间排序）
- 执行完成后延迟 N 秒移除标签（给用户看完成状态）
- 标签显示运行状态图标（idle / spinner / check / x）

**触发时机：**
- `dispatchGlobalPrompts()` 调用时：添加所有目标工作区标签
- `batchResult` 更新且所有工作区完成时：启动延迟移除计时器
- 用户主动点击标签时：切换 `activeTab`

---

### 4.2 TerminalView（终端视图）

**职责：** 接收并展示各工作区的流式输出

**两种模式：**

**模式 A：全局合并视图（activeTab = 'global'）**
```typescript
// 全局视图状态
interface GlobalTerminalState {
  // key: workspaceId, value: 该工作区累积的 chunks
  workspaceChunks: Record<string, string[]>;
  // 当前"活跃"工作区（最近有输出那个，用于决定光标位置）
  activeWorkspace: string | null;
}
```

**流式交错策略（按 token）：**
```typescript
// useTaskStore 或新的 useGlobalTerminalStore
interface GlobalTerminalStore {
  workspaceChunks: Record<string, string>;

  // 每个工作区的 token 到达时调用
  appendChunk(workspaceId: string, token: string): void;

  // TerminalView 消费
  getInterleavedTokens(): Generator<{workspaceId, token}, void, unknown>;
}
```

交错规则：
1. 按时间顺序接收各工作区的 token
2. 每个 token 带上工作区 ID 前缀（如 `<span data-ws="ws-A">token</span>`）
3. Terminal 根据工作区 ID 渲染不同颜色
4. `pendingInputsRef` 保持队列等待逻辑（不改变现有行为）

**模式 B：单工作区视图（activeTab = workspaceId）**
- 直接使用现有 TerminalView 逻辑，展示该工作区的 `terminalChunks`

---

### 4.3 DAGCanvas（DAG 画布）

**职责：** 渲染 DAG 执行图，支持全局合并和单工作区两种模式

**全局合并模式（activeTab = 'global'）：**
```typescript
// 为每个工作区创建一个容器节点（Container Node）
const globalFlowNodes: FlowNode[] = workspaces.map(ws => ({
  id: `container-${ws.id}`,
  type: 'workspaceContainer',
  data: { workspaceId: ws.id, workspaceName: ws.name },
  position: { x: 0, y: 0 },  // 由 DAGCanvas 布局算法决定
}));

// 各工作区的 DAG 节点作为容器节点的子节点
// 用子图（ReactFlow subflow）或绝对定位嵌套
```

**容器节点设计：**
- 圆角矩形，带工作区名称标题
- 背景色与 Terminal 标签颜色一致
- 包含该工作区所有 DAG 节点
- 可折叠/展开

**单工作区模式（activeTab = workspaceId）：**
- 直接渲染该工作区的 `useTaskStore.nodes`
- 无容器节点包裹

**布局算法（全局模式）：**
```
Workspace A Container ──► (x=0,   y=0)   ──► 节点纵向排列
Workspace B Container ──► (x=300, y=0)   ──► 节点纵向排列
Workspace C Container ──► (x=600, y=0)   ──► 节点纵向排列
```
- 各工作区横向排列（泳道式）
- 泳道宽度自适应内容
- 泳道间距固定（如 80px）

---

### 4.4 dispatchGlobalPrompts 改造

**现有逻辑（保持不变）：**
```typescript
// globalDispatchService.ts
const results = await Promise.all(
  workspaces.map(ws => dispatchForWorkspace(ws, prompts))
);
```

**新增 Hook：**
```typescript
// useGlobalWorkspaceTabs.ts
const useGlobalWorkspaceTabs = create<GlobalWorkspaceTabsState>((set, get) => ({
  activeTab: 'global',
  workspaceTabs: [],

  // 开始执行时：添加所有工作区标签
  onExecutionStart(workspaces: Workspace[]): void {
    set(state => ({
      workspaceTabs: workspaces.map(ws => ({
        id: ws.id,
        name: ws.name,
        status: 'running' as const,
        addedAt: Date.now(),
      })),
    }));
  },

  // 每个工作区状态变化时更新
  updateWorkspaceStatus(workspaceId: string, status: WorkspaceTab['status']): void {
    set(state => ({
      workspaceTabs: state.workspaceTabs.map(tab =>
        tab.id === workspaceId ? { ...tab, status } : tab
      ),
    }));
  },

  // 所有工作区完成时：延迟移除标签
  onAllCompleted(): void {
    setTimeout(() => {
      set({ workspaceTabs: [] });
    }, 5000);  // 5 秒后自动移除
  },
}));
```

---

## 5. 数据流详细设计

### 5.1 流式输出路由

```
WebSocket.onmessage
    │
    ├── type: 'terminalChunk'
    │       │
    │       ├─► TerminalView 全局视图：appendChunk(workspaceId, token)
    │       └─► TerminalView 单工作区视图：appendChunk(token)  [现有逻辑]
    │
    ├── type: 'summary_chunk'
    │       │
    │       ├─► DAGCanvas 节点更新
    │       └─► TerminalView summary 区域更新
    │
    └── type: 'streamEnd' / 'session_end'
            │
            ├─► useMultiDispatchStore.updateBatchResult()
            ├─► useGlobalWorkspaceTabs.updateWorkspaceStatus()
            └─► 触发 onAllCompleted 检查
```

### 5.2 多工作区 token 交错

```typescript
// GlobalTerminalStore.ts
class GlobalTerminalStore {
  // 每个工作区的 token buffer
  private buffers: Map<string, string[]> = new Map();

  // 当前光标工作区
  private activeWorkspace: string | null = null;

  appendChunk(workspaceId: string, token: string): void {
    // 1. 累积到对应 buffer
    const buf = this.buffers.get(workspaceId) ?? [];
    buf.push(token);
    this.buffers.set(workspaceId, buf);

    // 2. 标记为活跃（用于光标位置）
    this.activeWorkspace = workspaceId;

    // 3. 触发 UI 更新
    this.publish({ type: 'chunk', workspaceId, token });
  }

  // TerminalView 消费：按接收顺序 yield token
  *streamTokens(): Generator<{workspaceId: string, token: string}, void, unknown> {
    while (true) {
      // yield 所有非空 buffer 中的下一个 token
      for (const [wsId, buf] of this.buffers) {
        if (buf.length > 0) {
          yield { workspaceId: wsId, token: buf.shift()! };
        }
      }
      // 等待下一个 chunk 事件（通过事件循环）
      yield* this.waitForNextChunk();
    }
  }
}
```

---

## 6. UI 组件清单

| 组件 | 文件 | 改动类型 |
|------|------|----------|
| WorkspaceTabBar | `src/components/Workspace/WorkspaceTabBar.tsx` | 新增 |
| GlobalTerminalView | `src/components/ToolView/GlobalTerminalView.tsx` | 新增 |
| GlobalDAGCanvas | `src/components/DAG/GlobalDAGCanvas.tsx` | 新增 |
| WorkspaceContainerNode | `src/components/DAG/WorkspaceContainerNode.tsx` | 新增 |
| useGlobalWorkspaceTabs | `src/stores/useGlobalWorkspaceTabs.ts` | 新增 |
| useGlobalTerminalStore | `src/stores/useGlobalTerminalStore.ts` | 新增 |
| TerminalView | `src/components/ToolView/TerminalView.tsx` | 改造 |
| DAGCanvas | `src/components/DAG/DAGCanvas.tsx` | 改造 |
| App.tsx | `src/App.tsx` | 改造 |

---

## 7. 实现顺序

### Phase 1: 基础结构
1. 实现 `WorkspaceTabBar` 组件
2. 实现 `useGlobalWorkspaceTabs` store
3. 改造 `App.tsx` 集成标签栏
4. 实现 `WorkspaceDetailView` 容器

### Phase 2: Terminal 流式
5. 实现 `useGlobalTerminalStore`（token 交错）
6. 改造 `TerminalView` 支持全局/单工作区模式
7. 集成到标签栏切换逻辑

### Phase 3: DAG 流式
8. 实现 `WorkspaceContainerNode`
9. 实现 `GlobalDAGCanvas`
10. 改造 `DAGCanvas` 支持单工作区模式
11. 集成到标签栏切换逻辑

### Phase 4: 状态联动
12. 改造 `dispatchGlobalPrompts` 触发标签添加
13. 集成 batchResult 完成状态 → 标签移除
14. 端到端测试

---

## 8. 风险与边界情况

| 风险 | 处理方式 |
|------|----------|
| 大量工作区标签溢出 | 横向滚动 + 折叠按钮 |
| token 交错性能问题 | 使用 requestAnimationFrame 节流；考虑 Web Worker |
| 工作区执行时间差异大 | 容器节点可折叠；长等待工作区灰色显示 |
| WebSocket 断开重连 | 保持 workspaceId 上下文；重连后继续追加 |
| 极端情况：同时 20+ 工作区 | DAG 泳道自动缩放；Terminal 分屏或虚拟滚动 |
