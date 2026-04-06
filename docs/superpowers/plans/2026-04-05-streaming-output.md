# 流式输出实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现流式输出支持——`assistant` 消息的每个 `text` 块逐块输出到终端（`write`，不换行），Token 计数实时更新，`result` 事件不再重复输出文本。

**Architecture:** 数据流为 `AnsiParser` 解析 stream-json JSON 行 → 发出 `terminalChunk`（逐块）和 `event`（结构化）两种事件 → `server/index.ts` 广播 → `useWebSocket` 分发 → `TerminalView` 用 `term.write()` 逐块追加。关键设计：`assistant` 的 text 块通过 `terminalChunk` 流式输出，`result` 不再发 `terminalLine`（文本已在流式过程中输出完毕）。

**Tech Stack:** TypeScript, Zustand, xterm.js, WebSocket, stream-json

---

## 文件结构

```
src/types/events.ts          — 新增 WSTerminalChunkMessage 类型
server/AnsiParser.ts         — assistant text 块逐块发 terminalChunk，result 不再发 terminalLine
server/index.ts              — terminalChunk 事件广播（新增 terminalChunk case）
server/ClaudeCodeProcess.ts   — 新增 terminalChunk 事件透传
src/hooks/useWebSocket.ts    — 区分 terminalChunk 和 terminal，分发到不同 store 方法
src/stores/useTaskStore.ts   — 新增 terminalChunks[] 和 addTerminalChunk()
src/components/ToolView/TerminalView.tsx — 追加 terminalChunks，用 write() 不换行
```

---

## 任务拆解

### Task 1: 新增 `WSTerminalChunkMessage` 类型

**Files:**
- Modify: `src/types/events.ts`

- [ ] **Step 1: 添加类型**

在 `WSTerminalMessage` 后添加：

```typescript
// 服务端 → 客户端：终端流式片段（逐块追加，不换行）
export interface WSTerminalChunkMessage {
  type: 'terminalChunk';
  text: string;
  sessionId: string;
  timestamp: number;
}
```

同时更新 `useWebSocket.ts` 的 import，加入 `WSTerminalChunkMessage`。

---

### Task 2: AnsiParser — `assistant` text 块逐块发 `terminalChunk`，`result` 不再发 `terminalLine`

**Files:**
- Modify: `server/AnsiParser.ts`

- [ ] **Step 1: 新增 `terminalChunk` 事件类型常量**

在 `AnsiParser` 类顶部已有 `EventEmitter`，无需新增类型定义。只需在类中添加一个新事件名：

参考现有模式：
```typescript
parser.on('terminalChunk', (text: string) => {
  this.emit('terminalChunk', text);
});
```

- [ ] **Step 2: 修改 `parseLine` 分支**

将 JSON 解析分支拆开——`jsonToTerminalText` 改为发出 `terminalChunk`（针对 assistant text 块），`result` 不再发 `terminalLine`。

新的 `parseLine` JSON 分支：
```typescript
if (clean.startsWith('{')) {
  try {
    const obj = JSON.parse(clean) as Record<string, unknown>;
    // 结构化事件
    const events = this.jsonToEvents(obj);
    for (const event of events) {
      this.emit('event', event);
    }
    // 流式文本：assistant text 块逐块发出
    const chunks = this.jsonToTerminalChunks(obj);
    for (const chunk of chunks) {
      this.emit('terminalChunk', chunk);
    }
    return;
  } catch {
    // 不是有效 JSON
  }
}
```

- [ ] **Step 3: 将 `jsonToTerminalText` 改为 `jsonToTerminalChunks`**

删除原有 `jsonToTerminalText`，新增：

```typescript
/** 从 stream-json 对象提取终端显示文本片段（逐块流式输出） */
private jsonToTerminalChunks(obj: Record<string, unknown>): string[] {
  const chunks: string[] = [];
  const type = obj.type as string;

  if (type === 'assistant' && obj.message) {
    const msg = obj.message as Record<string, unknown>;
    const content = msg.content;
    if (Array.isArray(content)) {
      for (const block of content) {
        if (block.type === 'text') {
          const text = (block as { text: string }).text;
          if (text) chunks.push(text);
        }
        // tool_use 不在这里输出（由 jsonToEvents 处理）
      }
    }
  }
  // result 不再发任何 terminalChunk/text（文本已在 assistant 流式输出完毕）
  return chunks;
}
```

**关键行为变更：**
- `assistant` text 块：逐块追加到终端（`write`，不换行）
- `assistant` tool_use：**不再**通过 `jsonToTerminalText` 输出（已在 `jsonToEvents` 中处理为 `tool_call` 事件，DAG/卡片渲染）
- `result`：**不再**发 `terminalLine`（文本已在流式过程中输出完毕）

---

### Task 3: ClaudeCodeProcess — 透传 `terminalChunk` 事件

**Files:**
- Modify: `server/ClaudeCodeProcess.ts`

- [ ] **Step 1: 添加 `terminalChunk` 事件监听和转发**

在现有 `parser.on('terminalLine', ...)` 后添加：

```typescript
parser.on('terminalChunk', (text: string) => {
  this.emit('terminalChunk', { text, sessionId, timestamp: Date.now() });
});
```

---

### Task 4: server/index.ts — 广播 `terminalChunk` 事件

**Files:**
- Modify: `server/index.ts`

- [ ] **Step 1: 添加 `terminalChunk` 事件监听**

在现有的 `processManager.on('terminalLine', ...)` 后添加：

