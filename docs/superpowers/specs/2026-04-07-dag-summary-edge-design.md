# DAG Summary 边路由优化

## 1. 问题

当前 `query_summary` 节点的 `parentId` 硬编码指向 `queryId`，导致边为 `query → summary`，语义不正确。

真实 DAG 中，summary 应该从**最后完成的那批工具**（lastTool）出边：`lastTool → summary`，保证 DAG 拓扑关系准确。

## 2. 数据变更

**后端**在 `query_summary` 事件中新增字段：

```typescript
// src/types/events.ts
{
  type: 'query_summary';
  queryId: string;
  summary: string;
  lastToolId?: string;  // 新增：最后完成工具的 ID（可选）
}
```

**前端** `useTaskStore` 使用该字段：

```typescript
// query_summary handler
parentId: event.lastToolId ?? event.queryId,
// 语义：
// - 有 lastToolId → summary 从最后工具出边（多工具场景）
// - 无 lastToolId → fallback 到 query（单工具或后端无此字段）
```

## 3. 边样式

沿用现有样式不做变更：

| 场景 | 颜色 | 线型 |
|------|------|------|
| query → tool | `var(--accent)` 蓝 | 实线 |
| tool → summary | `var(--success)` 绿（summary 节点 completed 状态） | 实线 |
| query → summary（单工具 fallback） | `var(--success)` 绿 | 虚线 `6,3` |
| 边 → 折叠工具 | 不渲染 | - |

## 4. 组件变更

| 文件 | 变更 |
|------|------|
| `src/types/events.ts` | `query_summary` 增加 `lastToolId?: string` |
| `src/stores/useTaskStore.ts` | `query_summary` handler 的 `parentId` 用 `lastToolId ?? queryId` |
