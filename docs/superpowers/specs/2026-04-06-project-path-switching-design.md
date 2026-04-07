# CC Web UI - 项目路径切换功能设计

**日期**: 2026-04-06
**状态**: 设计完成，待实现

---

## 1. 背景与目标

当前 CC Web UI 的工作目录路径硬编码为 `/Users/ouguangji/2026/cc-web-ui`，无法切换到其他项目。用户需要在不同项目目录下运行 Claude Code，同时保留会话管理能力。

**核心目标：支持修改任意会话的工作目录路径，支持新建会话时指定路径。**

---

## 2. 设计原则

- **YAGNI**: 仅实现当前明确所需的功能，不做过度设计
- **幂等性**: 修改路径后能干净地重启进程，不产生僵尸进程
- **无侵入**: 不改变现有 WebSocket 协议，扩展字段而非破坏兼容性

---

## 3. 数据模型

### 3.1 路径历史（localStorage）

```typescript
interface PathHistory {
  paths: string[];  // 最近使用的路径，最多 10 条，最新的在前
}
```

- Key: `cc-web-path-history`
- 写入时机：每次成功 spawn 新会话后，将 projectPath 写入历史（去重插入最前，超 10 条截断尾部）

### 3.2 Session 数据扩展

`Session.projectPath` 已在 `useSessionStore` 中存在，无需新增字段。

---

## 4. 组件改造

### 4.1 `SessionDropdown` — 会话下拉菜单

**状态设计：**
```typescript
interface DropdownState {
  mode: 'collapsed' | 'expanded' | 'editing';  // 默认折叠，展开列表，编辑当前会话
  editingPath: string;  // 当前正在编辑的路径
  editingName: string;   // 当前正在编辑的会话名
}
```

**展开当前会话行的交互：**
1. 点击当前会话名（非下拉箭头）→ 进入 `editing` 状态
2. 显示：会话名输入框 + 路径输入框 + 📁 浏览按钮 + 路径历史下拉
3. 路径输入框Blur 或选择历史路径时，自动更新 `editingPath`
4. 点击确认 → 弹出确认对话框

**新增 UI 元素：**
- 路径输入框右侧：📁 按钮（触发 `window.showDirectoryPicker()`）
- 路径输入框下方：最近路径下拉（最多 5 条，超出可滚动）

### 4.2 新建会话对话框

在现有会话列表底部「+ 新建会话」触发。

**表单字段：**
- 会话名称（输入框，默认值 `会话 ${时间戳}`）
- 工作目录（输入框 + 📁 浏览按钮 + 最近路径下拉）
- 确认 / 取消按钮

### 4.3 确认对话框组件 `ConfirmDialog`

**Props:**
```typescript
interface ConfirmDialogProps {
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}
```

**样式**: 居中 modal，背景遮罩，半透明 blur 效果。

---

## 5. 路径切换确认流程

当用户在编辑状态点击确认路径变更时：

```
用户修改路径并确认
    ↓
判断新旧路径是否相同
    ↓ 相同
直接退出编辑状态，不做任何操作
    ↓ 不同
弹出确认对话框
    ↓
┌─────────────────────────────────────────┐
│  切换工作目录？                           │
│  当前目录：/Users/.../cc-web-ui          │
│  新目录：  /Users/.../another-project   │
│                                         │
│  切换将终止当前 Claude Code 进程           │
│  (当前对话历史将丢失)                    │
│                                         │
│  [取消]  [终止并切换]  [保留当前会话]     │
└─────────────────────────────────────────┘

**三个按钮行为（视觉分层）：**
- **取消**: 灰色文字按钮，关闭对话框
- **保留当前会话**: 次要蓝色按钮，仅更新 store 路径，当前进程继续运行
- **终止并切换**: 主要红色/橙色按钮，破坏性操作，执行 kill → spawn 全流程

---

## 6. WebSocket & 后端联动

### 6.1 扩展 WSClientMessage

现有协议已有 `projectPath` 字段，无需新增消息类型。

```typescript
// src/types/events.ts
| { type: 'start_session'; sessionId: string; projectPath: string; prompt?: string }
```

### 6.2 `server/index.ts` — start_session 处理

在 `start_session` 分支中，如果该 `sessionId` 已有运行中的进程，先 kill 再 spawn：

```typescript
case 'start_session': {
  // 如果该 session 已有进程，先杀掉
  if (processManager.isRunning(sessionId)) {
    processManager.kill(sessionId);
  }
  processManager.spawn(sessionId, projectPath, prompt);
  break;
}
```

### 6.3 `server/ClaudeCodeProcess.ts` — spawn 幂等性

`spawn` 方法开头已有 `kill(sessionId)` 调用，确保同一 sessionId 不会重复 spawn。

---

## 7. `usePathHistory` Hook

```typescript
// src/hooks/usePathHistory.ts
interface PathHistoryActions {
  addPath: (path: string) => void;     // 添加路径到历史（去重插入最前）
  getPaths: () => string[];           // 获取历史路径列表
  clearHistory: () => void;           // 清空历史
}

export function usePathHistory(): PathHistoryActions { ... }
```

- 初始化时从 `localStorage` 读取
- `addPath` 同时写回 `localStorage` 和内存状态
- 最多保留 10 条

---

## 8. `useWebSocket` 改造

`connect()` 的 `start_session` 消息中，projectPath 取自当前 `session.projectPath`（由 `useSessionStore` 提供），而非硬编码。

需要调整 `useWebSocket` 的依赖：传入 `projectPath` 参数，或在内部通过 `useSessionStore` 获取。

**推荐方案**: `connect()` 中从 `useSessionStore.getState().sessions.find(s => s.id === sessionId)?.projectPath` 获取。

---

## 9. 实现优先级

1. **`usePathHistory` hook** — 基础数据层
2. **`ConfirmDialog` 组件** — 可复用的确认弹窗
3. **`SessionDropdown` 编辑模式** — 核心交互
4. **后端 `start_session` kill-before-spawn** — 进程管理
5. **新建会话对话框路径输入** — 补充功能
6. **浏览器 `showDirectoryPicker()`** — 文件夹选择

---

## 10. 边界情况

| 场景 | 处理方式 |
|------|---------|
| 用户输入了不存在的路径 | Claude Code spawn 时报错，error 事件发往前端，显示错误状态 |
| 用户选择了同一个路径 | 退出编辑状态，无任何操作 |
| 进程 spawn 后快速切换 | 前一次 `kill` 执行完后才执行新 spawn，避免竞态 |
| localStorage 不可用 | 降级为内存存储，仅当前页面有效 |
| `showDirectoryPicker()` 不支持 | 浏览器不支持时隐藏浏览按钮，纯文本输入降级 |

---

## 11. Anti-Patterns

- 不要在路径输入框里自动补全或做路径验证（徒增复杂度，spawn 失败时 Claude 会告知）
- 不要让多个会话同时操作同一个 sessionId（WS 协议本身不支持，会话隔离由 UI 保证）
- 不要在确认对话框里默认选"保留当前会话"（用户主动切换路径，通常就是想重启）
