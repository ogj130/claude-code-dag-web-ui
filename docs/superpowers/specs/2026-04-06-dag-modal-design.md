# DAG 节点详情弹窗设计

> **Goal:** 将 DAG 节点的"参数查看"和"总结查看"从内联展开改为居中模态弹窗，提升信息展示质量和交互体验。

## 1. 问题陈述

当前 DAG 节点详情采用**内联展开**方式：
- 工具节点：点击"参数"按钮 → `maxHeight: 0→120px` 动画，内容嵌入节点内部
- 总结节点：点击"查看总结"按钮 → `maxHeight: 0→300px` 动画，内容嵌入节点内部

**存在的问题：**
1. 展开时节点高度变化，导致 DAG 布局重排，相邻节点被挤开，布局抖动
2. 节点宽度固定（总结 280px / 工具自适应），长 Markdown 表格、代码块被截断
3. 同时只能展开一个节点，切换查看需先收起当前再展开另一个
4. 总结节点内容与节点本体耦合，无法在其他视图中复用

## 2. 设计方案

### 2.1 交互设计

**触发方式：** 点击节点上的「参数」或「查看总结」文字按钮 → 打开模态弹窗

**弹窗结构：**
```
┌────────────────────────────────────────────────────┐
│                    遮罩层 (点击关闭)                 │
│  ┌──────────────────────────────────────────────┐  │
│  │  标题栏                                        │  │
│  │  [工具图标] 工具: Read        [X] 关闭          │  │
│  ├──────────────────────────────────────────────┤  │
│  │                                              │  │
│  │  参数详情 / Markdown 总结内容                  │  │
│  │  （可滚动，支持代码块/表格/引用等）             │  │
│  │                                              │  │
│  └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
```

**关闭方式：** 点击遮罩层 / 点击 X 按钮 / 按 ESC 键

**键盘支持：** 焦点陷阱（focus trap），Tab 在弹窗内部循环

### 2.2 组件设计

**新组件：`NodeDetailModal`**

```
位置: src/components/DAG/NodeDetailModal.tsx
```

**Props:**
```typescript
interface NodeDetailModalProps {
  nodeType: 'tool' | 'summary';
  nodeLabel: string;
  nodeStatus?: DAGNode['status'];
  args?: Record<string, unknown> | null;   // tool 节点
  summaryContent?: string;                  // summary 节点
  onClose: () => void;
}
```

**两种内容模式：**
- `tool` 模式：展示工具调用参数，使用参数格式化样式（同现有 DAGNode 内联样式）
- `summary` 模式：展示 Markdown 渲染内容（复用 `DAGNode.tsx` 的 `markdownStyles`）

### 2.3 状态管理

在 `DAGCanvas.tsx` 中管理弹窗状态：

```typescript
interface ModalState {
  open: boolean;
  nodeType: 'tool' | 'summary';
  nodeId: string;
  nodeLabel: string;
  nodeStatus?: DAGNode['status'];
  args?: Record<string, unknown> | null;
  summaryContent?: string;
}

const [modal, setModal] = useState<ModalState>({ open: false, ... });
```

**打开弹窗：** 节点按钮 onClick → `setModal({ open: true, nodeType, nodeId, ... })`

**关闭弹窗：** `setModal(m => ({ ...m, open: false }))`

### 2.4 视觉规范

**弹窗尺寸：**
- 宽度：`min(680px, 90vw)`
- 最大高度：`min(520px, 80vh)`
- 圆角：12px
- 阴影：`0 20px 60px rgba(0,0,0,0.5)`

**遮罩：**
- 背景：`rgba(0, 0, 0, 0.6)`
- 模糊：`backdrop-filter: blur(4px)`
- 点击可关闭

**动画：**
- 弹窗出现：`scale(0.92)→scale(1)` + `opacity: 0→1`，200ms ease-out
- 遮罩：`opacity: 0→1`，150ms ease-out
- 关闭：反向 150ms

**标题栏：**
- 左侧：节点类型图标（工具/总结 SVG）+ 节点标签（工具名或"总结"）
- 右侧：状态标签（运行中/完成/失败）+ 关闭按钮
- 背景：`var(--bg-bar)`
- 分隔线：`1px solid var(--border)`

**内容区：**
- 内边距：16px
- 溢出：`overflow-y: auto`
- 代码块：`pre` 背景 `rgba(0,0,0,0.3)`，可横向滚动
- 表格：全宽，滚动不掉线

**按钮样式：**
- 关闭按钮：`×` 字符，hover 时背景 `var(--bg-card-hover)`，无边框

### 2.5 无障碍（Accessibility）

- `role="dialog"`，`aria-modal="true"`
- `aria-labelledby` 指向标题元素
- 弹窗打开时焦点移到弹窗容器，关闭时焦点返回触发按钮
- ESC 键关闭
- Tab 焦点在弹窗内循环（focus trap）

## 3. DAGNode.tsx 变更

**移除：**
- `detailRef`（内联展开宽度测量）
- `summaryRef`（总结展开宽度测量）
- `argsOpen` / `summaryOpen` state
- `handleToggle` / `handleSummaryToggle` 回调
- 内联展开的 `<div>` 结构（maxHeight 动画部分）
- DAGNode 的 `onExpandChange` prop 传递（不再需要动态布局）

**新增：**
- `onOpenDetail` prop（从 DAGCanvas 传入）
  ```typescript
  interface DAGNodeProps {
    // ... 现有
    onOpenDetail?: (node: Pick<DAGNode, 'id'|'type'|'label'|'status'|'args'|'summaryContent'>) => void;
  }
  ```

**按钮改为：**
```tsx
<button onClick={() => onOpenDetail?.(data)}>
  {data.type === 'tool' ? '参数' : '查看总结'}
</button>
```

## 4. DAGCanvas.tsx 变更

- 添加 `modal` state
- 传递 `onOpenDetail` 给每个 DAGNode
- 渲染 `<NodeDetailModal>` 条件：`modal.open && <NodeDetailModal {...modal} onClose={...} />`
- 移除 `expandedWidths` state 和 `handleExpandChange`（不再需要，因为没有内联展开了）

## 5. 文件变更

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/components/DAG/NodeDetailModal.tsx` | 新建 | 弹窗组件 |
| `src/components/DAG/DAGNode.tsx` | 修改 | 移除内联展开，添加 `onOpenDetail` prop |
| `src/components/DAG/DAGCanvas.tsx` | 修改 | 添加 modal state，渲染弹窗，传递 onOpenDetail |
| `docs/superpowers/specs/YYYY-MM-DD-dag-modal-design.md` | 新建 | 本文档 |

## 6. 测试场景

1. 工具节点：点击"参数" → 弹窗打开，参数格式正确，代码块可滚动
2. 总结节点：点击"查看总结" → 弹窗打开，Markdown 渲染正确（表格/列表/代码块）
3. 弹窗操作：ESC 关闭 / 遮罩点击关闭 / X 按钮关闭
4. 多节点切换：打开弹窗后点击另一节点的按钮 → 内容切换，弹窗不关闭
5. 焦点管理：弹窗打开时 Tab 在内部循环，不跳转到背后 DAG
6. 主题切换：暗/亮模式下遮罩颜色、弹窗背景正确响应 CSS 变量
