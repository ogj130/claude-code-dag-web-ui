# DAG 多 EndTools 汇聚实施计划

**Goal:** 所有 endTools 都独立连接到 summary；修复 Q(n) summary → Q(n+1) query 链条边被误杀的 bug。

**Architecture:** `DAGNode` 新增 `endToolIds?: string[]` 字段记住所有 endTool；`DAGCanvas` 为每个 endTool 渲染独立边；`useTaskStore` 正确写入字段。

**Tech Stack:** React, TypeScript, @xyflow/react, Zustand

---

## Task 1: types/events.ts — 类型定义

**Files:**
- Modify: `src/types/events.ts`

- [ ] **Step 1: 修改 DAGNode 接口**

找到 `interface DAGNode`（约第 17 行），在 `summaryContent?: string;` 之后添加：

```typescript
  endToolIds?: string[];   // 该 summary 的所有 endTool ID（多边汇聚用）
```

找到 `query_summary` 类型定义（约第 45 行）：

```typescript
  | { type: 'query_summary'; queryId: string; summary: string };
```

替换为：

```typescript
  | { type: 'query_summary'; queryId: string; summary: string; endToolIds?: string[] };
```

- [ ] **Step 2: 验证编译**

Run: `npx tsc --noEmit`
Expected: 无错误

---

## Task 2: useTaskStore.ts — summary 节点写入 endToolIds

**Files:**
- Modify: `src/stores/useTaskStore.ts`

- [ ] **Step 1: 修改 query_summary handler 中的 summaryNode**

找到（约第 207-217 行）`summaryNode` 定义：

```typescript
const summaryNode: DAGNode = {
  id: summaryNodeId,
  label: '总结',
  status: 'completed',
  type: 'summary',
  // lastToolId 存在时从最后工具出边（DAG 语义准确），否则 fallback 到 query（单工具场景）
  parentId: event.lastToolId ?? event.queryId,
  startTime: Date.now(),
  endTime: Date.now(),
  summaryContent: event.summary,
};
```

替换为：

```typescript
const summaryNode: DAGNode = {
  id: summaryNodeId,
  label: '总结',
  status: 'completed',
  type: 'summary',
  // endToolIds[0] 存在时从第一个 endTool 出边，否则 fallback 到 query（单工具场景）
  parentId: event.endToolIds?.[0] ?? event.queryId,
  endToolIds: event.endToolIds,   // 记住所有 endTools，用于多边汇聚
  startTime: Date.now(),
  endTime: Date.now(),
  summaryContent: event.summary,
};
```

- [ ] **Step 2: 验证编译**

Run: `npx tsc --noEmit`
Expected: 无错误

---

## Task 3: DAGCanvas.tsx — 修复边过滤 + 渲染额外汇聚边

**Files:**
- Modify: `src/components/DAG/DAGCanvas.tsx`

### 3.1 修复过滤逻辑（Bug 1 修复）

找到 `const edges: Edge[]` 的 filter 块（约第 155-171 行），整个替换为：

```typescript
  const edges: Edge[] = Array.from(storeNodes.values())
    .filter(n => {
      if (!n.parentId || !storeNodes.has(n.parentId)) return false;
      const parentId = n.parentId ?? 'main-agent';

      // 折叠 query 的工具节点不出边
      if (n.type === 'tool' && collapsedQueryIds.has(parentId)) return false;

      // summary 作为 target 时：
      // - parentId 指向 tool（endTool）→ 直接渲染
      // - parentId 指向 query 且有 endToolIds → 不渲染（由 endTool→summary 多边替代）
      // - parentId 指向 query 且无 endToolIds → 渲染 query→summary（单工具 fallback）
      if (n.type === 'summary') {
        const parentIsEndTool = storeNodes.has(parentId) && storeNodes.get(parentId)!.type === 'tool';
        if (parentIsEndTool) {
          return true; // endTool→summary，直接渲染
        }
        // parent 是 query：检查是否有 endToolIds
        const hasEndTools = (n.endToolIds?.length ?? 0) > 0;
        if (hasEndTools) return false; // endTool→summary 多边会处理
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

### 3.2 追加额外汇聚边

在 `const edges` 定义之后（约第 189 行之后），添加：

```typescript
  // 额外边：每个 summary 的 endToolIds[1:] → summary（[0] 已由上面的 parentId 处理）
  const extraEdges: Edge[] = [];
  for (const node of storeNodes.values()) {
    if (node.type === 'summary' && node.endToolIds && node.endToolIds.length > 1) {
      for (const endToolId of node.endToolIds.slice(1)) { // 跳过 [0]
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

### 3.3 更新 ReactFlow 的 edges prop

找到 `<ReactFlow` JSX 中的 `edges={edges}`，替换为 `edges={allEdges}`。

- [ ] **Step 3: 验证编译**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 4: 启动验证**

Run: `./start.sh stop && ./start.sh`
Expected: 服务正常启动，类型检查通过

---

## 场景覆盖检查

| 场景 | endToolIds | parentId | 预期边 |
|------|-----------|----------|--------|
| 无工具 | 空/未定义 | queryId | query → summary（虚线） |
| 单工具 | 空/未定义 | toolId | tool → summary（实线） |
| 多并行工具 | [t1, t2, t3] | t1 | t1→summary + t2→summary + t3→summary（均为实线） |
| Q(n)→Q(n+1) 链条 | - | 上个 summaryId | 上个 summary → 当前 query（虚线） |
