# 工具内嵌 MarkdownCard 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复工具跑到总结后面的 Bug，将工具时间线内嵌到每个 MarkdownCard 内部，每个卡片通过 `queryId` 绑定自己的工具，不再依赖全局 `currentQueryId`。

**Architecture:** `MarkdownCardData` 新增 `queryId` 字段；新建 `CardToolTimeline` 组件，通过 DAG node 的 `parentId === queryId` 过滤工具；`TerminalView` 移除独立的 `ToolStreamView`。

**Tech Stack:** React, TypeScript, Zustand

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `src/types/events.ts` | `MarkdownCardData` 新增 `queryId` |
| `src/stores/useTaskStore.ts` | `query_summary` handler 传入 `queryId` |
| `src/components/ToolView/CardToolTimeline.tsx` | 新建，工具时间线，订阅 DAG nodes |
| `src/components/ToolView/MarkdownCard.tsx` | 接收 `queryId`，插入 `CardToolTimeline` |
| `src/components/ToolView/TerminalView.tsx` | 移除 `ToolStreamView` 和 CSS |

---

## Task 1: types/events.ts — MarkdownCardData 新增 queryId

**Files:**
- Modify: `src/types/events.ts`

### Step 1: 添加 queryId 字段

找到 `MarkdownCardData` 接口，添加 `queryId` 字段：

```typescript
export interface MarkdownCardData {
  id: string;
  queryId: string;       // 新增：该卡片关联的 query ID（用于绑定工具）
  timestamp: number;
  query: string;         // 用户问题
  analysis: string;      // AI 分析过程（Markdown）
  summary?: string;     // 最终总结
}
```

### Step 2: 验证编译

Run: `npx tsc --noEmit`
Expected: 无错误

---

## Task 2: useTaskStore.ts — query_summary handler 传入 queryId

**Files:**
- Modify: `src/stores/useTaskStore.ts`

### Step 1: 在 addMarkdownCard 调用中添加 queryId

找到 `case 'query_summary':` 内部的 `addMarkdownCard` 调用，添加 `queryId` 字段：

找到（约第 240-247 行）：

