# Terminal Markdown Rendering 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在终端区域渲染 AI 最终回答为 Markdown，工具调用过程日志自动折叠到可收起的区域。

**Architecture:**
- xterm.js 保留，仅用于工具调用日志（`terminalLines`）和命令输出
- AI 流式回答片段（`terminalChunks`）累积后在 `streamEnd` 时合并为一张 `MarkdownCard`（ReactMarkdown 渲染）
- `query_summary` 事件触发时创建最终总结的 MarkdownCard
- 所有 MarkdownCard 保留历史，形成对话记录

**Tech Stack:** React, Zustand, @xterm/xterm, react-markdown, remark-gfm

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/components/ToolView/MarkdownCard.tsx` | **新建** | 可折叠的 Markdown 渲染组件 |
| `src/stores/useTaskStore.ts` | 修改 | 添加 `markdownCards` 数组、`addMarkdownCard()`、`processCollapsed` |
| `src/components/ToolView/TerminalView.tsx` | 修改 | 移除 chunks→xterm 逻辑，改为渲染 MarkdownCard 列表 |
| `src/styles/theme.css` | 修改 | 添加 `.markdown-card`、`.process-region` 样式 |

---

## Task 1: 添加 Store 状态和 Action

**文件:**
- 修改: `src/stores/useTaskStore.ts`

- [ ] **Step 1: 添加 MarkdownCard 数据类型和 state**

在 `TaskState` 接口中添加：

```typescript
interface MarkdownCardData {
  id: string;
  content: string;
  label?: string;
  timestamp: number;
}

interface TaskState {
  // ... 现有字段
  markdownCards: MarkdownCardData[];
  processCollapsed: boolean; // 工具调用过程是否折叠