```typescript
processManager.on('terminalChunk', (payload: { text: string; sessionId: string; timestamp: number }) => {
  if (payload.sessionId === sessionId) {
    broadcast(sessionId, JSON.stringify({
      type: 'terminalChunk',
      text: payload.text,
      sessionId: payload.sessionId,
      timestamp: payload.timestamp,
    }));
  }
});
```

---

### Task 5: useWebSocket — 区分 `terminalChunk` 和 `terminal` 分发到不同 store 方法

**Files:**
- Modify: `src/hooks/useWebSocket.ts`

- [ ] **Step 1: 更新 import**

```typescript
import type { WSMessage, WSClientMessage, WSTerminalMessage, WSTerminalChunkMessage } from '../types/events';
```

- [ ] **Step 2: 从 store 获取 `addTerminalChunk`**

```typescript
const { handleEvent, addTerminalLine, addTerminalChunk, reset } = useTaskStore();
```

- [ ] **Step 3: 修改 `ws.onmessage` 分发逻辑**

```typescript
ws.onmessage = (event) => {
  try {
    const msg = event.data;
    const parsed = JSON.parse(msg);
    if ('type' in parsed) {
      if (parsed.type === 'terminalChunk') {
        addTerminalChunk((parsed as WSTerminalChunkMessage).text);
        return;
      }
      if (parsed.type === 'terminal') {
        addTerminalLine((parsed as WSTerminalMessage).text);
        return;
      }
    }
    // 其他结构化事件
    handleEvent((parsed as WSMessage).event!);
  } catch {
    addTerminalLine(event.data);
  }
};
```

---

### Task 6: useTaskStore — 新增 `terminalChunks` 数组和 `addTerminalChunk` 方法

**Files:**
- Modify: `src/stores/useTaskStore.ts`

- [ ] **Step 1: 添加 state 字段**

```typescript
interface TaskState {
  nodes: Map<string, DAGNode>;
  toolCalls: ToolCall[];
  tokenUsage: TokenUsage;
  terminalLines: string[];
  terminalChunks: string[]; // 流式片段（不换行追加）
  isRunning: boolean;
  isStarting: boolean;
  error: string | null;

  handleEvent: (event: ClaudeEvent) => void;
  addTerminalLine: (line: string) => void;
  addTerminalChunk: (fragment: string) => void; // 新增
  reset: () => void;
}
```

- [ ] **Step 2: 初始化**

```typescript
export const useTaskStore = create<TaskState>((set, get) => ({
  // ... existing fields ...
  terminalChunks: [],
  // ...
}));
```

- [ ] **Step 3: 实现 `addTerminalChunk`**

```typescript
addTerminalChunk: (fragment: string) => {
  set(state => ({
    terminalChunks: [...state.terminalChunks, fragment]
  }));
},
```

- [ ] **Step 4: 更新 `reset` 方法**

在 `reset` 中加入 `terminalChunks: []`。

---

### Task 7: TerminalView — 追加 `terminalChunks` 用 `write()` 不换行

**Files:**
- Modify: `src/components/ToolView/TerminalView.tsx`

- [ ] **Step 1: 从 store 获取 `terminalChunks`**

```typescript
const { terminalLines, terminalChunks, isStarting, isRunning, error } = useTaskStore();
```

- [ ] **Step 2: 添加 `shownFragmentsRef`**

在现有的 `shownLinesRef` 旁边：

```typescript
const shownFragmentsRef = useRef(0);
```

- [ ] **Step 3: 新增 `useEffect` 处理流式片段**

在 `useEffect` 处理 `terminalLines` 后添加：

```typescript
// 追加新片段（逐块流式输出，不换行）
useEffect(() => {
  const term = terminalRef.current;
  if (!term || terminalChunks.length <= shownFragmentsRef.current) return;

  const newFragments = terminalChunks.slice(shownFragmentsRef.current);
  shownFragmentsRef.current = terminalChunks.length;

  for (const fragment of newFragments) {
    // 直接写入终端（已是原始文本，含 ANSI 颜色码），不换行
    term.write(fragment);
  }
}, [terminalChunks]);
```

- [ ] **Step 4: 更新 `reset` 清理 ref**

在 `return () => { ... }` 中添加 `shownFragmentsRef.current = 0;`。

---

## 自检清单

1. **Spec 覆盖检查：**
   - `WSTerminalChunkMessage` 类型 → Task 1 ✅
   - AnsiParser assistant text 块逐块发出 → Task 2 ✅
   - AnsiParser result 不发 terminalLine → Task 2 ✅
   - server 透传 terminalChunk → Task 3 ✅
   - server/index.ts 广播 terminalChunk → Task 4 ✅
   - useWebSocket 区分两种类型 → Task 5 ✅
   - store terminalChunks 数组 + addTerminalChunk → Task 6 ✅
   - TerminalView write() 不换行 → Task 7 ✅

2. **占位符扫描：** 无 TBD/TODO，所有步骤包含完整代码。

3. **类型一致性：**
   - `WSTerminalChunkMessage.type === 'terminalChunk'` 在 Task 1、4、5 一致
   - `addTerminalChunk` 方法名在 Task 5、6 一致
   - `terminalChunks` 数组在 Task 6、7 一致
   - `shownFragmentsRef` ref 名在 Task 7 内一致

---

## 执行方式

**Two execution options:**

**1. Subagent-Driven (recommended)** - 逐任务派遣 subagent，spec 合规审查 + 代码质量审查

**2. Inline Execution** - 本 session 执行，checkpoint 审查