```typescript
get().addMarkdownCard({
  id: `card_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  timestamp: Date.now(),
  query: queryText,
  analysis: analysis,
  summary: event.summary,
});
```

替换为：

```typescript
get().addMarkdownCard({
  id: `card_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  queryId: event.queryId,
  timestamp: Date.now(),
  query: queryText,
  analysis: analysis,
  summary: event.summary,
});
```

### Step 2: 验证编译

Run: `npx tsc --noEmit`
Expected: 无错误

---

## Task 3: CardToolTimeline.tsx — 工具时间线组件（新建）

**Files:**
- Create: `src/components/ToolView/CardToolTimeline.tsx`

### Step 1: 写入文件

```typescript
import { useMemo } from 'react';
import { useTaskStore } from '../../stores/useTaskStore';
import { ToolStreamNode } from './ToolStreamNode';

interface Props {
  queryId: string;
}

/** 工具时间线：显示指定 query 的所有工具执行过程 */
export function CardToolTimeline({ queryId }: Props) {
  const { nodes, toolCalls, toolProgressMessages } = useTaskStore();

  // 从 DAG nodes 中找到 parentId === queryId 的所有工具节点
  const tools = useMemo(() => {
    const toolIds = new Set<string>();
    for (const node of nodes.values()) {
      if (node.type === 'tool' && node.parentId === queryId) {
        toolIds.add(node.id);
      }
    }
    return toolCalls.filter(t => toolIds.has(t.id));
  }, [nodes, toolCalls, queryId]);

  // 按状态分组：running 在前，completed/error 在后
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
    <>
      {/* CSS keyframes（内联 style 注入） */}
      <style>{`
        @keyframes tool-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div style={{
        padding: '6px 12px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-bar)',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
      }}>
        {/* Running 工具（保持在上方） */}
        {activeTools.map(tool => (
          <ToolStreamNode
            key={tool.id}
            toolCall={tool}
            progress={toolProgressMessages.get(tool.id) ?? ''}
            isRunning={true}
          />
        ))}

        {/* 已完成工具（追加新行模式） */}
        {completedTools.map(tool => (
          <ToolStreamNode
            key={`done-${tool.id}`}
            toolCall={tool}
            progress={toolProgressMessages.get(tool.id) ?? ''}
            isRunning={false}
          />
        ))}
      </div>
    </>
  );
}
```

### Step 2: 验证编译

Run: `npx tsc --noEmit`
Expected: 无错误

---

## Task 4: MarkdownCard.tsx — 接收 queryId，插入 CardToolTimeline

**Files:**
- Modify: `src/components/ToolView/MarkdownCard.tsx`

### Step 1: 添加 CardToolTimeline import

在文件顶部（React import 之后）添加：

```typescript
import { CardToolTimeline } from './CardToolTimeline';
```

### Step 2: 在 Query 区和 Summary 区之间插入 CardToolTimeline

找到 Summary 区之前的部分（约第 206-208 行附近）：

```tsx
          {/* Summary 区 */}
          {hasSummary && (
```

在 `</div>  {/* ── 内容区 ── */}` 闭合标签之前、`{/* Summary 区 */}` 之前，添加工具时间线：

```tsx
          {/* Tool 时间线（内嵌在 query 和 summary 之间） */}
          {card.queryId && <CardToolTimeline queryId={card.queryId} />}
```

完整插入位置代码段：

```tsx
          {/* Analysis 区（可折叠） */}
          {/* ... 现有代码 ... */}
          )}

          {/* Tool 时间线（内嵌在 query 和 summary 之间） */}
          {card.queryId && <CardToolTimeline queryId={card.queryId} />}

          {/* Summary 区 */}
          {hasSummary && (
```

### Step 3: 验证编译

Run: `npx tsc --noEmit`
Expected: 无错误

---

## Task 5: TerminalView.tsx — 移除 ToolStreamView

**Files:**
- Modify: `src/components/ToolView/TerminalView.tsx`

### Step 1: 移除 ToolStreamView import

找到 `import { ToolStreamView } from './ToolStreamView';` 并删除这一行。

### Step 2: 移除 CSS keyframes style 标签

找到并删除：
```tsx
{/* ToolStreamView 旋转图标动画 */}
<style>{`
  @keyframes tool-spin {
    to { transform: rotate(360deg); }
  }
`}</style>
```

### Step 3: 移除 ToolStreamView JSX 元素

找到并删除：
```tsx
        {/* 工具流展示（叠加在终端上方） */}
        <ToolStreamView theme={theme} />
```

### Step 4: 验证编译

Run: `npx tsc --noEmit`
Expected: 无错误

---

## 实现优先级与依赖

| Task | 描述 | 依赖 |
|------|------|------|
| Task 1 | types/events.ts 新增 queryId | 无 |
| Task 2 | useTaskStore 传入 queryId | Task 1 |
| Task 3 | CardToolTimeline 新建 | Task 1 |
| Task 4 | MarkdownCard 插入时间线 | Task 2 + Task 3 |
| Task 5 | TerminalView 移除 ToolStreamView | Task 4 |

顺序实施，每个 Task 完成后验证 `npx tsc --noEmit`。

## 场景覆盖检查

| 场景 | 预期行为 |
|------|---------|
| Q1 完成 → Q2 进行中 | Q1 卡片内工具全部完成，Q2 卡片内工具显示进行中 |
| tool_result 来晚了 | 工具绑定到 queryId，不受 currentQueryId 切换影响 |
| 多个并行工具 | 都显示在卡片内，最多保留最近 5 条已完成 |
| 无工具的 query | 卡片内无工具时间线区域（CardToolTimeline 返回 null） |
