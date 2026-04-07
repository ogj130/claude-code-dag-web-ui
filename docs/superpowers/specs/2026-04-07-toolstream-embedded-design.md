# 工具内嵌 MarkdownCard — Bug 修复 + 架构变更

## 1. 问题

### Bug 1：工具跑到总结后面

当前 `TerminalView` 布局：
```
MarkdownCard 列表（已完成总结）
ToolStreamView（当前 query 的工具）
xterm.js
```

问题：`query_summary` 先触发（创建 MarkdownCard），后端的部分 `tool_result` 事件在 `user_input_sent`（下一个 query 开始）之后才到达前端。此时 `currentQueryId` 已切换，`ToolStreamView` 只显示新 query 的工具，旧 query 未完成的工具被过滤掉——用户看到总结后面还有"进行中"的工具。

### Bug 2：工具独立于总结，缺乏关联性

每个 `query → 工具 → 总结` 本应是语义完整的单元，但工具流独立在卡片之外，用户无法直观看到某个总结对应的工具执行过程。

## 2. 目标

**每个 MarkdownCard 内部包含完整的 query 执行过程：**

```
┌─ ✦ 回答总结 ──────────────────────────────
│  💬 你好啊                                  ← Query
│  ───────────────────────────────────────
│  ↳ [旋转] Read   [file: "App.tsx"]  [进行中...]
│  ↳ [✓]    Grep   [pattern: "TODO"]   0.32s
│  ↳ [✓]    Bash   [npm run dev]       1.45s
│  ───────────────────────────────────────
│  📋 最终总结
│  Claude 的回答...                           ← Summary
└──────────────────────────────────────────
```

- 工具只显示当前 query 的（通过 `parentId === queryId` 过滤）
- 工具内嵌在 Query 和 Summary 之间，语义清晰
- 已完成的卡片永久保留工具历史（不再依赖 `currentQueryId`）

## 3. 架构

### 3.1 数据层变更

**MarkdownCardData 新增 `queryId`：**

```typescript
interface MarkdownCardData {
  id: string;
  queryId: string;         // 新增：关联到哪个 query
  timestamp: number;
  query: string;           // 用户问题
  analysis: string;        // AI 分析过程
  summary?: string;        // 最终总结
}
```

**useTaskStore `query_summary` handler：**

`addMarkdownCard` 调用时传入 `queryId`：

```typescript
get().addMarkdownCard({
  id: `card_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  queryId: event.queryId,   // 新增
  timestamp: Date.now(),
  query: queryText,
  analysis: analysis,
  summary: event.summary,
});
```

### 3.2 组件结构

```
MarkdownCard (修改)
  ├── CardHeader (现有)
  ├── Query 区 (现有)
  ├── CardToolTimeline (新增) ← 工具时间线内嵌在这里
  │     └── ToolStreamNode[] (复用现有组件)
  ├── Analysis 区 (现有)
  └── Summary 区 (现有)

TerminalView (修改)
  └── 移除独立的 ToolStreamView（不再需要）
```

### 3.3 CardToolTimeline 组件

位置：`src/components/ToolView/CardToolTimeline.tsx`

```typescript
interface Props {
  queryId: string;
}

export function CardToolTimeline({ queryId }: Props) {
  const { nodes, toolCalls, toolProgressMessages } = useTaskStore();

  const tools = useMemo(() => {
    // 从 DAG nodes 找到 parentId === queryId 的工具
    const toolIds = new Set<string>();
    for (const node of nodes.values()) {
      if (node.type === 'tool' && node.parentId === queryId) {
        toolIds.add(node.id);
      }
    }
    return toolCalls.filter(t => toolIds.has(t.id));
  }, [nodes, toolCalls, queryId]);

  const { activeTools, completedTools } = useMemo(() => {
    const active: typeof tools = [];
    const completed: typeof tools = [];
    for (const t of tools) {
      if (t.status === 'running') active.push(t);
      else completed.push(t);
    }
    return { activeTools: active, completedTools: completed.slice(-5) }; // 最多显示最近5条已完成
  }, [tools]);

  if (tools.length === 0) return null;

  return (
    <div style={{
      padding: '6px 12px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg-bar)',
    }}>
      {activeTools.map(tool => (
        <ToolStreamNode
          key={tool.id}
          toolCall={tool}
          progress={toolProgressMessages.get(tool.id) ?? ''}
          isRunning={true}
        />
      ))}
      {completedTools.map(tool => (
        <ToolStreamNode
          key={`done-${tool.id}`}
          toolCall={tool}
          progress={toolProgressMessages.get(tool.id) ?? ''}
          isRunning={false}
        />
      ))}
    </div>
  );
}
```

### 3.4 MarkdownCard 修改

Props 新增 `queryId`：

```typescript
interface MarkdownCardProps {
  card: MarkdownCardData;
  defaultAnalysisOpen?: boolean;
}
```

在 Query 区和 Summary 区之间插入 `CardToolTimeline`：

```tsx
{/* Tool 时间线（内嵌在 query 和 summary 之间）*/}
<CardToolTimeline queryId={card.queryId} />
```

### 3.5 TerminalView 修改

- 移除 `ToolStreamView` import
- 移除 `ToolStreamView` JSX 元素
- 移除 `@keyframes tool-spin` CSS（`CardToolTimeline` 可以自己带样式）

## 4. 事件时序

**修复前（Bug）：**
```
backend: query_summary → tool_result(慢) → user_input_sent(next)
store:  addMarkdownCard → currentQueryId 变成 next
view:   MarkdownCard 出现 → ToolStreamView 变空 → tool_result 丢失
```

**修复后：**
```
backend: query_summary → tool_result → user_input_sent(next)
store:  addMarkdownCard (with queryId)
view:   MarkdownCard 渲染，用自己的 queryId 订阅工具
        tool_result 到达 → CardToolTimeline 更新（卡内工具变成完成）
```

- 工具绑定到卡片的 `queryId`，不再依赖全局 `currentQueryId`
- 即使 `currentQueryId` 切换到下一个 query，已完成卡片的工具仍然可见

## 5. 组件变更

| 文件 | 变更 |
|------|------|
| `src/types/events.ts` | `MarkdownCardData` 新增 `queryId: string` |
| `src/stores/useTaskStore.ts` | `query_summary` handler 传入 `queryId` |
| `src/components/ToolView/CardToolTimeline.tsx` | 新增，工具时间线内嵌组件，复用 `ToolStreamNode` |
| `src/components/ToolView/MarkdownCard.tsx` | 接收 `queryId`，在 Query/Summary 之间插入 `CardToolTimeline` |
| `src/components/ToolView/TerminalView.tsx` | 移除 `ToolStreamView` 和相关 CSS |

## 6. 移除的代码

- `ToolStreamView.tsx` — 功能已迁移到 `CardToolTimeline`（但保留 `ToolStreamNode.tsx`）
- `TerminalView.tsx` 中的 `<ToolStreamView>` JSX 元素
- `TerminalView.tsx` 中的 `@keyframes tool-spin` 样式
