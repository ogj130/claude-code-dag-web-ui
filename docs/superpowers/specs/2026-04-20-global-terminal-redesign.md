# 全局终端交互重构设计

**日期**: 2026-04-20
**状态**: 已批准
**范围**: TerminalView 交互重构 + 全局终端与默认终端协同

---

## 1. 背景与目标

当前全局终端（GlobalTerminalModal）作为独立 Modal 存在，存在以下问题：

1. **同步阻塞**：发送后 UI 等待全部执行完成才能展示结果，用户无法实时感知各工作区状态
2. **与默认终端割裂**：全局终端触发后，结果无法与默认终端的实时输出流协同
3. **A4 设计的对比分析无法衔接**：已完成设计的 A4（多维度对比分析）需要一个稳定的执行结果汇聚点

**目标**：

1. TerminalView 拆分为上下两栏：上为当前工作区实时输出，下为全局分发汇总卡片
2. TerminalView 顶部增加 workspace tag 栏，支持切换当前对话的工作区上下文
3. GlobalTerminalModal 保持独立，作为全量并行分发的触发入口
4. 全局分发完成后，底部卡片区自动展开；全部执行完后自动触发 AI 分析（GlobalAgentReportModal）

---

## 2. 核心设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| Terminal 分栏 | 上下固定比例 | 上部为主要工作区输出，下部为汇总卡片，符合信息层次 |
| 全局分发触发入口 | GlobalTerminalModal 保持独立 | 独立入口更清晰，避免单一入口的认知负担 |
| 底部卡片激活时机 | 仅在「全局终端」触发时分发时展开 | 避免干扰正常的单工作区对话 |
| 底部卡片关闭 | 支持手动收起/关闭 | 用户自主控制，不强制展示 |
| AI 分析触发 | 全部执行完成后自动触发 | 与 A4 设计衔接，无需额外操作 |
| 单工作区 prompt 发送 | 只发给当前 tag 选中的工作区 | 与现有行为一致 |

---

## 3. 架构设计

### 3.1 整体数据流

```
┌─ Toolbar ────────────────────────────────────────────────┐
│  [Terminal] [DAG] │ [全局终端] │ ...
└─────────────────────────────────────────────────────────┘

┌─ App Main ─────────────────────────────────────────────────┐
│ ┌─ DAGCanvas ─┐ ┌─ TerminalView ──────────────────────┐ │
│ │              │ │  [ws-A] [ws-B] [ws-C] ← tag 切换栏  │ │
│ │              │ ├────────────────────────────────────┤ │
│ │              │ │  上：当前工作区实时输出              │ │
│ │              │ ├────────────────────────────────────┤ │
│ │              │ │  [收起] 全局分发汇总（条件显示）   │ │
│ │              │ │  ┌──────┐ ┌──────┐ ┌──────┐     │ │
│ │              │ │  │ ws-A │ │ ws-B │ │ ws-C │     │ │
│ │              │ │  │  ✓   │ │  ◐   │ │  ✗   │     │ │
│ │              │ │  └──────┘ └──────┘ └──────┘     │ │
│ │              │ │  [查看全局分析]（完成后显示）      │ │
│ │              │ └────────────────────────────────────┘ │
│ └──────────────┘ └──────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘
         ▲
         │ 发送 prompt
         │
┌─ GlobalTerminalModal ─────────────────────────────────┐
│  prompt 输入 + 全局分发按钮                             │
│  点击后：disptachGlobalPrompts() 并关闭 Modal           │
└───────────────────────────────────────────────────────┘
         │
         │ 并行执行
         ▼
  各工作区 WebSocket 连接各自接收流式输出
         │
         ▼
  useMultiDispatchStore 更新 batchResult
         │
         ▼
  TerminalView 底部汇总 panel 展开 + 卡片实时更新
         │
         ▼
  全部完成后 → GlobalAgentReportModal 自动打开
```

### 3.2 关键状态变化

| 状态 | 触发条件 | 影响 |
|------|----------|------|
| `activeWorkspaceTag` | 用户切换 tag | TerminalView 上部切换为对应工作区上下文 |
| `isGlobalSummaryExpanded` | GlobalTerminalModal 触发分发 | 底部 panel 展开 |
| `dispatchBatchResult` | 各工作区执行完成 | 底部卡片更新状态 |
| `allCompleted` | 所有工作区均完成 | 触发 GlobalAgentReportModal + 显示「查看全局分析」按钮 |

---

## 4. 组件设计

### 4.1 TerminalView 重构

**文件**: `src/components/ToolView/TerminalView.tsx`

**新增子组件**:

- `WorkspaceTagBar` - 工作区 tag 切换栏（位于终端顶部）
- `GlobalSummaryPanel` - 底部汇总卡片 panel（条件渲染）

**布局结构**:

```
TerminalView
├── WorkspaceTagBar              ← 新增：工作区 tag 切换
├── UpperPane (flex: 1)
│   ├── TerminalHeader          ← 现有
│   ├── TerminalOutput          ← 现有：显示当前 tag 工作区的实时输出
│   └── TerminalInput          ← 现有：发送 prompt → 当前 tag 工作区
└── GlobalSummaryPanel         ← 新增：条件渲染
    ├── PanelHeader            ← [收起] 按钮 + 工作区数量
    ├── WorkspaceCardList      ← 各工作区执行卡片
    │   └── WorkspaceCard      ← 单个工作区卡片
    └── AnalyzeButton          ← 完成后显示「查看全局分析」
```

### 4.2 WorkspaceTagBar

**职责**: 显示所有已配置工作区 tab，切换当前上下文

**状态**:
```typescript
interface WorkspaceTagBarProps {
  workspaces: Workspace[];           // 从 workspacePresetStorage 加载
  activeWorkspaceId: string;        // 当前选中的工作区 ID
  onSwitch: (workspaceId: string) => void;
  runningWorkspaces?: Set<string>;  // 正在执行中的工作区（高亮）
}
```

**视觉规范**:
- Tag 横向排列，超出时水平滚动
- 当前选中 tag：`accent` 底色 + 白色文字
- 正在执行中：显示加载动画或脉冲效果
- 默认 tag：透明底色，hover 时 `bg-input`

### 4.3 GlobalSummaryPanel

**职责**: 全局分发汇总卡片容器，条件渲染

**状态**:
```typescript
interface GlobalSummaryPanelProps {
  isExpanded: boolean;
  batchResult: DispatchWorkspaceResult[] | null;
  onCollapse: () => void;
  onAnalyze: () => void;  // 触发 GlobalAgentReportModal
}
```

**行为规范**:
- `isExpanded=false`：不渲染任何内容（`display: none`）
- `isExpanded=true`：从底部滑入动画
- 所有工作区均完成：`onAnalyze` 按钮高亮激活
- 支持点击 `[收起]` 折叠面板（`isExpanded=false`）

### 4.4 WorkspaceCard（单工作区卡片）

**职责**: 单个工作区的执行状态卡片

**状态**:
```typescript
interface WorkspaceCardProps {
  workspace: Workspace;
  result: DispatchWorkspaceResult | null;  // null = 执行中
  isActive: boolean;  // 是否为 TerminalView 当前 tag 选中
  onFocus: () => void;  // 切换到该工作区 tag
}
```

**视觉规范**:
- 状态徽章：成功（绿色）/ 部分成功（黄色）/ 失败（红色）/ 执行中（脉冲动画）
- 显示当前 prompt 文本（截断至 30 字符）
- 失败时显示简要错误原因
- 可点击「查看详情」展开完整结果
- 可点击切换到该工作区 tag 视图

---

## 5. 状态管理

### 5.1 新增/扩展 Zustand Store

**文件**: `src/stores/useTerminalWorkspaceStore.ts`（新增）

```typescript
interface TerminalWorkspaceState {
  // 当前在 TerminalView 中选中的工作区 tag
  activeWorkspaceId: string | null;

  // 全局分发汇总 panel 是否展开
  isGlobalSummaryExpanded: boolean;

  // 全局分发结果（由 GlobalTerminalModal 触发后写入）
  globalBatchResult: DispatchWorkspaceResult[] | null;
  globalBatchId: string | null;

  // 各工作区执行状态（实时更新，用于卡片刷新）
  workspaceExecutionStatus: Map<string, 'idle' | 'running' | 'success' | 'partial' | 'failed'>;

  // Actions
  setActiveWorkspace: (workspaceId: string) => void;
  expandGlobalSummary: (batchResult: DispatchWorkspaceResult[], batchId: string) => void;
  collapseGlobalSummary: () => void;
  updateWorkspaceStatus: (workspaceId: string, status: ExecutionStatus) => void;
  reset: () => void;
}
```

### 5.2 与现有 store 的关系

| Store | 职责 | 关系 |
|-------|------|------|
| `useTerminalWorkspaceStore` | Terminal 侧工作区上下文 + 全局分发汇总状态 | 新增，专门服务 TerminalView |
| `useMultiDispatchStore` | 全局分发结果 + AI 分析状态 | 保留，GlobalAgentTrigger 继续监听此 store |
| `useTaskStore` | 单工作区 DAG + 卡片状态 | 保留，TerminalView 上部继续使用 |

**数据流向**:
```
GlobalTerminalModal.handleSend
  → dispatchGlobalPrompts()
  → 各工作区 WebSocket 连接建立
  → useTerminalWorkspaceStore.expandGlobalSummary(batchResult)
  → TerminalView 底部 GlobalSummaryPanel 展开
  → 各工作区状态实时更新 workspaceExecutionStatus
  → 全部完成后 useMultiDispatchStore.setBatchResult(result)
  → GlobalAgentTrigger 触发 → GlobalAgentReportModal
```

