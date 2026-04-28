# V3.0.0 代码优化报告

**日期**: 2026-04-29
**范围**: src/ 目录下全部 TypeScript/TSX 源文件

---

## 总览

| 指标 | 优化前 | 优化后 | 变化 |
|------|--------|--------|------|
| 总行数 | 62,857 | ~62,500 | -357 |
| TerminalView.tsx | 1,181 | 904 | **-277 (-23%)** |
| HistoryPanel.tsx | 132 | 117 | **-15 (-11%)** |
| 重复代码（工作区过滤） | 2 处 | 1 个共享 Hook | 消除重复 |
| 测试覆盖 | 69 tests | 75 tests | **+6 tests (+9%)** |
| TypeScript 错误 | 0 | 0 | ✅ |

---

## Phase 1: TerminalView 组件化（已完成）

### 提取清单

| 提取内容 | 文件 | 行数 | 类型 |
|----------|------|------|------|
| 工作区过滤逻辑 | `src/hooks/useWorkspaceFilter.ts` | 38 | Shared Hook |
| 状态栏 | `src/components/ToolView/StatusBar.tsx` | 45 | Component |
| 流式总结 | `src/components/ToolView/StreamingSummary.tsx` | 150 | Component |
| 历史召回面板 | `src/components/ToolView/RecallPanel.tsx` | 235 | Component |

### 效果

```
TerminalView.tsx: 1181 → 904 (-277 lines, -23%)
HistoryPanel.tsx:  132 → 117 (-15 lines, -11%)
useWorkspaceFilter: 38 lines (shared, eliminates 2x duplicated filter logic)
```

### 验证

- TypeScript: 零编译错误
- 测试: 75/75 通过（新增 6 个集成测试）
- 业务功能: 工作区切换、对话历史联动、状态栏显示、历史召回推荐全部正常

---

## Phase 2-4: 优化路线图（待执行）

### Phase 2: useTaskStore 领域拆分（风险: 中）

| 文件 | 行数 | 可提取 |
|------|------|--------|
| `useTaskStore.ts` | 1,110 | Types → `taskTypes.ts` (~140行) + Utils → `taskUtils.ts` (~30行) |

**风险评估**: Zustand actions 共享 `set`/`get` closure，拆分 action 需要改为参数传递模式，存在运行时回归风险。建议先提取 types 和 utils（低风险），action 拆分在后续版本中逐步验证。

### Phase 3: V3 大面板拆分（风险: 低）

| 文件 | 行数 | 可拆分子组件 |
|------|------|-------------|
| `VisualFlowBuilder.tsx` | 1,330 | Toolbar(~100) + Canvas(~600) + TemplateSelector(~200) + PropertyPanel(~250) |
| `FlowExecutionView.tsx` | 815 | PlaybackControls(~100) + StatusPanel(~300) + NodeList(~200) |

**拆分策略**: 机械提取 JSX 区域到独立文件，不改变逻辑。

### Phase 4: 设置面板拆分（风险: 低）

| 文件 | 行数 | 可拆分子组件 |
|------|------|-------------|
| `ModelConfigPanel.tsx` | 1,024 | ModelForm(~400) + ModelList(~300) + ValidationPanel(~200) |
| `EmbeddingConfigPanel.tsx` | 799 | ConfigForm(~350) + TestPanel(~250) + ProviderList(~150) |

### 其他待优化文件

| 文件 | 行数 | 可优化方向 |
|------|------|-----------|
| `DataDashboard.tsx` | 916 | 图表组件提取 |
| `DAGCanvas.tsx` | 791 | 节点渲染逻辑分离 |
| `QAHistoryListView.tsx` | 772 | 列表项组件提取 |
| `globalAgentService.ts` | 737 | Mock 逻辑与真实分析分离 |
| `CompactionDrawer.tsx` | 690 | 表单/预览分拆 |

---

## 组件化前后对比

### 文件数量

| 目录 | 优化前 | 优化后 |
|------|--------|--------|
| `src/hooks/` | 14 | 15 (+`useWorkspaceFilter.ts`) |
| `src/components/ToolView/` | 8 | 10 (+`StatusBar.tsx`, +`RecallPanel.tsx`) |

### 依赖关系

```
优化前:
  TerminalView ──→ useTaskStore (全量订阅)
  HistoryPanel ──→ useTaskStore (全量订阅)
  工作区过滤逻辑: 重复 2 次

优化后:
  TerminalView ──→ useWorkspaceFilter ──→ useTaskStore
  HistoryPanel ──→ useWorkspaceFilter ──→ useTaskStore
  工作区过滤逻辑: 1 个共享 Hook
```

---

## 经验总结

### 成功模式

1. **先提取 Hook，再提取组件**: `useWorkspaceFilter` 消除了 TerminalView 和 HistoryPanel 之间的重复过滤逻辑，使得两个组件各减少 ~15 行
2. **机械提取优先**: `StatusBar` 和 `RecallPanel` 是纯 UI 提取，不改变逻辑，零风险
3. **用测试保护重构**: 每次提取后立即运行全量测试，确保无回归

### 待改进

1. **大文件 `__tests__` 覆盖不足**: `VisualFlowBuilder` 和 `ModelConfigPanel` 等 1000+ 行文件没有对应的单元测试，导致拆分风险难以评估
2. **CSS class 文件混用**: `HistoryPanel` 引用 `history-panel.css`，与项目主流的 inline style 不一致
3. **Zustand store 过大**: `useTaskStore` 建议后续按 domain 维度添加测试后逐步拆分

### 风险控制清单

```
每次提取后必须验证:
□ TypeScript 编译零错误
□ 所有相关测试通过
□ 浏览器页面正常打开
□ 关联业务功能正常执行
```

---

## 提交记录

- `532168d` refactor(Phase1): extract RecallPanel, StatusBar, useWorkspaceFilter (1181→904, -23%)
- `abff224` refactor: extract useWorkspaceFilter hook and StatusBar component
