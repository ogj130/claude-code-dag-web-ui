# Terminal 回答卡片增强：Query + Analysis(可折叠) + Summary

## 1. 当前状态

每个 MarkdownCard 目前只渲染单一 `content` 字段（来自 `query_summary`），标签固定为 "✦ 最终总结"。

## 2. 目标结构

每个回答卡片包含三部分：

```
┌──────────────────────────────────────────────────────┐
│ ✦ 回答总结                                    [展开] │
├──────────────────────────────────────────────────────┤
│ 💬 你好，请介绍一下茅台股票                          │  ← Query（固定显示）
├──────────────────────────────────────────────────────┤
│ ▶ 分析内容 (2.3KB)                           [收起] │  ← Analysis（可折叠，默认折叠）
│ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ │
│ ## 茅台股票分析                                    │  ← Analysis Markdown（展开后）
│ 根据数据显示，茅台表现良好...                        │
│ - 营收增长                                         │
│ - 品牌溢价                                         │
├──────────────────────────────────────────────────────┤
│ 📋 最终总结                                         │  ← Summary（固定显示）
│ 茅台股票值得持有，推荐评级：买入                      │
└──────────────────────────────────────────────────────┘
```

## 3. 数据结构变更

### MarkdownCardData

```typescript
// 旧结构
interface MarkdownCardData {
  id: string;
  content: string;   // 只有这个
  label?: string;
  timestamp: number;
}

// 新结构
interface MarkdownCardData {
  id: string;
  timestamp: number;
  query: string;       // 用户问题
  analysis: string;    // AI 分析过程（Markdown）
  summary?: string;   // 最终总结（可选，无工具调用时只有 analysis）
}
```

### Store 变更

新增 `pendingQuery` 字段（追踪当前问题的文本）：
```typescript
pendingQuery: string; // 当前问题的 query 文本（streamEnd 时清空）
```

`user_input_sent` 事件处理时保存 `event.text` 到 `pendingQuery`。

`streamEnd` 事件处理：
- 将 `terminalChunks.join('')` 存入 `pendingAnalysis`
- 清空 `terminalChunks`

`query_summary` 事件处理：
- 创建 `MarkdownCardData`，填入 `pendingQuery + pendingAnalysis + event.summary`
- 调用 `addMarkdownCard({ query, analysis, summary, id, timestamp })`
- 清空 `pendingQuery` 和 `pendingAnalysis`

新增 `addMarkdownCard(card: MarkdownCardData)` action（参数从 `content` 改为完整对象）。

## 4. MarkdownCard 组件变更

**Props 变更：**
```typescript
// 旧
interface MarkdownCardProps {
  card: MarkdownCardData;
  defaultOpen?: boolean;
}

// 新
interface MarkdownCardProps {
  card: MarkdownCardData;
  defaultAnalysisOpen?: boolean; // analysis 默认折叠
}
```

**UI 结构：**
1. **Header** — 标签 "✦ 回答总结"，点击切换整个卡片展开/收起（主 toggle）
2. **Query 区** — 固定显示，背景 `var(--bg-bar)`，左侧 `💬` 图标，问题文本
3. **Analysis 区** — 可折叠，Header "▶ 分析内容 (X字)"，展开后渲染 Markdown
4. **Summary 区** — 固定显示，背景略不同，左侧 `📋` 图标，Markdown 渲染

**折叠逻辑：**
- 主 Header 控制整体 `open` 状态
- Analysis 内部还有一个 `analysisOpen` 状态（默认 `false`）
- 主卡片收起时 Analysis 和 Summary 都隐藏
- Analysis 收起时只显示其 Header

## 5. 文件变更

| 文件 | 操作 | 变更 |
|------|------|------|
| `src/stores/useTaskStore.ts` | 修改 | `MarkdownCardData` 结构、`pendingQuery` state、`addMarkdownCard` 签名、`user_input_sent`/`streamEnd`/`query_summary` 事件处理 |
| `src/components/ToolView/MarkdownCard.tsx` | 修改 | Props 更新、Query/Analysis/Summary 三段式 UI、Analysis 可折叠 |

## 6. 实现步骤

### Task A: Store 变更

1. 更新 `MarkdownCardData` 接口
2. 添加 `pendingQuery: string` state
3. 添加 `pendingAnalysis: string` state
4. `user_input_sent` 事件：保存 `event.text`
5. `streamEnd` 事件：保存 `terminalChunks.join('')` 为 `pendingAnalysis`，清空 chunks
6. `query_summary` 事件：创建完整 `MarkdownCardData`，调用 `addMarkdownCard`，清空 pending
7. `addMarkdownCard` 改为接收完整对象
8. `reset` 中清空 `pendingQuery` 和 `pendingAnalysis`

### Task B: MarkdownCard 组件变更

1. 更新 `MarkdownCardData` 接口
2. 更新 Props（`defaultAnalysisOpen?: boolean`）
3. 三段式布局：Query / Analysis（可折叠）/ Summary
4. Analysis 折叠 Header："▶ 分析内容 (X字)"，点击展开
5. Summary 固定显示

### Task C: 测试

1. 发送问题 → Query 正确显示
2. 有 AI 分析 → Analysis 折叠显示，点击展开
3. 有最终总结 → Summary 正确显示
4. 无工具调用 → 只有 Query + Analysis，无 Summary
5. 主题切换 → 颜色正确响应
