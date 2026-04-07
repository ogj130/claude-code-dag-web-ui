# DAG Query 节点折叠 + 多 Query 可视化

## 1. 问题描述

**问题 1（Bug）：第二个 query 节点不可见**
`user_input_sent` → `query_start` 事件链为 Q2 创建了 DAG node，但 `positionedNodes` 布局算法让 Q1/Q2 在同一 Y 坐标，X 也相同，导致 Q2 节点和 Q1 的工具/总结节点完全重叠。

（已在上次修复中部分解决：每个 query 现在纵向分行排列）

**问题 2（Feature）：没有折叠能力**
随着会话进行，DAG 节点越来越多，需要能够折叠已完成的 query，隐藏其工具和总结节点，保持画布整洁。

## 2. 目标效果

```
展开状态：
┌─────────────────────────────────────────────────────────┐
│ [main-agent]                                            │
│     │                                                   │
│     ▼                                                   │
│ ┌─────────┐  ┌──────┐  ┌──────┐  ┌─────────┐         │
│ │ Q1: 你好啊│──│tool 1│──│tool 2│──│ 总结    │         │
│ └────[▼]──┘  └──────┘  └──────┘  └─────────┘         │
│     │                                                   │
│     ▼                                                   │
│ ┌─────────┐  ┌──────┐  ┌─────────┐                    │
│ │ Q2: 继续问│──│tool 1│──│ 总结    │                    │
│ └────[▼]──┘  └──────┘  └─────────┘                    │
└─────────────────────────────────────────────────────────┘

折叠 Q1 后：
┌─────────────────────────────────────────────────────────┐
│ [main-agent]                                            │
│     │                                                   │
│     ▼                                                   │
│ ┌─────────┐    ← Q1 的工具和总结都隐藏                  │
│ │ Q1: 你好啊│──┘                                         │
│ └────[▶]──┘    ← 展开图标变为折叠图标                    │
│     │                                                   │
│     ▼                                                   │
│ ┌─────────┐  ┌──────┐  ┌─────────┐                    │
│ │ Q2: 继续问│──│tool 1│──│ 总结    │                    │
│ └────[▼]──┘  └──────┘  └─────────┘                    │
└─────────────────────────────────────────────────────────┘
```

## 3. 设计方案

### 3.1 状态管理

在 `DAGCanvas` 组件内添加本地状态：

```typescript
// DAGCanvas.tsx
const [collapsedQueryIds, setCollapsedQueryIds] = useState<Set<string>>(new Set());
```

- `Set<string>` 存储已折叠的 queryId
- 默认全部展开（empty Set）
- 折叠切换：点击 query 节点图标时，从 Set 中 add/remove

### 3.2 DAGNodeProps 新增字段

```typescript
// DAGNode.tsx
interface DAGNodeProps {
  data: DAGNodeType & {
    onOpenDetail?: (node: ...) => void;
    onToggleCollapse?: (queryId: string) => void;  // 新增
    isCollapsed?: boolean;                          // 新增
  };
  // ...
}
```

### 3.3 DAGCanvas 传入折叠状态

```typescript
const flowNodes: Node[] = Array.from(storeNodes.values()).map((node: DAGNode) => ({
  id: node.id,
  type: 'dagNode',
  data: {
    ...node,
    onOpenDetail: handleOpenDetail,
    onToggleCollapse: handleToggleCollapse,    // 新增
    isCollapsed: node.type === 'query' && collapsedQueryIds.has(node.id),  // 新增
  },
  position: { x: 0, y: 0 },
}));
```

### 3.4 布局过滤：折叠的 query 隐藏子节点

在 `positionedNodes` 的 `useMemo` 中，加入过滤逻辑：

