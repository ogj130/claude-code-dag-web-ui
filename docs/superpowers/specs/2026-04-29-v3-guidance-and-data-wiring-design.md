# V3.0.0 功能引导 + 流程/看板数据接入 设计文档

## 概述

为 V3.0.0 所有功能添加三层引导体系（首次提示 / 空状态引导 / 帮助文档），同时将流程编排(FlowBuilder)和任务看板(KanbanBoard)的 mock 数据替换为 `agentOrchestrator` 真实数据。

## Part 1: 三层引导体系

### L1: 首次使用提示

**触发条件**: 用户首次点击某个 Dock 子功能，且之前未看过该功能的提示。

**交互**: DockModal/DockDrawer 内容区顶部显示蓝色提示 banner：
```
┌─────────────────────────────────────────┐
│ 💡 功能说明                             │
│ 流程编排器帮助你创建可视化任务流程。      │
│ 拖拽左侧节点到画布，连接它们来定义执行步骤。│
│ [不再显示]                              │
└─────────────────────────────────────────┘
```
- 点击 "不再显示" 或关闭面板后，记录到 `localStorage`，该功能不再显示
- Banner 不占用额外交互步骤，可一键关闭

**存储**: `localStorage` key: `cc-web-ui-seen-hints`，值为逗号分隔的功能 ID 列表

**实现位置**: `InlineFeatureRenderer.tsx` 中新增 `<FirstTimeHint featureId={itemId} />` 组件，在每个 case 的顶部渲染

**文案**: 29 个功能各写 2-3 句中文说明。整理为一个 `HINT_TEXTS: Record<string, { title: string; body: string }>` 常量文件

### L2: 空状态引导

**触发条件**: 功能无数据时（如看板无任务、流程画布为空）

**交互**: 替代当前 "暂无数据" 纯文字，显示带引导的空白状态：
```
┌─────────────────────────────────────────┐
│          [功能图标 48x48]               │
│                                         │
│        任务看板                          │
│    管理你的开发任务，拖拽卡片改变状态      │
│                                         │
│   ① 点击下方按钮创建第一个任务           │
│   ② 拖拽任务卡片到不同列                 │
│   ③ 双击卡片编辑详情                     │
│                                         │
│      [ 创建第一个任务 ]                  │
└─────────────────────────────────────────┘
```

**实现**: 新建 `src/components/GlobalDock/EmptyGuide.tsx`，Props:
```typescript
interface EmptyGuideProps {
  featureId: string;
  icon: React.ReactNode;
  onAction?: () => void;  // "开始使用" 按钮回调
}
```

**文案**: 29 个功能各写 3 步操作指引 + 行动按钮文案。复用 `HINT_TEXTS` 常量文件

**使用**: 各功能组件在数据为空时渲染 `<EmptyGuide>` 替代占位文字

### L3: 帮助页面

**触发**: 系统工具 → 使用指南（新增 Dock 子项），或通过 `?` 快捷键打开

**实现**: 新建 `src/components/HelpGuideModal.tsx`：
- 居中 Modal（参照 DockModal 规格）
- 左侧：7 个分组锚点导航（sticky 侧边栏）
- 右侧：Markdown 渲染的完整帮助内容
- 每个分组标题 + 各功能介绍 + 操作步骤

**帮助内容结构**:
```markdown
# CC Web UI V3.0.0 使用指南

## 核心智能
### 模式切换
### 意图理解
...

## 编排系统
### Agent 编排
### Agent 监控
### 流程编排
### 流程执行
### 任务看板
...
```

**Dock 集成**: 在 `系统工具` 组中添加 `guide` 项，点击打开 `HelpGuideModal`

## Part 2: 流程/看板数据接入

### FlowBuilder 接入 agentOrchestrator

**当前**: 组件内部 `useState` 初始化 mock Flow 数据

**改成**:
1. 添加 `useEffect` 钩子，从 `agentOrchestrator.getAllTasks()` 加载任务列表
2. 将 `OrchestrationTask[]` 转换为 Flow 节点：
   - 每个 Task → 一个 FlowNode (type='task')
   - Task 的 substeps → 子节点
   - Task 间的依赖关系 → FlowEdge
3. 保存流程时调用 `agentOrchestrator.createTask()` 持久化
4. 3 个内置模板作为"新建流程"的快捷入口

**类型映射**:
```
OrchestrationTask → FlowNode
  task.id → node.id
  task.title → node.label
  task.status → 节点颜色
  task.agents[] → 节点子标签
```

### KanbanBoard 接入 agentOrchestrator

**当前**: `useState<TaskCard[]>(INITIAL_TASKS)` 硬编码 mock

**改成**:
1. 添加 `useEffect`，调用 `agentOrchestrator.getAllTasks()`
2. 按 `task.status` 映射到看板列:
   - `pending` → todo
   - `running` → doing
   - `review` → review
   - `completed` → done
3. 添加任务 → 调用 `agentOrchestrator.createTask()`
4. 拖拽改变列 → 更新本地状态 + 创建新 task
5. 删除任务 → 从本地状态移除

**类型适配**: Kanban 的 `TaskCard` 扩展为包含 `orchestrationTaskId` 字段，关联回 `OrchestrationTask`

## 文件清单

### 新建

| 文件 | 用途 |
|------|------|
| `src/components/GlobalDock/EmptyGuide.tsx` | L2 空状态引导组件 |
| `src/components/GlobalDock/FirstTimeHint.tsx` | L1 首次提示组件 |
| `src/components/GlobalDock/featureHints.ts` | 29 个功能的引导文案常量 |
| `src/components/HelpGuideModal.tsx` | L3 帮助页面 Modal |

### 修改

| 文件 | 变更 |
|------|------|
| `src/components/GlobalDock/InlineFeatureRenderer.tsx` | 添加 `<FirstTimeHint>` 和 `<EmptyGuide>` |
| `src/components/v3/FlowBuilder.tsx` | `INITIAL_FLOW` mock → `agentOrchestrator` 数据 |
| `src/components/v3/KanbanBoard.tsx` | `INITIAL_TASKS` mock → `agentOrchestrator.getAllTasks()` |
| `src/components/GlobalDock/dockConfig.tsx` | 系统工具组添加 `guide` 项 |
| `src/App.tsx` | 渲染 `HelpGuideModal` |

## 测试策略

- `EmptyGuide.test.tsx` — 渲染各功能 ID 的空状态
- `FirstTimeHint.test.tsx` — 首次显示 / 再次隐藏 / localStorage 持久化
- 更新 `useDockStore.test.ts` — `seenHints` set 操作
- 更新现有 Flow/Kanban 测试 — 验证 `agentOrchestrator` 数据读取
