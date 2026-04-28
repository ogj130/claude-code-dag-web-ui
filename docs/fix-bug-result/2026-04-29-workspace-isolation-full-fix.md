# Bug 修复报告: 工作区切换对话历史联动

**日期**: 2026-04-29
**严重度**: High
**相关提交**: `0f0d246`, `c11f823`, `a79031f`

## 问题

切换终端工作区 Tag 后，对话历史（问答卡片、进行中卡片、历史面板）没有联动切换，仍然显示其他工作区的数据。

## 根因

三个数据消费点缺少工作区过滤：

| 组件 | 数据 | 状态 |
|------|------|------|
| TerminalView | `markdownCards` | ❌ → ✅ |
| TerminalView | `currentCard` | ❌ → ✅ |
| HistoryPanel | `markdownCards` | ❌ → ✅ |
| HistoryPanel | `currentCard` | ❌ → ✅ |
| DAGCanvas | `nodes` | ✅ 已隔离 |

`MarkdownCardData` 接口缺少 `workspaceId` 字段，卡片创建时未注入。消费者直接读取全量数据，不做工作区筛选。

## 修复方案

### 三层修复

```
数据层 (useTaskStore)
  ├── MarkdownCardData 新增 workspaceId?: string
  ├── 卡片创建注入 workspaceId: wid
  │
视图层 (TerminalView)
  ├── 非全局视图: markdownCards.filter(c => c.workspaceId === activeTab)
  ├── 非全局视图: currentCard = currentCardByWorkspace[activeTab]
  │
面板层 (HistoryPanel)
  ├── 同上过滤逻辑
```

### 关键代码

```typescript
// 通用过滤模式（TerminalView + HistoryPanel 共用）
const isWorkspaceView = activeTab !== 'global' && workspaceTabs.length > 0;

const markdownCards = isWorkspaceView
  ? allMarkdownCards.filter(c => c.workspaceId === activeTab)
  : allMarkdownCards;

const currentCard = isWorkspaceView
  ? (currentCardByWorkspace[activeTab] ?? null)
  : globalCurrentCard;
```

### 行为矩阵

| 视图 | 全局卡片 | ws-A 卡片 | ws-B 卡片 | 旧卡片(无 wsId) |
|------|----------|-----------|-----------|-----------------|
| 全局 | ✅ | ✅ | ✅ | ✅ |
| 工作区A | ❌ | ✅ | ❌ | ❌ |
| 工作区B | ❌ | ❌ | ✅ | ❌ |

## 验证

- TS 编译: 零错误
- 测试: 51/51 通过
- 新增 `workspaceMarkdownFilter.test.ts` (5 tests)

## 经验

参见 `2026-04-29-workspace-isolation-fix.md` 中的多工作区数据隔离检查清单。

## 修改文件

- `src/stores/useTaskStore.ts` — 数据层: workspaceId 字段 + 注入
- `src/components/ToolView/TerminalView.tsx` — 视图层: 过滤
- `src/components/HistoryPanel.tsx` — 面板层: 过滤