  // ... 现有 actions
  addMarkdownCard: (content: string, label?: string) => void;
  toggleProcessCollapsed: (collapsed: boolean) => void;
  reset: () => void;
}
```

- [ ] **Step 2: 实现 `addMarkdownCard` action**

在 store 的 actions 对象中添加：

```typescript
addMarkdownCard: (content: string, label?: string) => void;
```

实现：
```typescript
addMarkdownCard: (content: string, label?: string) => {
  const card: MarkdownCardData = {
    id: `card_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    content: content.trim(),
    label: label ?? '✦ 回答总结',
    timestamp: Date.now(),
  };
  set(state => ({ markdownCards: [...state.markdownCards.slice(-50), card] }));
},
```

- [ ] **Step 3: 实现 `toggleProcessCollapsed` action**

```typescript
toggleProcessCollapsed: (collapsed: boolean) => {
  set({ processCollapsed: collapsed });
},
```

- [ ] **Step 4: 更新 `reset` action**

在 reset 中添加：
```typescript
reset: () => {
  set({
    // ... 现有字段
    markdownCards: [],
    processCollapsed: false,
  });
},
```

- [ ] **Step 5: 在 `handleEvent` 的 `streamEnd` 分支中调用 `addMarkdownCard`**

将：
```typescript
case 'streamEnd': {
  set({ streamEndPending: true });
  break;
}
```

改为：
```typescript
case 'streamEnd': {
  // 将累积的 terminalChunks 合并为一张 MarkdownCard
  const { terminalChunks } = get();
  const content = terminalChunks.join('');
  if (content.trim()) {
    get().addMarkdownCard(content, '✦ 回答总结');
  }
  // 清空 chunks，折叠过程日志
  set({ streamEndPending: true, terminalChunks: [], processCollapsed: true });
  break;
}
```

- [ ] **Step 6: 在 `query_summary` 分支中调用 `addMarkdownCard`**

在 `query_summary` 分支末尾添加：
```typescript
get().addMarkdownCard(event.summary, '✦ 最终总结');
```

注意：这行在 `set({ nodes: newNodesQS })` 之后调用，因为 `addMarkdownCard` 读取 `get()` 最新状态。

- [ ] **Step 7: 提交**

```bash
git add src/stores/useTaskStore.ts
git commit -m "feat(terminal): add markdownCards state and addMarkdownCard action"
```

---

## Task 2: 创建 MarkdownCard 组件

**文件:**
- 创建: `src/components/ToolView/MarkdownCard.tsx`

- [ ] **Step 1: 编写 MarkdownCard 组件**

```typescript
import React, { memo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export interface MarkdownCardData {
  id: string;
  content: string;
  label?: string;
  timestamp: number;
}

interface MarkdownCardProps {
  card: MarkdownCardData;
  defaultOpen?: boolean;
}

// Markdown 元素样式（与 DAGNode.tsx 保持一致）
const markdownStyles: Record<string, React.CSSProperties> = {
  h1: { fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '8px 0 4px' },
  h2: { fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: '6px 0 3px' },
  h3: { fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', margin: '4px 0 2px' },
  p: { margin: '4px 0' },
  ul: { paddingLeft: 16, margin: '4px 0' },
  ol: { paddingLeft: 16, margin: '4px 0' },
  li: { margin: '2px 0' },
  code: {
    background: 'rgba(255,255,255,0.06)',
    borderRadius: 3,
    padding: '1px 4px',
    fontSize: 10,
    fontFamily: "'JetBrains Mono', monospace",
    color: 'var(--accent)',
  },
  pre: {
    background: 'rgba(0,0,0,0.3)',
    borderRadius: 6,
    padding: '8px 10px',
    overflowX: 'auto',
    margin: '6px 0',
  },
  'pre code': {
    background: 'transparent',
    padding: 0,
    color: 'var(--text-secondary)',
    fontSize: 10,
  },
  blockquote: {
    borderLeft: '3px solid var(--success)',
    paddingLeft: 8,
    color: 'var(--text-muted)',
    margin: '4px 0',
    fontStyle: 'italic' as const,
  },
  table: { width: '100%', borderCollapse: 'collapse' as const, margin: '6px 0', fontSize: 10 },
  th: { borderBottom: '1px solid var(--border)', padding: '3px 6px', textAlign: 'left' as const, color: 'var(--text-primary)' },
  td: { borderBottom: '1px solid var(--border)', padding: '3px 6px', color: 'var(--text-secondary)' },
  a: { color: 'var(--accent)', textDecoration: 'none' },
  strong: { color: 'var(--text-primary)', fontWeight: 600 },
  em: { fontStyle: 'italic' as const },
  hr: { border: 'none', borderTop: '1px solid var(--border)', margin: '8px 0' },
};

function MarkdownCardInner({ card, defaultOpen = true }: MarkdownCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="markdown-card" style={{
      borderLeft: '3px solid var(--success)',
      background: 'var(--bg-card)',
      borderRadius: 8,
      margin: '8px 0',
      overflow: 'hidden',
      border: '1px solid var(--border-card)',
    }}>
      {/* Header */}
      <div
        className="markdown-card-header"
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          cursor: 'pointer',
          fontSize: 11,
          color: 'var(--success)',
          userSelect: 'none',
          background: 'var(--success-bg)',
          transition: 'background 0.2s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--success-border)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--success-bg)')}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ transition: 'transform 200ms', transform: open ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-flex' }}>▶</span>
          {card.label ?? '✦ 回答总结'}
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
          {open ? '收起' : '展开'}
        </span>
      </div>

      {/* Body */}
      <div style={{
        maxHeight: open ? 'none' : 0,
        overflow: 'hidden',
        transition: 'max-height 250ms ease-out',
      }}>
        <div style={{
          padding: '8px 12px',
          maxHeight: 400,
          overflowY: 'auto',
          borderTop: '1px solid var(--border)',
        }}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => <h1 style={markdownStyles.h1}>{children}</h1>,
              h2: ({ children }) => <h2 style={markdownStyles.h2}>{children}</h2>,
              h3: ({ children }) => <h3 style={markdownStyles.h3}>{children}</h3>,
              p: ({ children }) => <p style={markdownStyles.p}>{children}</p>,
              ul: ({ children }) => <ul style={markdownStyles.ul}>{children}</ul>,
              ol: ({ children }) => <ol style={markdownStyles.ol}>{children}</ol>,
              li: ({ children }) => <li style={markdownStyles.li}>{children}</li>,
              code: ({ className, children, ...props }) => {
                const isBlock = className?.startsWith('language-');
                return isBlock
                  ? <code style={markdownStyles['pre code']} className={className} {...props}>{children}</code>
                  : <code style={markdownStyles.code} {...props}>{children}</code>;
              },
              pre: ({ children }) => <pre style={markdownStyles.pre}>{children}</pre>,
              blockquote: ({ children }) => <blockquote style={markdownStyles.blockquote}>{children}</blockquote>,
              table: ({ children }) => <table style={markdownStyles.table}>{children}</table>,
              th: ({ children }) => <th style={markdownStyles.th}>{children}</th>,
              td: ({ children }) => <td style={markdownStyles.td}>{children}</td>,
              a: ({ children, href }) => <a style={markdownStyles.a} href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
              strong: ({ children }) => <strong style={markdownStyles.strong}>{children}</strong>,
              em: ({ children }) => <em style={markdownStyles.em}>{children}</em>,
              hr: () => <hr style={markdownStyles.hr} />,
            }}
          >
            {card.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

export const MarkdownCard = memo(MarkdownCardInner);
```

- [ ] **Step 2: 提交**

```bash
git add src/components/ToolView/MarkdownCard.tsx
git commit -m "feat(terminal): add MarkdownCard component with collapsible header"
```

---

## Task 3: 重构 TerminalView.tsx

**文件:**
- 修改: `src/components/ToolView/TerminalView.tsx`

- [ ] **Step 1: 添加 MarkdownCard import，移除 stripMarkdown 相关的 effects**

保留 `writeChunk`、`stripMarkdown` 函数（工具调用过程的原始日志仍需格式化），但移除 `terminalChunks` → xterm 的 useEffect。

删除这个 effect：
```typescript
// 追加新片段（逐块流式输出，不换行）
useEffect(() => {
  const term = terminalRef.current;
  if (!term || terminalChunks.length <= shownFragmentsRef.current) return;

  const newFragments = terminalChunks.slice(shownFragmentsRef.current);
  shownFragmentsRef.current = terminalChunks.length;

  for (const fragment of newFragments) {
    writeChunk(term, fragment); // 清理 Markdown，处理内嵌换行
  }
}, [terminalChunks]);
```

同时删除 `shownFragmentsRef`。

- [ ] **Step 2: 添加 MarkdownCard 相关状态**

在组件中添加：
```typescript
const { markdownCards, processCollapsed, toggleProcessCollapsed } = useTaskStore();
```

从 store 解构中移除 `terminalChunks`（不再使用），添加 `markdownCards`。

- [ ] **Step 3: 重构 JSX 结构**

将原来的单一 xterm 容器改为**三段式布局**：

```tsx
return (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%' }}>
    {/* 顶部状态栏（保持不变） */}
    <StatusBar ... />

    {/* 主内容区：可滚动 */}
    <div style={{
      flex: 1,
      overflow: 'auto',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* MarkdownCard 列表（最新在底部） */}
      {markdownCards.length > 0 && (
        <div style={{ padding: '0 4px' }}>
          {markdownCards.map(card => (
            <MarkdownCard key={card.id} card={card} defaultOpen={true} />
          ))}
        </div>
      )}

      {/* 工具调用过程（xterm） */}
      <div
        ref={containerRef}
        style={{
          height: processCollapsed ? 0 : undefined, // 折叠时高度为 0
          minHeight: processCollapsed ? 0 : '120px', // 折叠时完全隐藏
          flex: processCollapsed ? 0 : undefined,
          background: 'var(--term-bg)',
          border: '1px solid var(--term-border)',
          borderTop: 'none',
          padding: '12px 8px 12px 12px',
          overflow: 'hidden',
          transition: 'all 0.3s',
          display: processCollapsed ? 'none' : 'block',
        }}
      />
    </div>

    {/* 输入框（保持不变） */}
    <InputBar ... />
  </div>
);
```

**重要调整：** xterm 容器高度折叠时设为 0 且 `display: none`，避免 FitAddon 在折叠时尝试 fit 导致的布局抖动。**不要在 xterm 所在 div 上使用 `display: none`**，因为 xterm 在隐藏状态下 `clientHeight = 0`，导致 fit 失效——改为用条件渲染 `&&` 替代，或在折叠时用 `height: 0; overflow: hidden`。

- [ ] **Step 4: 移除流式片段追加逻辑，保留工具日志追加**

原来的 `terminalChunks` useEffect 要删除（AI 内容不再写 xterm），但保留 `terminalLines` useEffect（工具日志仍然走 xterm）。

- [ ] **Step 5: 调整 handleInputKeyDown 中的分隔线逻辑**

当 `markdownCards.length > 0` 时在发送前写分隔线（保持不变），但不再写 chunks。

- [ ] **Step 6: 提交**

```bash
git add src/components/ToolView/TerminalView.tsx
git commit -m "refactor(terminal): separate xterm (tool logs) from MarkdownCard (AI answers)"
```

---

## Task 4: 添加 CSS 样式

**文件:**
- 修改: `src/styles/theme.css`

- [ ] **Step 1: 在 theme.css 末尾添加样式**

```css
/* ================================================
   MarkdownCard
   ================================================ */
.markdown-card {
  border-left: 3px solid var(--success);
  background: var(--bg-card);
  border-radius: 8px;
  margin: 8px 0;
  overflow: hidden;
  border-top: 1px solid var(--border);
  border-right: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}

.markdown-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 11px;
  user-select: none;
  transition: background 0.2s;
}

/* ================================================
   Process region (工具调用过程折叠区)
   ================================================ */
.process-region {
  border: 1px solid var(--term-border);
  border-top: none;
  overflow: hidden;
  transition: all 0.3s ease;
}
```

- [ ] **Step 2: 提交**

```bash
git add src/styles/theme.css
git commit -m "style(terminal): add markdown-card and process-region CSS"
```

---

## Task 5: 整体测试

**Files:**
- 测试: `src/components/ToolView/TerminalView.tsx`
- 测试: `src/stores/useTaskStore.ts`
- 测试: `src/components/ToolView/MarkdownCard.tsx`

- [ ] **Step 1: 启动应用，用浏览器测试**

```bash
cd /Users/ouguangji/2026/cc-web-ui && npm run dev
```

在浏览器中：
1. 发送一个简单问题（无工具调用）→ 验证 MarkdownCard 出现，Markdown 格式正确渲染（粗体、代码块、列表）
2. 发送一个会触发工具调用的问题 → 验证工具日志在 xterm 中，AI 回答完成后自动折叠，形成一张 MarkdownCard
3. 多次发送 → 验证每条回答都生成独立的 MarkdownCard，历史保留
4. 主题切换（暗/亮）→ 验证 MarkdownCard 颜色变量正确响应

- [ ] **Step 2: 提交**

```bash
git add .
git commit -m "feat(terminal): render AI answers as Markdown, auto-collapse tool process logs"
```

---

## 自检清单

**Spec 覆盖检查：**
- [x] `MarkdownCard` 组件 - Task 2
- [x] `markdownCards` 数组 in store - Task 1
- [x] `addMarkdownCard()` action - Task 1
- [x] `streamEnd` 时 flush chunks → card - Task 1
- [x] `query_summary` 时创建总结 card - Task 1
- [x] xterm.js 保留工具日志 - Task 3
- [x] AI 内容走 ReactMarkdown - Task 3
- [x] `processCollapsed` 折叠机制 - Task 3
- [x] CSS 样式 - Task 4

**占位符扫描：** 无 "TBD"、"TODO"、placeholder

**类型一致性：**
- `MarkdownCardData.id` = `string` ✅
- `addMarkdownCard(content, label?)` ✅
- `processCollapsed: boolean` ✅
- `MarkdownCard` 使用 `memo` + `card: MarkdownCardData` ✅