```typescript
const positionedNodes = useMemo(() => {
  // ... level0/1/2/3 分类 ...

  // 折叠的 queryId 集合
  const collapsed = collapsedQueryIds; // 来自外部 closure

  // 过滤：折叠 query 的工具和总结节点不参与布局
  const filteredLevel2 = level2.filter(n => {
    const parentId = (n.data as DAGNode).parentId ?? 'main-agent';
    return !collapsed.has(parentId);
  });
  const filteredLevel3 = level3.filter(n => {
    const parentId = (n.data as DAGNode).parentId ?? 'main-agent';
    return !collapsed.has(parentId);
  });
  // 后续布局用 filteredLevel2 / filteredLevel3
}, [flowNodes, collapsedQueryIds]);
```

### 3.5 DAGNode 渲染变更

**展开状态（isCollapsed=false）：**
- 节点内左上角显示 `▼` 图标（可点击）
- 点击 `▼` → 调用 `onToggleCollapse(queryId)`

**折叠状态（isCollapsed=true）：**
- 节点内左上角显示 `▶` 图标（可点击）
- 点击 `▶` → 调用 `onToggleCollapse(queryId)`
- 节点背景色稍变淡（opacity: 0.85），表示部分隐藏

**注意：** 折叠图标只对 `type === 'query'` 的节点渲染，工具/总结节点不受影响（通过 `isCollapsed` 控制）。

### 3.6 边过滤

折叠 query 的出边（edges）也需要过滤，否则会有悬浮的虚线连接：

```typescript
const edges: Edge[] = Array.from(storeNodes.values())
  .filter(n => n.parentId && storeNodes.has(n.parentId))
  // 折叠 query 的子节点不出边
  .filter(n => {
    const parentId = n.parentId ?? 'main-agent';
    if (n.type !== 'query') {
      return !collapsedQueryIds.has(parentId);
    }
    return true;
  })
  .map(n => { ... });
```

### 3.7 交互设计

| 交互 | 行为 |
|------|------|
| 点击 query 节点 `▼`/`▶` 图标 | 切换该 query 的折叠状态 |
| 点击 query 节点其他区域 | 打开 `NodeDetailModal`（保持不变） |
| DAGCanvas 外部点击 | 无影响 |
| ReactFlow fitView | 折叠/展开后自动 fitView |

**图标设计（SVG）：**
```tsx
// 折叠图标
<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
  <path d="M7 10l5 5 5-5z"/>  // ▼
</svg>

// 展开图标
<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
  <path d="M10 17l5-5-5-5z"/>  // ▶
</svg>
```

## 4. 组件变更

| 文件 | 变更 |
|------|------|
| `src/components/DAG/DAGCanvas.tsx` | 添加 `collapsedQueryIds` 状态、`handleToggleCollapse` 回调、`positionedNodes` 过滤折叠节点、`edges` 过滤折叠边 |
| `src/components/DAG/DAGNode.tsx` | `DAGNodeProps` 增加 `onToggleCollapse`、`isCollapsed`；query 节点内渲染可点击的折叠图标 |

## 5. 实现步骤

### Task A: DAGCanvas 添加折叠状态和过滤

- 添加 `useState<Set<string>>` 存储折叠 queryId
- 添加 `handleToggleCollapse` 回调
- `positionedNodes` 中过滤折叠 query 的子节点
- `edges` 中过滤折叠 query 的子节点的边

### Task B: DAGNode 渲染折叠图标

- `DAGNodeProps` 增加 `onToggleCollapse` 和 `isCollapsed`
- query 节点内渲染折叠/展开切换图标
- 点击图标调用 `onToggleCollapse`

### Task C: DAGCanvas 传入折叠状态给 DAGNode

- `flowNodes` 构建时传入 `isCollapsed` 和 `onToggleCollapse`

## 6. 测试场景

1. **单 query**：query 节点正常显示，有工具则展示工具和总结
2. **点击折叠**：点击 query 节点图标，工具和总结消失
3. **点击展开**：再次点击，工具和总结重新出现
4. **多 query 分别折叠**：Q1 折叠，Q2 展开，互不影响
5. **折叠后 fitView**：折叠/展开后画布自动适应，不留空白悬浮边
