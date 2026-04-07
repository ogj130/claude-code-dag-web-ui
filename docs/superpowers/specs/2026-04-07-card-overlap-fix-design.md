# 修复：多 Query 并发时卡片数据重叠

## 1. 问题描述

同一会话中发送两个问题，卡片出现以下两种异常：

1. **卡片 query 错乱**：Q1 的卡片显示 Q2 的问题文本
2. **卡片 analysis 缺失**：Q1 的卡片 analysis 区域为空，Q2 的卡片有 analysis

截图证据：两个卡片都显示"你好啊"，但上卡片无 analysis，下卡片有 analysis。

## 2. 根因分析

### 事件时序（错误场景）

```
T1: user_input_sent(Q1, "你好啊")   → currentQueryId = "Q1_id"
T2: Q1 工具调用... terminalChunks += Q1 分析
T3: user_input_sent(Q2, "你好啊")  → currentQueryId = "Q2_id"  ← Q2 抢先！
T4: streamEnd(Q1)                  → pendingAnalysis = "Q1_analysis"
                                     但此时 currentQueryId = "Q2_id"
T5: query_summary(Q1)              → 从 pendingAnalysis["Q2_id"] 读 → 空！
                                     创建卡片 Q1: query="你好啊", analysis=""
T6: streamEnd(Q2)                  → pendingAnalysis["Q2_id"] = "Q2_analysis"
T7: query_summary(Q2)              → pendingAnalysis["Q2_id"] = "Q2_analysis"
                                     创建卡片 Q2: query="你好啊", analysis="Q2"
```

### 两个 bug 点

**Bug 1：`pendingAnalysis` 是全局单值**

`streamEnd` 覆盖 `pendingAnalysis`，导致前一个 query 的 analysis 丢失。`query_summary` 读取时内容已被覆盖或还在错误 key 下。

**Bug 2：`streamEnd` 事件没有 `queryId` 字段**

`useWebSocket.ts` 中，`handleEvent` 在 WebSocket handler 内部同步调用。`user_input_sent` 先执行更新了 `currentQueryId`，`streamEnd` 后执行时已读到错误的值。即使 `pendingAnalysis` 改成 Map，也无法确定用哪个 key。

## 3. 解决方案

### 架构变更

```
pendingAnalysis: string           →  pendingAnalysisByQueryId: Map<string, string>
                                                         ↑
                                          key = streamEnd 时正确的 queryId
                                          (在 WebSocket 层注入)
```

### 数据流变更

```
WebSocket 层：
  streamEnd 事件到达 → 从 pendingInputsRef 栈顶获取 queryId → 注入事件 → handleEvent

Store 层：
  streamEnd → pendingAnalysisByQueryId.set(queryId, chunks.join(''))
  query_summary → pendingAnalysisByQueryId.get(queryId) → 创建卡片 → Map.delete(queryId)
```

### 关键文件变更

| 文件 | 变更 |
|------|------|
| `src/types/events.ts` | `streamEnd` 类型增加可选 `queryId` 字段 |
| `src/hooks/useWebSocket.ts` | streamEnd 处理时注入正确 queryId |
| `src/stores/useTaskStore.ts` | `pendingAnalysis` 改为 `Map<queryId, analysis>`，query_summary 从 Map 读取 |

### useWebSocket.ts 注入逻辑

```typescript
// ws.onmessage 内部
if (evt?.type === 'streamEnd') {
  // 从 pendingInputsRef 获取当前结束的 queryId（栈顶 = 正在处理的 query）
  const queryId = pendingInputsRef.current[0] ?? currentQueryId;
  // 注入 queryId 到事件，再传给 store
  handleEvent({ ...evt, queryId } as ClaudeEvent);
  // ... 其余逻辑
}
```

## 4. 实现步骤

### Task 1: 类型定义变更

- `src/types/events.ts`：在 `streamEnd` 类型加可选 `queryId` 字段

### Task 2: useWebSocket.ts 注入 queryId

- 在 `ws.onmessage` 的 `streamEnd` 分支，从 `pendingInputsRef` 或 `currentQueryId` 获取正确的 queryId
- 注入到事件对象后调用 `handleEvent`

### Task 3: useTaskStore.ts pendingAnalysis 改为 Map

- `pendingAnalysis: string` → `pendingAnalysisByQueryId: Map<string, string>`
- `streamEnd` 事件处理：取 `event.queryId`，写入 Map，清空 `terminalChunks`
- `query_summary` 事件处理：从 Map 读取 analysis，读取后删除 key
- `reset()` 中重置 Map
- `pendingQuery` 可以考虑同步改为 Map（但目前通过 DAG node label 读取 query 文本已解决）

## 5. 测试验证

1. **正常路径**：单问题 → 卡片正确显示 query + analysis + summary
2. **并发路径**：Q1 处理中发送 Q2 → 两个卡片各自有正确的 query 和 analysis
3. **并发路径+工具调用**：Q1 有工具调用，Q2 无 → Q1 卡片有 analysis，Q2 卡片无 analysis
4. **快速连续发送**：3 个问题快速发送 → 3 个卡片各自正确
