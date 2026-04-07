# DAG Query 节点折叠实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为每个 query 节点添加折叠/展开功能，折叠后隐藏该 query 下的工具节点和总结节点，保持 DAG 画布整洁。

**Architecture:** 在 `DAGCanvas` 中用 `useState<Set<string>>` 存储已折叠的 queryId。`positionedNodes` 和 `edges` 在 `useMemo` 中按折叠状态过滤。`DAGNode` 接收折叠状态并渲染可点击的折叠图标。

**Tech Stack:** React, @xyflow/react, Zustand

---

## Task 1: DAGNode 渲染折叠图标

**Files:**
- Modify: `src/components/DAG/DAGNode.tsx:218-260`

### Step 1: 扩展 DAGNodeProps 接口

在 `DAGNode.tsx` 文件中，在 `DAGNodeProps` 接口的 `data` 属性内新增两个字段：

找到当前接口定义（约第 218 行）：

```typescript
interface DAGNodeProps {
  data: DAGNodeType & {
    onOpenDetail?: (node: Pick<DAGNodeType, 'id' | 'type' | 'label' | 'status' | 'args' | 'summaryContent'>) => void;
  };
  onOpenDetail?: (node: Pick<DAGNodeType, 'id' | 'type' | 'label' | 'status' | 'args' | 'summaryContent'>) => void;
}
```

替换为：

```typescript
interface DAGNodeProps {
  data: DAGNodeType & {
    onOpenDetail?: (node: Pick<DAGNodeType, 'id' | 'type' | 'label' | 'status' | 'args' | 'summaryContent'>) => void;
    onToggleCollapse?: (queryId: string) => void;  // 新增：切换折叠回调
    isCollapsed?: boolean;                         // 新增：该 query 是否已折叠
  };
  onOpenDetail?: (node: Pick<DAGNodeType, 'id' | 'type' | 'label' | 'status' | 'args' | 'summaryContent'>) => void;
}
```

### Step 2: 修改 DAGNodeInner 函数签名

找到（约第 225 行）：

```typescript
function DAGNodeInner({ data, onOpenDetail }: DAGNodeProps) {
```

替换为：

```typescript
function DAGNodeInner({ data, onOpenDetail }: DAGNodeProps) {
  const isCollapsed = data.isCollapsed ?? false;
  const handleToggleCollapse = data.onToggleCollapse;
```

### Step 3: 添加折叠图标处理函数

在 `handleOpenDetail` 函数之后（约第 249 行），添加：

```typescript
  const handleToggleCollapseClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.type === 'query' && handleToggleCollapse) {
      handleToggleCollapse(data.id);
    }
  };
```

### Step 4: 在节点内渲染折叠图标（query 节点专属）

在 `DAGNode.tsx` 的 JSX 返回中，找到节点最外层 `<div>` 的开头（约第 251 行）：

找到这个 `<div>` 开头：
```tsx
    <div style={{
      background: 'var(--dag-node, var(--bg-card)',
      border: '1.5px solid',
      borderRadius: 10, padding: '10px 14px',
```

**紧贴在这个 div 的 `padding` 之前**，添加折叠图标的条件渲染：

```tsx
    <div style={{
      background: 'var(--dag-node, var(--bg-card)',
      border: '1.5px solid',
      borderRadius: 10, padding: '10px 14px',
      opacity: isCollapsed ? 0.85 : 1,
```

即在 `padding` 那一行之前加 `opacity: isCollapsed ? 0.85 : 1,`。

然后在 `data.parentId && (` 之前添加折叠图标渲染：

```tsx
      {/* 折叠图标（仅 query 节点显示） */}
      {data.type === 'query' && (
        <div
          onClick={handleToggleCollapseClick}
          title={isCollapsed ? '展开' : '折叠'}
          style={{
            position: 'absolute',
            top: 6,
            left: 6,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 1,
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--text-primary)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent)')}
        >
          <svg width="8" height="8" viewBox="0 0 24 24" fill="var(--bg-root)">
            {isCollapsed
              ? <path d="M10 17l5-5-5-5z"/>   // ▶ 展开
              : <path d="M7 10l5 5 5-5z"/>}  // ▼ 折叠
          </svg>
        </div>
      )}

      {data.parentId && (
```

### Step 5: 更新 propsAreEqual 保持折叠状态同步

找到（约第 323 行）`propsAreEqual` 函数：

```typescript
function propsAreEqual(
  prev: DAGNodeProps,
  next: DAGNodeProps,
): boolean {
  return (
    prev.data.id === next.data.id &&
    prev.data.status === next.data.status &&
    prev.data.label === next.data.label &&
    prev.data.type === next.data.type &&
    prev.data.parentId === next.data.parentId &&
    prev.data.summaryContent === next.data.summaryContent
  );
}
```

在 `prev.data.parentId &&` 后添加一行：

```typescript
    prev.data.isCollapsed === next.data.isCollapsed &&
```

---

## Task 2: DAGCanvas 折叠状态和过滤

**Files:**
- Modify: `src/components/DAG/DAGCanvas.tsx`

### Step 1: 添加 collapsedQueryIds 状态和 handleToggleCollapse 回调

在 `DAGCanvas.tsx` 中，在 `handleOpenDetail` 定义之后（约第 54 行之后），添加：

