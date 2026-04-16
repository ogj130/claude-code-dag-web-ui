# V2.0.0 缺口补全设计

## 概述

V2.0.0 的多工作区 Dispatch 功能已完整实现，但存在 3 个缺口需要补全：
1. 全局 Agent 分析使用 Mock 数据，需接入真实 AI
2. QA 历史列表页缺少导出按钮（导出服务已实现但未接入 UI）
3. 模型配置页缺少连接测试功能

## 设计原则

- **复用优先**：全局 Agent 直接使用现有默认模型的 API 配置，无需额外设置
- **渐进增强**：API 调用失败时优雅降级到 Mock 数据，不阻断用户操作
- **接口稳定**：导出和连接测试均通过已有服务层，不修改存储结构

---

## 任务 1：全局 Agent 真实 AI 分析

### 架构

```
GlobalAgentReportModal
    │
    ├── globalAgentService.runRealAnalysis(batchResult, modelConfigId)
    │       │
    │       ├── 1. 收集 batchResult 中所有 workspace 的执行数据
    │       ├── 2. 构造结构化分析 Prompt
    │       ├── 3. 调用 modelConfigStorage 中的默认模型 API
    │       ├── 4. 解析 JSON 响应 → GlobalAgentResult
    │       └── 5. 更新 store → UI 自动刷新
    │
    └── API 失败 → 回退到 Mock 数据 + toast 警告
```

### 分析 Prompt 设计

**输入数据格式化：**
```typescript
const prompt = `你是严格的 AI 代码助手评测员。以下是 ${workspaces.length} 个工作区的执行结果对比：

${workspaces.map((ws, i) => `
【工作区 ${i+1}】${ws.workspaceId}
- 模型: ${ws.modelName || 'unknown'}
- Prompt: "${ws.prompt}"
- 执行状态: ${ws.status}
${ws.status === 'failed' ? `- 失败原因: ${ws.reason}` : ''}
- Token 消耗: ${ws.tokenUsage ?? 'unknown'}
`).join('\n')}

请从以下 7 个维度对每个工作区评分（1-10 分）：
1. 代码质量（代码可读性、最佳实践）
2. 正确性（是否满足 Prompt 要求）
3. 性能（算法效率、响应速度）
4. 一致性（输出格式稳定性）
5. 创意（解决方案的独特性）
6. 成本效率（Token 消耗 vs 输出质量）
7. 速度（首 Token 延迟、总耗时）

请严格按以下 JSON 格式输出（只输出 JSON，不要其他内容）：
{
  "rankings": [
    { "workspaceId": "...", "rank": 1, "totalScore": 8.5, "strengths": ["..."], "weaknesses": ["..."] }
  ],
  "scores": [
    { "workspaceId": "...", "codeQuality": 8.5, "correctness": 9.0, "performance": 7.5, "consistency": 8.0, "creativity": 8.0, "costEfficiency": 7.0, "speed": 8.5 }
  ],
  "commentary": "综合评语...",
  "roast": "吐槽内容...",
  "recommendations": ["建议1", "建议2"]
}`;
```

**API 调用：** 复用 `modelConfigStorage` 中的默认配置，通过 `fetch` 调用 `/v1/chat/completions`。

**JSON 解析：** 使用 `try/catch`，解析失败时回退 Mock。

### 失败处理

| 失败场景 | 处理方式 |
|---------|---------|
| 模型配置不存在 | toast 提示 + Mock |
| API Key 无效（401） | toast 提示"API Key 无效" + Mock |
| 网络超时（>30s） | toast 提示"请求超时" + Mock |
| 响应格式错误 | toast 提示"分析结果解析失败" + Mock |
| 其他错误 | toast 显示错误信息 + Mock |

### 依赖

- `modelConfigStorage.ts` — 读取默认模型配置
- `globalAgentService.ts` — 分析逻辑（重构 `runAnalysis`）
- `useMultiDispatchStore` — `batchResult` 数据源
- 现有 `GlobalAgentReportModal` — UI 层不变

---

## 任务 2：QA 历史导出按钮接入 UI

### 位置

在 `QAHistoryListView.tsx` 顶部工具栏区域：
- 当前：筛选条件（关键词/状态/时间/评分）
- 新增：导出按钮组（右侧）

### UI 设计

```
┌────────────────────────────────────────────────────────────────┐
│ 关键词: [____] 状态: [全部▼] 时间: [全部▼] 评分: [全部▼]  [导出▼] │
└────────────────────────────────────────────────────────────────┘
```

导出下拉菜单：
- 导出选中项（Markdown）
- 导出选中项（JSON）
- 导出选中项（HTML）
- ─────────
- 导出全部（Markdown）
- 导出全部（JSON）
- 导出全部（HTML）

### 行为

1. 用户选中若干记录（或不选 = 全量）
2. 点击导出 → 弹出格式选择
3. 调用 `qaHistoryExport.ts` 的 `exportToMarkdown/JSON/HTML`
4. 自动下载文件（`URL.createObjectURL` + `<a>`）

### 依赖

- `QAHistoryListView.tsx` — 添加导出按钮
- `qaHistoryExport.ts` — 已有，零修改
- `useState` — 管理选中记录

---

## 任务 3：模型配置连接测试

### 位置

在 `ModelConfigPanel.tsx` 的"新增模型"表单中：
- 当前：模型名称 + Provider + API Key + Base URL + Priority
- 新增："测试连接" 按钮（在 API Key 输入框右侧）

### 行为

1. 用户填写完表单（或部分填写）后点击"测试连接"
2. 读取表单数据构造测试请求
3. 发送 `POST /v1/chat/completions`（带 `max_tokens: 10` 限制输出）
4. 3s 内返回 → 显示成功 + 延迟ms
5. 超时/失败 → 显示错误原因

### 测试请求体

```json
{
  "model": "<用户填写的模型名>",
  "messages": [{ "role": "user", "content": "Hi" }],
  "max_tokens": 10,
  "temperature": 0.1
}
```

### 状态 UI

- **测试中：** 按钮文字变为"测试中..." + spinner，禁用
- **成功：** 绿色提示"连接成功 (XXXms)"，按钮变绿色对勾
- **失败：** 红色提示"连接失败: <错误原因>"，按钮变红色 X

### 依赖

- `ModelConfigPanel.tsx` — 添加按钮和状态 UI
- `embedding.ts` 中已有类似连接测试逻辑，可参考复用

---

## 测试计划

| 任务 | 测试点 |
|------|--------|
| 全局 Agent 真实分析 | API 调用成功、JSON 解析正确、失败回退 Mock |
| QA 历史导出 | 导出按钮显示、选中/全量导出、Markdown/JSON/HTML |
| 模型连接测试 | 成功/401/超时/网络错误 4 种场景的 UI 反馈 |

---

## 验收标准

1. 全局 Agent 分析使用真实 AI（非 Mock），API 失败时正确降级
2. QA 历史列表页有导出按钮，支持 3 种格式
3. 模型配置页有连接测试按钮，4 种状态反馈正确
4. 447 个原有测试继续通过
