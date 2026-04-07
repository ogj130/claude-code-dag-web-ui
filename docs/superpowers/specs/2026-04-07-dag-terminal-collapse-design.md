# DAG 自动折叠 + 终端卡片叠起

## 1. 背景与目标

### 当前问题

1. **DAG 自动折叠不生效**：当新问题开始时，之前的问题节点不会自动折叠，导致 DAG 越来越拥挤
2. **终端卡片缺少叠起能力**：新问题来临时，前面的问答卡片没有自动叠起，页面越来越长

### 目标

1. DAG：每个新问题开始时，自动折叠前一个问题（query + tools + summary 节点）
2. 终端：每个新问题开始时，前一张 MarkdownCard 自动叠起为单行摘要

---

## 2. 设计方案

### 2.1 DAG 自动折叠

#### 问题分析

`DAGCanvas` 中的 useEffect 依赖 `storeNodes`，但 `currentQueryId` 在 `user_input_sent` 时先更新，此时 `storeNodes` 还没变化，导致 effect 不触发。

#### 修复方案

**将折叠逻辑从 DAGCanvas 移到 useTaskStore 的 `query_start` 事件处理中**

```typescript
// useTaskStore.ts — case 'query_start'
case 'query_start': {
  const newNodesQ = new Map(nodes);
  const queryNode: DAGNode = {
    id: event.queryId,
    label: event.label,
    status: 'running',
    type: 'query',
    parentId: get().lastSummaryNodeId ?? 'main-agent',
    startTime: Date.now(),
  };
  newNodesQ.set(event.queryId, queryNode);

  // 【新增】自动折叠前一个已完成的 query
  const prevQueryId = get().lastCompletedQueryId;
  const newCollapsedQueryIds = new Set(get().collapsedDagQueryIds);
  if (prevQueryId && prevQueryId !== event.queryId) {
    newCollapsedQueryIds.add(prevQueryId);
  }

  // 记录当前 query 为"最近完成"（供下次使用）
  const lastCompletedQueryId = get().currentQueryId; // 上一个正在运行的 query

  set({
    nodes: newNodesQ,
    currentQueryId: event.queryId,
    collapsedDagQueryIds: newCollapsedQueryIds,
    lastCompletedQueryId,
    isRunning: true
  });
  break;
}
```

#### 新增 State

```typescript
interface TaskState {
  // ...existing fields...
  collapsedDagQueryIds: Set<string>;  // DAG 中已折叠的 queryId
  lastCompletedQueryId: string | null; // 最后一个进入 running 的 queryId（用于自动折叠）
}
```

#### DAGCanvas 变更

移除之前无效的 useEffect，改为从 store 读取折叠状态：

```typescript
// DAGCanvas.tsx
const { nodes: storeNodes, collapsedDagQueryIds } = useTaskStore();
const collapsedQueryIds = collapsedDagQueryIds; // 直接使用 store 中的状态
```

---

### 2.2 终端卡片叠起

#### 核心思路

新问题开始时，前一张卡片自动叠起为摘要行。

#### 数据结构变更

```typescript
interface TaskState {
  // ...existing fields...
  collapsedCardIds: Set<string>;  // 已叠起的卡片ID集合
}
```

#### MarkdownCard 支持外部折叠控制

```typescript
// MarkdownCard.tsx
interface MarkdownCardProps {
  card: MarkdownCardData;
  defaultAnalysisOpen?: boolean;
  defaultCollapsed?: boolean;  // 【新增】外部控制的折叠状态
}

// 优先级：defaultCollapsed > 内部 open 状态
const [open, setOpen] = useState(!defaultCollapsed);
```

#### 叠起时的 UI 效果

叠起时隐藏所有内容，只显示单行摘要：

```tsx
{/* 叠起状态：一行摘要 */}
{!open && (
  <div
    className="markdown-card-header"
    onClick={() => setOpen(true)}
    style={{
      padding: '8px 12px',
      cursor: 'pointer',
      fontSize: 11,
      color: 'var(--success)',
      background: 'var(--success-bg)',
    }}
  >
    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ transform: 'rotate(0deg)' }}>▶</span>
      <span style={{ color: 'var(--text-muted)' }}>Q:</span>
      {card.query.length > 60 ? card.query.slice(0, 60) + '...' : card.query}
    </span>
  </div>
)}
```

#### 卡片创建时触发叠起

在 `useTaskStore` 的 `query_summary` 事件处理中：

```typescript
case 'query_summary': {
  // ...existing code...

  // 【新增】叠起前一张卡片
  const newCollapsedCards = new Set(get().collapsedCardIds);
  const allCards = get().markdownCards;
  if (allCards.length > 0) {
    const prevCardId = allCards[allCards.length - 1].id;
    newCollapsedCards.add(prevCardId);
  }

  // 创建新卡片
  get().addMarkdownCard({
    id: `card_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    queryId: event.queryId,
    // ...
  });

  set({
    nodes: newNodesQS,
    collapsedCardIds: newCollapsedCards,
    // ...
  });
  break;
}
```

#### TerminalView 传入折叠状态

```tsx
// TerminalView.tsx
const { markdownCards, collapsedCardIds } = useTaskStore();

{markdownCards.map(card => (
  <MarkdownCard
    key={card.id}
    card={card}
    defaultAnalysisOpen={false}
    defaultCollapsed={collapsedCardIds.has(card.id)}
  />
))}
```

---

## 3. 组件变更清单

| 文件 | 变更内容 |
|------|----------|
| `src/stores/useTaskStore.ts` | 新增 `collapsedDagQueryIds`、`lastCompletedQueryId`、`collapsedCardIds` 状态；`query_start` 中添加自动折叠逻辑；`query_summary` 中添加卡片叠起逻辑 |
| `src/components/DAG/DAGCanvas.tsx` | 移除无效的 useEffect；直接从 store 读取 `collapsedDagQueryIds` |
| `src/components/ToolView/MarkdownCard.tsx` | 新增 `defaultCollapsed` prop；叠起时显示单行摘要 |
| `src/components/ToolView/TerminalView.tsx` | 读取 `collapsedCardIds` 并传给 MarkdownCard |

---

## 4. 交互流程

```
用户提问 Q2
    ↓
user_input_sent → currentQueryId 更新为 Q2
    ↓
query_start → 创建 Q2 节点
    ↓
  ├→ DAG：前一个 query (Q1) 的节点自动折叠 ✓
  └→ Terminal：前一张卡片自动叠起为单行摘要 ✓
    ↓
DAG fitView 聚焦到 Q2 节点 ✓
```

---

## 5. 测试场景

1. **单问题**：Q1 完成后，刷新页面，Q1 默认展开
2. **连续提问**：Q1 → Q2 → Q3，每一步都自动折叠/叠起前一个问题
3. **手动展开**：点击叠起的卡片可以展开
4. **手动折叠**：点击展开的卡片可以手动折叠
5. **DAG 聚焦**：新问题开始后，DAG 自动聚焦到新节点
6. **主题切换**：暗色/亮色主题下折叠状态正确显示