```typescript
  // 折叠状态：Set of queryId，已折叠的 query 不显示其工具和总结节点
  const [collapsedQueryIds, setCollapsedQueryIds] = useState<Set<string>>(new Set());

  const handleToggleCollapse = useCallback((queryId: string) => {
    setCollapsedQueryIds(prev => {
      const next = new Set(prev);
      if (next.has(queryId)) {
        next.delete(queryId);
      } else {
        next.add(queryId);
      }
      return next;
    });
  }, []);
```

### Step 2: 在 flowNodes 构建时传入折叠状态

找到（约第 56 行）`flowNodes` 定义：

```typescript
  const flowNodes: Node[] = Array.from(storeNodes.values()).map((node: DAGNode) => ({
    id: node.id,
    type: 'dagNode',
    data: {
      ...node,
      onOpenDetail: handleOpenDetail,
    },
    position: { x: 0, y: 0 },
  }));
```

替换为：

```typescript
  const flowNodes: Node[] = Array.from(storeNodes.values()).map((node: DAGNode) => ({
    id: node.id,
    type: 'dagNode',
    data: {
      ...node,
      onOpenDetail: handleOpenDetail,
      onToggleCollapse: handleToggleCollapse,
      isCollapsed: node.type === 'query' && collapsedQueryIds.has(node.id),
    },
    position: { x: 0, y: 0 },
  }));
```

### Step 3: positionedNodes useMemo 中过滤折叠 query 的子节点

找到 `positionedNodes` 的 `useMemo`（约第 68 行），在 `// 四层层级布局` 注释之后、`for (const n of flowNodes)` 循环之前，添加过滤逻辑：

```typescript
    // 四层层级布局: main-agent -> query -> tool -> summary
    // 无工具时 summary 紧跟 query（同一行右侧），有工具时 summary 在 level 3

    // 过滤：折叠 query 的工具节点不参与布局（视觉上隐藏）
    const collapsed = collapsedQueryIds;

    const filteredFlowNodes = flowNodes.filter(n => {
      if (n.data.type === 'query') return true; // query 节点本身永远显示
      if (n.data.type === 'main-agent') return true;
      const parentId = (n.data as DAGNode).parentId ?? 'main-agent';
      return !collapsed.has(parentId); // 折叠 query 的子节点隐藏
    });
```

然后将循环中的 `flowNodes` 替换为 `filteredFlowNodes`：

```typescript
    for (const n of filteredFlowNodes) {
```

### Step 4: positionedNodes useMemo 依赖数组加入 collapsedQueryIds

找到 `positionedNodes` 的 `useMemo` 结尾（约第 142 行）：

```typescript
    return result.length > 0 ? result : flowNodes;
  }, [flowNodes]);
```

替换为：

```typescript
    return result.length > 0 ? result : filteredFlowNodes;
  }, [filteredFlowNodes, collapsedQueryIds]);
```

### Step 5: edges 过滤折叠 query 的子节点边

找到 `edges` 定义（约第 152 行）：

```typescript
  const edges: Edge[] = Array.from(storeNodes.values())
    .filter(n => n.parentId && storeNodes.has(n.parentId))
    .map(n => {
```

替换为：

```typescript
  const edges: Edge[] = Array.from(storeNodes.values())
    .filter(n => {
      if (!n.parentId || !storeNodes.has(n.parentId)) return false;
      // 折叠 query 的子节点（tools/summary）不出边
      const parentId = n.parentId ?? 'main-agent';
      if (n.type !== 'query' && collapsedQueryIds.has(parentId)) return false;
      return true;
    })
    .map(n => {
```

### Step 6: fitView 在折叠状态变化时也触发

找到（约第 145 行）`useEffect`：

```typescript
  // Auto-fit：节点数量变化时重新 fit
  useEffect(() => {
    if (fitViewInstance) {
      fitViewInstance({ padding: 0.15, duration: 300 });
    }
  }, [positionedNodes.length]);
```

替换为：

```typescript
  // Auto-fit：节点数量或折叠状态变化时重新 fit
  useEffect(() => {
    if (fitViewInstance) {
      fitViewInstance({ padding: 0.15, duration: 300 });
    }
  }, [positionedNodes.length, collapsedQueryIds.size]);
```

---

## Spec 覆盖自检

- [x] DAGNodeProps 增加 `onToggleCollapse` 和 `isCollapsed` → Task 1 Step 1 ✓
- [x] DAGNode query 节点渲染折叠图标（▼/▶）→ Task 1 Step 4 ✓
- [x] 图标点击切换折叠 → Task 1 Step 3 + 4 ✓
- [x] collapsed 节点 opacity 变淡 → Task 1 Step 4 ✓
- [x] propsAreEqual 包含 isCollapsed → Task 1 Step 5 ✓
- [x] DAGCanvas collapsedQueryIds 状态 → Task 2 Step 1 ✓
- [x] handleToggleCollapse 回调 → Task 2 Step 1 ✓
- [x] flowNodes 传入 isCollapsed 和 onToggleCollapse → Task 2 Step 2 ✓
- [x] positionedNodes 过滤折叠子节点 → Task 2 Step 3 ✓
- [x] edges 过滤折叠子节点边 → Task 2 Step 5 ✓
- [x] 折叠状态变化时 fitView → Task 2 Step 6 ✓

**类型一致性检查：**
- `onToggleCollapse: (queryId: string) => void` — 在 DAGNode 中和 DAGCanvas 中一致 ✓
- `isCollapsed: boolean` — DAGNode props 和 flowNodes data 一致 ✓
- `collapsedQueryIds: Set<string>` — queryId 为 string 类型，与 DAGNode.id 类型一致 ✓
