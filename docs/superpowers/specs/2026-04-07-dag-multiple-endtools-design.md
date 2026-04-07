# DAG 多 EndTools 汇聚 + Bug 修复

## 1. 问题

### Bug 1：Q(n) summary → Q(n+1) query 链条边被误杀

当前边过滤逻辑中：

```typescript
if (n.type === 'summary') {
  const parentHasTools = Array.from(storeNodes.values()).some(
    n2 => n2.type === 'tool' && n2.parentId === parentId
  );
  if (parentHasTools) return false;
}
```

`parentHasTools` 检查的是 `summary.parentId` 指向的节点下是否有工具。但对于 `Q(n)_summary` → `Q(n+1)_query` 这条链条边，`Q(n)_summary` 是 source 而非 target，这段逻辑不应该影响它。过滤条件应只在 summary 作为 **target** 时生效。

### Bug 2：只支持 1 个 lastTool，多并行 endTools 时不够用

当前 `query_summary.lastToolId?: string` 只能指定一个工具，但多个并行工具作为 endTools 时需要全部连到 summary。

## 2. 目标

1. 所有 endTools 都要连到 summary（多边汇聚）
2. Q(n) summary → Q(n+1) query 链条边不被误伤
3. 无工具或单工具场景保持现有行为（fallback）

## 3. 方案：方案 A — 多 EndTools 独立汇聚

### 3.1 数据结构变更

**后端 `query_summary` 事件**：

```typescript
// events.ts
{
  type: 'query_summary';
  queryId: string;
  summary: string;
  endToolIds?: string[];  // 该 query 最后一批工具的所有 endTool ID（可多个）
}
```

**前端 DAGNode 类型**：

```typescript
// types/events.ts
interface DAGNode {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  type: 'agent' | 'query' | 'tool' | 'summary';
  parentId?: string;
  args?: Record<string, unknown>;
  summaryContent?: string;
  endToolIds?: string[];   // 新增：该 summary 的所有 endTool IDs（用于渲染多条汇聚边）
  startTime?: number;
  endTime?: number;
}
```

### 3.2 useTaskStore 变更

```typescript
// query_summary handler
const summaryNode: DAGNode = {
  id: summaryNodeId,
  label: '总结',
  status: 'completed',
  type: 'summary',
  parentId: event.endToolIds?.[0] ?? event.queryId,  // parentId 指向第一个 endTool（链条语义保留）
  endToolIds: event.endToolIds,                        // 记住所有 endTools
  startTime: Date.now(),
  endTime: Date.now(),
  summaryContent: event.summary,
};
```

语义：
- `endToolIds` 有值：summary 从多个 endTools 汇聚（多边）
- `endToolIds` 为空/undefined：单工具场景，fallback 到 `parentId = queryId`

### 3.3 DAGCanvas 边渲染逻辑

**修复 Bug 1**：过滤只在 summary 作为 **target** 时才检查是否有替代边。

```typescript
const edges: Edge[] = Array.from(storeNodes.values())
  .filter(n => {
    if (!n.parentId || !storeNodes.has(n.parentId)) return false;
    const parentId = n.parentId ?? 'main-agent';

    // 折叠 query 的工具节点不出边
    if (n.type === 'tool' && collapsedQueryIds.has(parentId)) return false;

    // summary 作为 target 时：
    // - 若 parentId 指向 tool（endTool）→ 直接渲染 tool→summary 边
    // - 若 parentId 指向 query 且有 endToolIds → 不渲染 query→summary（由 endTool→summary 替代）
    // - 若 parentId 指向 query 且无 endToolIds → 渲染 query→summary（单工具 fallback）
    if (n.type === 'summary') {
      const parentIsEndTool = storeNodes.has(parentId) && storeNodes.get(parentId)!.type === 'tool';
      if (parentIsEndTool) {
        // endTool→summary，直接渲染
        return true;
      }
      // parent 是 query：检查是否有 endToolIds
      const hasEndTools = (n.endToolIds?.length ?? 0) > 0;
      if (hasEndTools) return false; // endTool→summary 的边由 endTool 节点渲染
      // 无 endToolIds：单工具 fallback，渲染 query→summary
    }
    return true;
  })
  .map(n => {
    const source = n.parentId!;
    const parentIsEndTool = storeNodes.has(source) && storeNodes.get(source)!.type === 'tool';
    return {
      id: `${source}-${n.id}`,
      source,
      target: n.id,
      style: {
        stroke: n.status === 'completed' ? 'var(--success)'
          : n.status === 'running' ? 'var(--warn)'
          : 'var(--accent)',
        strokeWidth: 1.5,
        strokeDasharray: (n.type === 'summary' && !parentIsEndTool) ? '6,3' : (
          n.status === 'pending' ? '4,3' : undefined
        ),
      },
    };
  });
```

**渲染额外汇聚边**（在上述边数组之后追加）：

```typescript
// 额外边：每个 summary 的 endToolIds[1:] → summary（跳过 [0]，已在上面渲染）
const extraEdges: Edge[] = [];
for (const node of storeNodes.values()) {
  if (node.type === 'summary' && node.endToolIds && node.endToolIds.length > 1) {
    for (const endToolId of node.endToolIds.slice(1)) { // 跳过第一个（parentId 已处理）
      if (storeNodes.has(endToolId)) {
        extraEdges.push({
          id: `extra-${endToolId}-${node.id}`,
          source: endToolId,
          target: node.id,
          style: {
            stroke: 'var(--success)',
            strokeWidth: 1.5,
          },
        });
      }
    }
  }
}
const allEdges = [...edges, ...extraEdges];
```

### 3.4 边样式

| 边类型 | 颜色 | 线型 |
|--------|------|------|
| query → tool | `var(--accent)` 蓝 | 实线 |
| endTool → summary | `var(--success)` 绿 | 实线 |
| query → summary（单工具 fallback） | `var(--success)` 绿 | 虚线 `6,3` |
| Q(n) summary → Q(n+1) query（链条） | `var(--text-dim)` 灰 | 虚线 `4,3` |

## 4. 组件变更

| 文件 | 变更 |
|------|------|
| `src/types/events.ts` | DAGNode 增加 `endToolIds?: string[]`；`query_summary` 改为 `endToolIds?: string[]` |
| `src/stores/useTaskStore.ts` | `query_summary` handler 用 `event.endToolIds?.[0] ?? event.queryId`；存入 `endToolIds` |
| `src/components/DAG/DAGCanvas.tsx` | 修复过滤 Bug；追加额外汇聚边渲染 |

## 5. 场景覆盖

| 场景 | endToolIds | parentId | 边 |
|------|-----------|----------|-----|
| 无工具 | 空 | queryId | query → summary（虚线） |
| 单工具 | 空 | toolId | tool → summary（实线） |
| 多并行工具 | [t1, t2, t3] | t1 | t1→summary + t2→summary + t3→summary（均为实线） |
| 链条 | - | 上个 summaryId | 上个 summary → 当前 query（虚线） |
