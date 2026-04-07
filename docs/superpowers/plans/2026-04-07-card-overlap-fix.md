# 多 Query 并发卡片重叠修复实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复多 query 并发时卡片数据（analysis）相互覆盖的问题，通过将 `pendingAnalysis` 从单值改为按 queryId 隔离的 Map，并在 WebSocket 层为 `streamEnd` 注入正确的 queryId。

**Architecture:** `pendingAnalysis` 从 `string` 改为 `Map<queryId, string>`，key 为 queryId。`streamEnd` 事件携带 queryId，由 WebSocket 层注入正确值，确保每个 query 的 analysis 内容独立存储，独立读取。

**Tech Stack:** TypeScript, Zustand, WebSocket

---

## Task 1: streamEnd 类型加 queryId 字段

**Files:**
- Modify: `src/types/events.ts`

- [ ] **Step 1: 修改 streamEnd 类型**

打开 `src/types/events.ts`，找到：

```typescript
export type ClaudeEvent =
  | { type: 'agent_start'; agentId: string; label: string; parentId?: string }
  // ... 其他类型
  | { type: 'streamEnd' }
  | { type: 'user_input_sent'; queryId: string; text: string }
```

将 `{ type: 'streamEnd' }` 改为：

```typescript
  | { type: 'streamEnd'; queryId?: string }
```

## Task 2: useWebSocket.ts 注入 streamEnd queryId

**Files:**
- Modify: `src/hooks/useWebSocket.ts`

**关键背景：** `pendingInputsRef.current` 数组中，第一个元素（索引 0）是当前正在处理的 query 的 ID。队列先进先出处理，`streamEnd` 到达时栈顶即为对应的 queryId。

- [ ] **Step 1: 修改 streamEnd 分支注入 queryId**

打开 `src/hooks/useWebSocket.ts`，找到 `ws.onmessage` 中 `handleEvent(evt)` 调用的位置，以及 `streamEnd` 处理块。

**在 `handleEvent(evt)` 之前**，添加 queryId 注入：

```typescript
// ws.onmessage 内部，在 parse 后
const evt = (parsed as WSMessage).event;
if (evt) {
  // streamEnd 时注入正确的 queryId（pendingInputsRef[0] 是当前正在处理的 query）
  if (evt.type === 'streamEnd') {
    const queryId = pendingInputsRef.current[0] ?? useTaskStore.getState().currentQueryId;
    handleEvent({ ...evt, queryId } as ClaudeEvent);
  } else {
    handleEvent(evt);
  }
}
```

**将原有的**：
```typescript
const evt = (parsed as WSMessage).event;
if (evt) handleEvent(evt);

// 处理 streamEnd：complete 当前 query，检查队列
if (evt?.type === 'streamEnd') {
```
**替换为**（事件处理逻辑保持不变，仅把 streamEnd 分支的 `handleEvent` 移入上面的 if 块）：

```typescript
const evt = (parsed as WSMessage).event;
if (evt) {
  if (evt.type === 'streamEnd') {
    const queryId = pendingInputsRef.current[0] ?? useTaskStore.getState().currentQueryId;
    handleEvent({ ...evt, queryId } as ClaudeEvent);
  } else {
    handleEvent(evt);
  }
}

// 处理 streamEnd：complete 当前 query，检查队列
if (evt?.type === 'streamEnd') {
```

**注意**：`ClaudeEvent` 类型导入需确认已存在（检查文件顶部 `import type { ... }`）。

## Task 3: pendingAnalysis 改为 Map

**Files:**
- Modify: `src/stores/useTaskStore.ts`

- [ ] **Step 1: 修改 interface 定义**

在 `TaskState` 接口中，将：

```typescript
pendingAnalysis: string;  // 当前累积的分析内容
```

改为：

```typescript
pendingAnalysisByQueryId: Map<string, string>;  // 按 queryId 隔离的分析内容
```

- [ ] **Step 2: 修改初始值**

将初始 state 中的 `pendingAnalysis: ''` 改为 `pendingAnalysisByQueryId: new Map()`。

- [ ] **Step 3: 修改 streamEnd 处理**

在 `handleEvent` 的 `case 'streamEnd':` 中，将：

```typescript
const { terminalChunks } = get();
const analysis = terminalChunks.join('');
set({
  streamEndPending: true,
  terminalChunks: [],
  processCollapsed: true,
  pendingAnalysis: analysis,
});
```

改为：

```typescript
const { terminalChunks } = get();
const analysis = terminalChunks.join('');
const queryId = (event as Extract<ClaudeEvent, { type: 'streamEnd' }>).queryId
  ?? get().currentQueryId
  ?? 'unknown';
const newMap = new Map(get().pendingAnalysisByQueryId);
newMap.set(queryId, analysis);
set({
  streamEndPending: true,
  terminalChunks: [],
  processCollapsed: true,
  pendingAnalysisByQueryId: newMap,
});
```

- [ ] **Step 4: 修改 query_summary 处理**

在 `case 'query_summary':` 中，将 `const { pendingAnalysis } = get()` 及其后续使用改为：

```typescript
const { pendingAnalysisByQueryId } = get();
const analysis = pendingAnalysisByQueryId.get(event.queryId) ?? '';
const newMap = new Map(pendingAnalysisByQueryId);
newMap.delete(event.queryId);
```

将 `analysis: pendingAnalysis` 改为 `analysis`，并将 `set({ nodes: newNodesQS, pendingAnalysis: '' })` 改为 `set({ nodes: newNodesQS, pendingAnalysisByQueryId: newMap })`。

- [ ] **Step 5: 修改 reset()**

将 `pendingAnalysis: ''` 改为 `pendingAnalysisByQueryId: new Map()`。

---

**Spec 覆盖自检：**
- [x] streamEnd 加 queryId 字段 → Task 1 ✓
- [x] WebSocket 层注入 queryId → Task 2 ✓
- [x] pendingAnalysis 改为 Map → Task 3 ✓
- [x] query_summary 从 Map 读取并删除 → Task 3 Step 4 ✓
- [x] reset 重置 Map → Task 3 Step 5 ✓

**类型一致性检查：**
- `pendingAnalysisByQueryId: Map<string, string>` — key 是 queryId，value 是 analysis 文本，与 spec 一致 ✓
- `streamEnd` 事件 `queryId` 是可选字段（`queryId?`），兼容无 queryId 的旧场景 ✓
