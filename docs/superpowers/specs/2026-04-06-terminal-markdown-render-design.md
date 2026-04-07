# Terminal Markdown Rendering + Process Collapse

> **Goal:** Render AI final answers as Markdown in the terminal area, while collapsing tool-calling process logs automatically after the answer completes.

## 1. Problem Statement

Currently the terminal (xterm.js) strips all Markdown syntax via `stripMarkdown()` and renders everything as plain text. AI answers lose all formatting: code blocks, tables, headings, bold/italic, etc.

## 2. Architecture

### Current State

- `TerminalView.tsx` uses `@xterm/xterm` for terminal rendering
- All AI output goes through `writeChunk()` → `stripMarkdown()` → plain text
- xterm.js only supports plain text + ANSI color codes (no HTML/Markdown)
- Tool call logs (`terminalLines`) and stream chunks (`terminalChunks`) both written directly to xterm

### Target State

```
┌────────────────────────────────────────┐
│  Status bar (connection / token)       │
├────────────────────────────────────────┤
│  ▼ 工具调用过程              [收起]    │  ← Collapsible region
│    ››› Bash: ls -la                   │
│    ››› Read: src/...                │
├────────────────────────────────────────┤
│  ✦ 回答总结                           │  ← Markdown card
│  ──────────────────────────────────── │
│  ## 分析结果                           │
│  根据以上数据，**茅台**表现良好...     │
│  - 代码块支持滚动                     │
│  - 表格正常显示                        │
├────────────────────────────────────────┤
│  › [输入框]                           │
└────────────────────────────────────────┘
```

## 3. Component Changes

### 3.1 New: `MarkdownCard` component

A collapsible React component that renders `ReactMarkdown` with `remarkGfm`.

**Location:** `src/components/ToolView/MarkdownCard.tsx` (new file)

**Props:**
```typescript
interface MarkdownCardProps {
  content: string;           // Markdown string
  defaultOpen?: boolean;     // Start expanded or collapsed
  label?: string;           // Header label, default "回答总结"
}
```

**Styling:**
- Border-left accent color `var(--success)` or `var(--accent)`
- Background slightly lighter than terminal
- Max-height with scroll for long content
- Full Markdown element styling (same as DAGNode summary)

### 3.2 `TerminalView.tsx` refactor

**Separate data streams:**

| Stream | Handler | Renderer |
|--------|---------|----------|
| `terminalLines` | Raw terminal output (tool logs) | xterm.js |
| `terminalChunks` | Stream fragments (accumulated) | Rendered as MarkdownCard on streamEnd |
| `query_summary` | AI final answer (from store) | Rendered as MarkdownCard |

**Changes:**
1. Remove `stripMarkdown()` usage for AI stream chunks
2. Keep xterm.js for: user input echo, command output, tool call logs
3. On `streamEndPending`: flush accumulated `terminalChunks` into a `MarkdownCard`
4. On `query_summary` event: render final Markdown answer card

**Collapse behavior:**
- When a new `streamEnd` fires → auto-collapse the previous process block
- When a new `query_summary` fires → render summary card below, previous summary card remains visible (history)
- "工具调用过程" collapsible region shows/hides accumulated `terminalLines`

### 3.3 Store: `useTaskStore.ts`

New state fields:
```typescript
interface TaskState {
  // ... existing fields
  markdownCards: MarkdownCardData[];  // Array of rendered markdown cards
}

interface MarkdownCardData {
  id: string;
  content: string;
  timestamp: number;
}
```

New actions:
- `addMarkdownCard(content: string)` — called on `streamEnd` with accumulated chunks
- `clearStreamEnd()` — existing, also clears the pending chunk accumulator

**Event handling:**
- `streamEnd`: accumulate `terminalChunks` → call `addMarkdownCard` → clear chunks
- `query_summary`: call `addMarkdownCard` with `event.summary`

### 3.4 CSS / Theming

```css
/* Markdown card in terminal */
.markdown-card {
  border-left: 3px solid var(--success);
  background: var(--bg-card);
  border-radius: 8px;
  margin: 8px 0;
  overflow: hidden;
}
.markdown-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 11px;
  color: var(--text-muted);
  user-select: none;
}
.markdown-card-body {
  padding: 8px 12px;
  max-height: 400px;
  overflow-y: auto;
  border-top: 1px solid var(--border);
}

/* Process collapse region */
.process-region {
  border: 1px solid var(--border);
  border-radius: 6px;
  margin-bottom: 8px;
  overflow: hidden;
}
.process-region-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background: var(--bg-bar);
  cursor: pointer;
  font-size: 11px;
  color: var(--text-muted);
}
```

## 4. Data Flow

```
Claude Code output
    │
    ├── stream-json tool_use / result → terminalLines → xterm.js (tool logs)
    │
    └── stream-json text block → terminalChunks (accumulated)

streamEnd event
    │
    ├── accumulate terminalChunks → addMarkdownCard() → render MarkdownCard
    │
    └── clear terminalChunks

query_summary event
    │
    └── addMarkdownCard(event.summary) → render final answer card

Collapse trigger
    │
    └── On new streamEnd → collapse previous process region
```

## 5. Key Decisions

### Decision 1: Keep xterm.js for tool logs

xterm.js is replaced by a React-rendered `MarkdownCard` for AI content only. Tool logs and user input stay in xterm.js to preserve:
- ANSI color output from real commands
- Command echo and cursor behavior
- Fast rendering of large outputs

### Decision 2: MarkdownCard array for history

Each completed answer creates a new `MarkdownCard`. All cards are kept in a scrollable list (newest at top or bottom). This preserves conversation history naturally.

### Decision 3: Auto-collapse on streamEnd

When a new `streamEnd` fires (new response starting), the previous process region automatically collapses to minimize visual noise. User can still expand it to review the previous tool call logs.

## 6. Files to Modify

| File | Change |
|------|--------|
| `src/components/ToolView/TerminalView.tsx` | Refactor: separate terminalLines (xterm) from markdownCards (React), remove stripMarkdown for chunks |
| `src/components/ToolView/MarkdownCard.tsx` | New: collapsible Markdown rendering component |
| `src/stores/useTaskStore.ts` | Add `markdownCards` array, `addMarkdownCard()` action, handle `query_summary` |
| `src/types/events.ts` | Already has `query_summary` event |
| `src/styles/theme.css` | Add `.markdown-card`, `.process-region` styles |

## 7. Testing Scenarios

1. Send a simple text reply → single MarkdownCard appears with correct rendering
2. Send a query that triggers tools → process logs in xterm, then collapsed; MarkdownCard appears below
3. Multiple queries in one session → each creates a MarkdownCard, previous ones remain visible
4. Long Markdown (code blocks, tables) → scrollable within card, no overflow
5. Theme toggle → MarkdownCard respects dark/light theme variables