---

## 6. GlobalTerminalModal 改动

### 6.1 行为变化

**之前**: 发送后等待所有结果，返回后展示在 Modal 内

**之后**: 发送后立即关闭 Modal，不等待结果；结果通过 store 推送到 TerminalView 底部

```typescript
// GlobalTerminal.tsx handleSend 修改后
const handleSend = async () => {
  // 立即启动分发，不等待结果
  dispatchGlobalPrompts({...}).catch(console.error);
  onClose(); // 立即关闭 Modal
};
```

### 6.2 分发结果推送

```typescript
// 分发启动后，将 batchResult 写入 store
const resultPromise = dispatchGlobalPrompts({...});

// 不 await，直接写启动状态
useTerminalWorkspaceStore.getState().expandGlobalSummary(
  resultPromise,  // 或在分发开始时传入空数组，逐步更新
  batchId
);
```

---

## 7. 全局分析衔接（A4 复用）

### 7.1 触发时机

底部卡片所有工作区均完成执行时，自动触发 GlobalAgentReportModal：

```typescript
// TerminalView 监听 workspaceExecutionStatus
useEffect(() => {
  const statuses = Array.from(workspaceExecutionStatus.values());
  const allDone = statuses.length > 0 &&
    statuses.every(s => s !== 'idle' && s !== 'running');

  if (allDone && isGlobalSummaryExpanded) {
    // 自动触发 GlobalAgentReportModal
    setIsGlobalAgentReportOpen(true);
  }
}, [workspaceExecutionStatus, isGlobalSummaryExpanded]);
```

### 7.2 数据传递

GlobalAgentReportModal 监听 `useMultiDispatchStore` 的 `batchResult`，无需额外改动（与现有 A4 设计一致）。

---

## 8. 实现顺序

### Phase 1: TerminalWorkspaceStore + 骨架

1. 新增 `useTerminalWorkspaceStore`
2. TerminalView 基础布局重构（上下两栏）
3. WorkspaceTagBar 组件 + tag 切换逻辑
4. 全局汇总 panel 骨架（条件渲染 + 收起）

### Phase 2: GlobalTerminalModal 改动

5. GlobalTerminalModal handleSend 改为非阻塞
6. `expandGlobalSummary` 与 `batchResult` 写入 store
7. 各工作区 WebSocket 连接建立时 `updateWorkspaceStatus('running')`
8. 各工作区 WebSocket 连接关闭时 `updateWorkspaceStatus(result)`

### Phase 3: 底部汇总卡片

9. WorkspaceCard 组件实现
10. GlobalSummaryPanel 卡片列表渲染
11. 状态徽章动画（running 脉冲效果）
12. 完成后「查看全局分析」按钮

### Phase 4: AI 分析衔接

13. 全部完成时自动触发 GlobalAgentReportModal
14. 与 A4 设计的 GlobalAgentReportModal / GlobalAgentTrigger 对接

---

## 9. 文件清单

### 新增文件

| 文件 | 描述 |
|------|------|
| `src/stores/useTerminalWorkspaceStore.ts` | Terminal 侧工作区上下文 store |
| `src/components/ToolView/WorkspaceTagBar.tsx` | 工作区 tag 切换栏 |
| `src/components/ToolView/GlobalSummaryPanel.tsx` | 底部汇总卡片 panel |
| `src/components/ToolView/WorkspaceCard.tsx` | 单个工作区执行状态卡片 |

### 修改文件

| 文件 | 描述 |
|------|------|
| `src/components/ToolView/TerminalView.tsx` | 重构为上下两栏，集成 WorkspaceTagBar + GlobalSummaryPanel |
| `src/components/GlobalTerminal/GlobalTerminal.tsx` | handleSend 改为非阻塞，立即关闭 Modal |
| `src/components/GlobalTerminal/GlobalTerminalModal.tsx` | 无改动（保持独立） |
| `src/stores/useMultiDispatchStore.ts` | 无改动（A4 继续复用） |
| `src/stores/useTaskStore.ts` | 无改动 |
| `src/App.tsx` | 集成 GlobalAgentReportModal 触发逻辑 |

### 新增测试文件

| 文件 | 描述 |
|------|------|
| `src/__tests__/useTerminalWorkspaceStore.test.ts` | store 状态逻辑测试 |
| `src/__tests__/WorkspaceTagBar.test.tsx` | tag 切换交互测试 |
| `src/__tests__/WorkspaceCard.test.tsx` | 卡片状态渲染测试 |
| `src/__tests__/GlobalSummaryPanel.test.tsx` | panel 展开/收起测试 |
