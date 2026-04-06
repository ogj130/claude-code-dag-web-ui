# 流式输出支持设计

## 目标

Claude Code stream-json 模式下，将一次性整行输出改为流式逐块输出，让终端体验接近真实交互——字符逐块出现，Token 计数实时增长，工具调用立即渲染。

## 当前状态

- `result` 事件触发一次性完整文本输出
- Token 计数只在 `result` 的 `usage` 字段更新
- `assistant` 消息的文本块被丢弃，只输出 `tool_use` 工具名

## 数据流

```
Claude stdout JSON line
  → AnsiParser.parseLine()
      ├→ jsonToEvents() → 'event' → WS → handleEvent() → store → DAG/卡片
      └→ jsonToTerminalText() → 'terminalChunk' (新增)
            ↓
       WS broadcast { type:'terminalChunk', text, sessionId, timestamp }
            ↓
       useWebSocket onmessage: addTerminalChunk(text)
            ↓
       TerminalView: term.write(text) ← 逐块追加，不换行
```

## 新增消息类型

`src/types/events.ts` 新增：

```typescript
export interface WSTerminalChunkMessage {
  type: 'terminalChunk';
  text: string;   // ANSI 带色文本片段
  sessionId: string;
  timestamp: number;
}
```

与现有 `WSTerminalMessage`（整行，`writeln`）共存：
- `terminal`：普通输出行
- `terminalChunk`：流式片段，`write`

## 改动文件

### `src/types/events.ts`
- 新增 `WSTerminalChunkMessage` 类型

### `server/AnsiParser.ts`
- `jsonToTerminalText()`：对 `assistant` 消息的每个 `text` 块逐块发出 `terminalLine` 事件（作为 chunk）
- 对 `result` 事件：不再发 `terminalLine`（文本已流式输出完毕）

### `server/ClaudeCodeProcess.ts`
- 无需改动，`terminalLine` 事件已由 AnsiParser 发出

### `server/index.ts`
- 无需改动，`terminalLine` 事件转发逻辑已存在

### `src/hooks/useWebSocket.ts`
- 区分 `terminalChunk` 和 `terminal` 类型
- `terminalChunk` → `addTerminalChunk(text)`（新增 store 方法）
- `terminal` → `addTerminalLine(text)`（现有）

### `src/stores/useTaskStore.ts`
- 新增 `addTerminalChunk(fragment: string)` 方法
- `handleEvent` 中 `assistant` 消息的 token_usage：实时更新（每个 assistant 消息都触发）

### `src/components/ToolView/TerminalView.tsx`
- 新增 `shownFragmentsRef` 追踪已渲染片段数
- `terminalChunks` 数组（追加片段，不设上限）
- 新增 `useEffect` 监听 `terminalChunks`：对每个新片段执行 `term.write(fragment)`（不换行）
- 保留 `terminalLines` 整行输出逻辑（`writeln`）

## 关键行为

1. **逐块追加**：`terminalChunk` 执行 `write`（不换行），`terminal` 执行 `writeln`
2. **Token 实时**：每个 `assistant` 消息触发 `token_usage` 事件，立即更新 TokenBar
3. **工具调用优先**：`tool_use` 通过 `event` → `handleEvent` 立即渲染到 DAG/卡片
4. **result 事件**：不再发 `terminalLine`（文本已在流式过程中输出完毕）

## 无需改动

- `DAGCanvas`、`DAGNode`、`ToolCards`：只通过 `handleEvent` 更新，不感知流式
- `sendInput` 逻辑不变
