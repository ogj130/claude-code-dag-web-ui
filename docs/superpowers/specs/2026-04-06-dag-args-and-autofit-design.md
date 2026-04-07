# DAG 图参数显示 & 自动缩放居中

**日期**: 2026-04-06
**状态**: 设计完成，待实现

---

## 1. 背景

当前 CC Web UI 的 DAG 执行图存在两个问题：
1. 工具节点（tool nodes）不显示工具参数（如 `Read` 工具的 `file` 路径）
2. DAG 图不会随节点增加自动缩放居中

---

## 2. 问题一：DAG 工具节点不显示参数

### 根因

`useTaskStore.ts` 的 `tool_call` 分支：
- 把 `args` 正确写入了 `toolCalls[]` 数组（`toolCall.args = event.args`）
- 但创建 DAG node 时漏掉了 `args` 字段

导致 `DAGNode.tsx` 中的 `formatToolArgs(data.label, data.args as Record...)` 永远收到 `null`，参数展示区从不渲染。

### 修复

**文件**: `src/stores/useTaskStore.ts`

在 `tool_call` case 的 DAG node 创建处，添加 `args` 字段：

```typescript
const toolNode: DAGNode = {
  id: event.toolId,
  label: event.tool,
  status: 'running',
  type: 'tool',
  parentId: get().currentQueryId ?? 'main-agent',
  startTime: Date.now(),
  args: event.args,  // ← 新增
};
```

DAGNode 的类型定义已有 `[key: string]: unknown` 索引签名，会自然接收 `args`。

---

## 3. 问题二：DAG 自动缩放居中

### 根因

`DAGCanvas.tsx` 中 `fitView={true}` 只在 ReactFlow 初次挂载时生效，后续节点加入不会重新 fit，导致新节点跑到视野外。

### 修复

**文件**: `src/components/DAG/DAGCanvas.tsx`

使用 `useReactFlow` hook，在节点数量变化时自动触发 `fitView`：

```typescript
import { useReactFlow } from '@xyflow/react';

// 组件内：
const { fitView, getNodes } = useReactFlow();

// 监听节点数量变化，每次有新节点时自动 fit
useEffect(() => {
  const nodes = getNodes();
  if (nodes.length > 0) {
    fitView({ padding: 0.15, duration: 300 });
  }
}, [nodes.length, fitView, getNodes]);
```

**参数说明**：
- `padding: 0.15`：四周留 15% 边距，不贴边
- `duration: 300`：300ms ease-out 平滑缩放（符合 ui-ux-pro-max 动画规范）

---

## 4. 参数展开 UI

`DAGNode.tsx` 中已实现了 `formatToolArgs` 函数和可展开参数行（`argsOpen` state + chevron 旋转动画），修复数据流后自动生效，无需额外改动。

---

## 5. 实现清单

| 步骤 | 文件 | 改动 |
|------|------|------|
| 1 | `src/stores/useTaskStore.ts` | tool_call 分支 DAG node 创建加 `args: event.args` |
| 2 | `src/components/DAG/DAGCanvas.tsx` | import `useReactFlow`，加 `useEffect` 监听节点数触发 `fitView` |
| 3 | 验证 | DAG 节点显示参数 + 新节点加入时自动居中 |

---

## 6. 验收标准

- [ ] 执行一个带 `Read` 工具的 query，DAG 工具节点显示 "参数 ▾" 可展开按钮
- [ ] 点击展开后显示 `path: /path/to/file` 等格式化参数
- [ ] 新增节点时 DAG 自动缩放，新节点始终在视野中心
- [ ] 缩放动画平滑（无跳跃），时长约 300ms
