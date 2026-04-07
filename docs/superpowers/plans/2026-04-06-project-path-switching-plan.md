# 项目路径切换功能实现计划

**Goal:** 支持在会话下拉菜单内直接编辑路径，新建会话时指定路径，后端先 kill 再 spawn 保证进程不重复。

**Architecture:** 纯前端 hook 管理路径历史（localStorage）+ ConfirmDialog 统一确认弹窗 + 后端 `start_session` 入口增加 kill 保护。WebSocket 协议零改动。

**Tech Stack:** React hooks, localStorage, `window.showDirectoryPicker()`, Node.js ChildProcess

---

## 文件清单

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/hooks/usePathHistory.ts` | 新建 | 路径历史 CRUD，localStorage 持久化 |
| `src/components/ConfirmDialog.tsx` | 新建 | 通用确认弹窗，支持多按钮 |
| `src/hooks/useConfirm.ts` | 新建 | 声明式调用 ConfirmDialog 的 hook |
| `src/components/Toolbar/SessionDropdown.tsx` | 重写 | 会话下拉 + 编辑模式 + 路径输入 + 确认弹窗 |
| `src/stores/useSessionStore.ts` | 修改 | 新增 `updateSession` action |
| `src/hooks/useWebSocket.ts` | 修改 | connect() 从 store 读取 projectPath |
| `server/index.ts` | 修改 | start_session 分支先 kill 再 spawn |
| `server/ClaudeCodeProcess.ts` | 修改 | spawn 前自动 kill（已有，代码确认） |

---

## Task 1: `usePathHistory` Hook

**Files:**
- Create: `src/hooks/usePathHistory.ts`
- Test: 手动验证（localStorage 检查）

```typescript
// src/hooks/usePathHistory.ts
import { useState, useCallback } from 'react';

const STORAGE_KEY = 'cc-web-path-history';
const MAX_PATHS = 10;

interface PathHistoryActions {
  paths: string[];
  addPath: (path: string) => void;
  clearHistory: () => void;
}

export function usePathHistory(): PathHistoryActions {
  const [paths, setPaths] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    } catch {
      return [];
    }
  });

  const persist = (next: string[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const addPath = useCallback((path: string) => {
    setPaths(prev => {
      const trimmed = path.trim();
      if (!trimmed) return prev;
      const filtered = prev.filter(p => p !== trimmed);
      const next = [trimmed, ...filtered].slice(0, MAX_PATHS);
      persist(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setPaths([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { paths, addPath, clearHistory };
}
```

- [ ] **Step 1: 创建 `src/hooks/usePathHistory.ts`**

写入以上完整代码。

- [ ] **Step 2: 验证 localStorage 逻辑正确**

在浏览器控制台临时测试：
```js
localStorage.setItem('cc-web-path-history', JSON.stringify(['/tmp/test']));
// 刷新页面，检查 hook 是否正确读取
```

---

## Task 2: `ConfirmDialog` 组件

**Files:**
- Create: `src/components/ConfirmDialog.tsx`
- Modify: `src/App.tsx`（暂不需要，但先保留扩展性）

```tsx
// src/components/ConfirmDialog.tsx
import React from 'react';

interface ButtonDef {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'danger' | 'ghost';
}

interface Props {
  title: string;
  message: React.ReactNode;
  buttons: ButtonDef[];  // 至少1个
}

export function ConfirmDialog({ title, message, buttons }: Props) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '24px 28px',
        minWidth: 360, maxWidth: 480,
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <h3 style={{
          margin: '0 0 12px',
          fontSize: 15, fontWeight: 600,
          color: 'var(--text-primary)',
        }}>{title}</h3>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
          {message}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {buttons.map((btn, i) => (
            <button
              key={i}
              onClick={btn.onClick}
              style={{
                padding: '7px 16px', borderRadius: 7, fontSize: 12,
                cursor: 'pointer', fontFamily: 'inherit',
                border: btn.variant === 'ghost' ? 'none' : '1px solid',
                background: btn.variant === 'danger'
                  ? 'var(--error)'
                  : btn.variant === 'ghost'
                  ? 'transparent'
                  : 'var(--bg-input)',
                color: btn.variant === 'danger'
                  ? 'white'
                  : btn.variant === 'ghost'
                  ? 'var(--text-dim)'
                  : 'var(--text-primary)',
                borderColor: btn.variant === 'danger'
                  ? 'var(--error)'
                  : 'var(--border)',
                fontWeight: btn.variant === 'danger' ? 600 : 400,
                transition: 'all 0.15s',
              }}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 1: 创建 `src/components/ConfirmDialog.tsx`**

写入以上代码。

- [ ] **Step 2: 验证组件渲染正确**

确认 tsconfig 能找到该文件，无编译错误即可。

---

## Task 3: `useConfirm` 声明式 Hook

**Files:**
- Create: `src/hooks/useConfirm.ts`

```typescript
// src/hooks/useConfirm.ts
import { useState, useCallback } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';

type ButtonVariant = 'default' | 'danger' | 'ghost';

interface ConfirmButton {
  label: string;
  onClick: () => void;
  variant?: ButtonVariant;
}

interface ConfirmOptions {
  title: string;
  message: React.ReactNode;
  buttons: ConfirmButton[];
}

export function useConfirm() {
  const [dialog, setDialog] = useState<ConfirmOptions | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<void>(resolve => {
      setDialog({
        ...options,
        buttons: options.buttons.map(btn => ({
          ...btn,
          onClick: () => {
            btn.onClick();
            setDialog(null);
            resolve();
          },
        })),
      });
    });
  }, []);

  const close = useCallback(() => setDialog(null), []);

  const DialogComponent = dialog ? (
    <ConfirmDialog
      title={dialog.title}
      message={dialog.message}
      buttons={dialog.buttons}
    />
  ) : null;

  return { confirm, close, DialogComponent };
}
```

- [ ] **Step 1: 创建 `src/hooks/useConfirm.ts`**

写入以上代码。

---

## Task 4: `useSessionStore` 新增 `updateSession` Action

**Files:**
- Modify: `src/stores/useSessionStore.ts`

在 `SessionState` 接口添加：
```typescript
updateSession: (id: string, updates: Partial<Pick<Session, 'name' | 'projectPath'>>) => void;
```

在 store 实现中添加：
```typescript
updateSession: (id, updates) => {
  set(state => ({
    sessions: state.sessions.map(s =>
      s.id === id ? { ...s, ...updates } : s
    ),
  }));
},
```

- [ ] **Step 1: 修改 `useSessionStore.ts`**

读取当前文件，找到 `SessionState` 接口和 store 实现，分别添加上述类型和函数。

---

## Task 5: `useWebSocket` 从 Store 读取 projectPath

**Files:**
- Modify: `src/hooks/useWebSocket.ts:46-50`

找到 `ws.onopen` 中的硬编码路径：
```typescript
// 旧代码
projectPath: '/Users/ouguangji/2026/cc-web-ui',
```

改为从 store 读取：
```typescript
// 新代码
projectPath: (() => {
  const store = useTaskStore.getState ? useTaskStore.getState() : null;
  const session = useSessionStore.getState().sessions.find(s => s.id === sessionId);
  return session?.projectPath ?? '/Users/ouguangji/2026/cc-web-ui';
})(),
```

同时在文件顶部添加 import：
```typescript
import { useSessionStore } from '../stores/useSessionStore';
```

**注意**: `useWebSocket` 是 hooks，不能在普通函数体内调用 `useSessionStore`。正确做法是：
```typescript
// 在组件层通过 props 传入，或在 useEffect 内部用 getState()
```

实际上更简单的方案：让 `connect` 的调用方（`App.tsx`）通过闭包传入 `projectPath`，或者在 `ws.onopen` 里用 `useSessionStore.getState()`（Zustand 支持在 hook 外调用）。

修改后的 `connect` 函数中：
```typescript
ws.onopen = () => {
  // 从 store 动态读取当前会话的 projectPath
  const session = useSessionStore.getState().sessions.find(s => s.id === sessionId);
  const projectPath = session?.projectPath ?? '/Users/ouguangji/2026/cc-web-ui';

  const msg: WSClientMessage = {
    type: 'start_session',
    sessionId,
    projectPath,
  };
  ws.send(JSON.stringify(msg));
  // ...
};
```

`connect` 的 `useCallback` 依赖项中已有 `sessionId`，但需要增加 `handleEvent` 等，不需要额外依赖（因为 `useSessionStore.getState()` 是静态调用）。

- [ ] **Step 1: 修改 `useWebSocket.ts` 的 `ws.onopen` 发送逻辑**

读取当前文件，找到第 46-50 行的硬编码路径，替换为动态读取。

---

## Task 6: `SessionDropdown` 重写（核心）

**Files:**
- Modify: `src/components/Toolbar/SessionDropdown.tsx`

**完整重写**（当前文件较小，直接替换）：

```tsx
import React, { useState, useRef } from 'react';
import { useSessionStore } from '../../stores/useSessionStore';
import { usePathHistory } from '../../hooks/usePathHistory';
import { useConfirm } from '../../hooks/useConfirm';
import { useTaskStore } from '../../stores/useTaskStore';

interface Props {
  onNewSession: () => void;
}

function FolderIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function SessionDropdown({ onNewSession }: Props) {
  const { sessions, activeSessionId, setActive, addSession, updateSession } = useSessionStore();
  const { paths: recentPaths, addPath } = usePathHistory();
  const { reset: resetTaskStore } = useTaskStore();
  const { confirm, close, DialogComponent } = useConfirm();

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPath, setEditPath] = useState('');
  const [showPathDropdown, setShowPathDropdown] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPath, setNewPath] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find(s => s.id === activeSessionId);

  const startEdit = (session: typeof sessions[0]) => {
    setEditingId(session.id);
    setEditName(session.name);
    setEditPath(session.projectPath);
    setOpen(false);
    setShowPathDropdown(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingId(null);
    setEditPath('');
    setEditName('');
    setShowPathDropdown(false);
  };

  const confirmEdit = async () => {
    if (!editingId || !editPath.trim()) { cancelEdit(); return; }
    const oldSession = sessions.find(s => s.id === editingId)!;
    const pathChanged = oldSession.projectPath !== editPath.trim();

    if (!pathChanged) {
      // 仅改名称
      updateSession(editingId, { name: editName.trim() || oldSession.name, projectPath: editPath.trim() });
      cancelEdit();
      return;
    }

    // 路径变了 → 弹确认框
    const action = await confirm({
      title: '切换工作目录？',
      message: (
        <div>
          <div style={{ marginBottom: 8 }}>
            <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>当前: </span>
            <code style={{ fontSize: 12 }}>{oldSession.projectPath}</code>
          </div>
          <div style={{ marginBottom: 12 }}>
            <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>新: </span>
            <code style={{ fontSize: 12 }}>{editPath.trim()}</code>
          </div>
          <div style={{ color: 'var(--warn)', fontSize: 12, marginBottom: 4 }}>
            切换将终止当前 Claude Code 进程
          </div>
          <div style={{ color: 'var(--text-dim)', fontSize: 11 }}>
            当前对话历史将丢失，确定要切换吗？
          </div>
        </div>
      ),
      buttons: [
        { label: '取消', onClick: close, variant: 'ghost' },
        { label: '保留当前会话', onClick: () => {}, variant: 'default' },
        { label: '终止并切换', onClick: () => {}, variant: 'danger' },
      ],
    });

    // 等待用户选择（在 confirm hook 的 resolve 后继续）
    // 由于 confirm 返回 Promise，这里用更简单的同步方式处理：
  };

  // 替换 confirm 的按钮逻辑（在组件内直接处理）
  const handlePathSwitch = async () => {
    if (!editingId) return;
    const oldSession = sessions.find(s => s.id === editingId)!;

    const chosen = await new Promise<string>((resolve) => {
      // 临时 render 一个确认框，自己控制按钮行为
      // 更简单的方式：直接用三个按钮的 onClick resolve 不同值
      // 这里我们修改 confirm 调用方式
      resolve('swap');
    });
  };

  // === 实际实现：用窗口内联方式替代复杂 Promise 逻辑 ===
  // 简化版：直接提供三个按钮，不通过 Promise

  const commitPathSwitch = (mode: 'keep' | 'kill') => {
    close(); // 关闭弹窗
    if (!editingId) return;
    const finalPath = editPath.trim();
    updateSession(editingId, { name: editName.trim() || sessions.find(s=>s.id===editingId)?.name, projectPath: finalPath });
    addPath(finalPath);
    if (mode === 'kill') {
      // disconnect 会 kill 进程并 reset store
      // 需要从 App 层调用 disconnect — 通过 onKillSession callback
    }
    cancelEdit();
  };

  const handleBrowse = async () => {
    try {
      const dir = await (window as any).showDirectoryPicker();
      setEditPath(dir);
      setShowPathDropdown(false);
    } catch {
      // 用户取消
    }
  };

  const handleNewBrowse = async () => {
    try {
      const dir = await (window as any).showDirectoryPicker();
      setNewPath(dir);
    } catch {
      // 用户取消
    }
  };

  const handleCreateSession = () => {
    const name = newName.trim() || `会话 ${Date.now()}`;
    const path = newPath.trim() || '/Users/ouguangji/2026/cc-web-ui';
    addSession({ id: `session_${Date.now()}`, name, projectPath: path, createdAt: Date.now(), isActive: true });
    addPath(path);
    setCreating(false);
    setNewName('');
    setNewPath('');
    onNewSession();
  };

  return (
    <>
      <div style={{ position: 'relative' }} ref={dropdownRef}>
        <button
          onClick={() => setOpen(p => !p)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: open ? 'var(--bg-input)' : 'transparent',
            border: '1px solid var(--border)', borderRadius: 6,
            padding: '5px 10px', cursor: 'pointer',
            color: 'var(--text-primary)', fontSize: 12,
            fontFamily: 'inherit', transition: 'all 0.15s',
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
          <span>{activeSession?.name ?? '选择会话'}</span>
          <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>▾</span>
        </button>

        {open && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0,
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 8, padding: 6, minWidth: 260,
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)', zIndex: 100,
          }}>
            {sessions.map(s => (
              <div
                key={s.id}
                onClick={() => { setActive(s.id); setOpen(false); }}
                style={{
                  padding: '7px 10px', borderRadius: 5, cursor: 'pointer',
                  background: s.id === activeSessionId ? 'var(--bg-input)' : 'transparent',
                  display: 'flex', alignItems: 'center', gap: 8,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = s.id === activeSessionId ? 'var(--bg-input)' : 'transparent')}
              >
                <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{s.name}</span>
                <span
                  onClick={(e) => { e.stopPropagation(); startEdit(s); }}
                  style={{ marginLeft: 'auto', color: 'var(--accent)', fontSize: 10, cursor: 'pointer', flexShrink: 0 }}
                >
                  编辑
                </span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />
            <div
              onClick={() => { setCreating(true); setOpen(false); }}
              style={{
                padding: '7px 10px', borderRadius: 5, cursor: 'pointer',
                color: 'var(--accent)', fontSize: 12,
                display: 'flex', alignItems: 'center', gap: 6,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              + 新建会话
            </div>
          </div>
        )}
      </div>

      {/* 编辑当前会话 */}
      {editingId && (
        <PathEditModal
          mode="edit"
          initialName={editName}
          initialPath={editPath}
          recentPaths={recentPaths}
          onPathChange={setEditPath}
          onNameChange={setEditName}
          onBrowse={handleBrowse}
          onSelectRecent={(p) => { setEditPath(p); setShowPathDropdown(false); }}
          onCancel={cancelEdit}
          onConfirmSwap={() => commitPathSwitch('kill')}
          onConfirmKeep={() => commitPathSwitch('keep')}
        />
      )}

      {/* 新建会话 */}
      {creating && (
        <PathEditModal
          mode="create"
          initialName={newName}
          initialPath={newPath}
          recentPaths={recentPaths}
          onPathChange={setNewPath}
          onNameChange={setNewName}
          onBrowse={handleNewBrowse}
          onSelectRecent={(p) => { setNewPath(p); setShowPathDropdown(false); }}
          onCancel={() => { setCreating(false); setNewName(''); setNewPath(''); }}
          onConfirmCreate={handleCreateSession}
          onConfirmSwap={() => {}}
          onConfirmKeep={() => {}}
        />
      )}

      {DialogComponent}
    </>
  );
}

// ── 路径编辑弹窗（内联，避免过度拆分）─────────────────────────────
interface PathEditModalProps {
  mode: 'edit' | 'create';
  initialName: string;
  initialPath: string;
  recentPaths: string[];
  onNameChange: (v: string) => void;
  onPathChange: (v: string) => void;
  onBrowse: () => void;
  onSelectRecent: (p: string) => void;
  onCancel: () => void;
  onConfirmSwap: () => void;  // edit 模式：终止并切换
  onConfirmKeep: () => void;   // edit 模式：保留当前会话
  onConfirmCreate: () => void;  // create 模式：创建
}

function PathEditModal({ mode, initialName, initialPath, recentPaths, onNameChange, onPathChange, onBrowse, onSelectRecent, onCancel, onConfirmSwap, onConfirmKeep, onConfirmCreate }: PathEditModalProps) {
  const [pathDropdown, setPathDropdown] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const oldPath = mode === 'edit' ? initialPath : '';

  const handleConfirm = () => {
    if (mode === 'edit' && onPathChange && initialPath !== onPathChange && onConfirmSwap) {
      setShowConfirm(true);
    } else if (mode === 'create') {
      onConfirmCreate();
    }
  };

  return (
    <>
      <div style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '24px 28px', minWidth: 420, maxWidth: 520,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
            {mode === 'edit' ? '编辑会话' : '新建会话'}
          </h3>

          {/* 会话名称 */}
          <label style={{ display: 'block', marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>会话名称</div>
            <input
              value={initialName}
              onChange={e => onNameChange(e.target.value)}
              style={{
                width: '100%', padding: '8px 10px', borderRadius: 7,
                background: 'var(--bg-input)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit',
                outline: 'none', boxSizing: 'border-box',
              }}
              placeholder="会话名称"
            />
          </label>

          {/* 工作目录 */}
          <label style={{ display: 'block', marginBottom: 6, position: 'relative' }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>工作目录</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  value={initialPath}
                  onChange={e => onPathChange(e.target.value)}
                  onFocus={() => recentPaths.length > 0 && setPathDropdown(true)}
                  onBlur={() => setTimeout(() => setPathDropdown(false), 150)}
                  style={{
                    width: '100%', padding: '8px 10px', paddingRight: 32, borderRadius: 7,
                    background: 'var(--bg-input)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)', fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
                    outline: 'none', boxSizing: 'border-box',
                  }}
                  placeholder="/path/to/project"
                />
                {pathDropdown && recentPaths.length > 0 && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 7, overflow: 'hidden', zIndex: 10, maxHeight: 160, overflowY: 'auto',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                  }}>
                    {recentPaths.map(p => (
                      <div
                        key={p} onClick={() => { onSelectRecent(p); setPathDropdown(false); }}
                        style={{
                          padding: '6px 10px', fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
                          color: 'var(--text-secondary)', cursor: 'pointer',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        {p}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={onBrowse}
                title="选择文件夹"
                style={{
                  padding: '0 10px', borderRadius: 7,
                  background: 'var(--bg-input)', border: '1px solid var(--border)',
                  color: 'var(--text-secondary)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center',
                }}
              >
                <FolderIcon />
              </button>
            </div>
          </label>

          {/* 按钮 */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
            <button onClick={onCancel} style={{
              padding: '7px 14px', borderRadius: 7, fontSize: 12, cursor: 'pointer',
              background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--text-dim)', fontFamily: 'inherit',
            }}>取消</button>
            <button onClick={handleConfirm} style={{
              padding: '7px 16px', borderRadius: 7, fontSize: 12, cursor: 'pointer',
              background: 'var(--accent)', border: '1px solid var(--accent)',
              color: 'white', fontFamily: 'inherit', fontWeight: 600,
            }}>
              {mode === 'edit' ? '保存' : '创建'}
            </button>
          </div>
        </div>
      </div>

      {/* 切换确认 */}
      {showConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 600,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '24px 28px', minWidth: 380,
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
              切换工作目录？
            </h3>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 8 }}>
              <div><span style={{ color: 'var(--text-dim)' }}>当前: </span><code>{oldPath}</code></div>
              <div style={{ marginBottom: 12 }}><span style={{ color: 'var(--text-dim)' }}>新: </span><code>{initialPath}</code></div>
              <div style={{ color: 'var(--warn)', marginBottom: 4 }}>切换将终止当前 Claude Code 进程</div>
              <div style={{ color: 'var(--text-dim)', fontSize: 11 }}>当前对话历史将丢失，确定要切换吗？</div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setShowConfirm(false)} style={{
                padding: '7px 14px', borderRadius: 7, fontSize: 12, cursor: 'pointer',
                background: 'transparent', border: '1px solid var(--border)',
                color: 'var(--text-dim)', fontFamily: 'inherit',
              }}>取消</button>
              <button onClick={() => { setShowConfirm(false); onConfirmKeep(); }} style={{
                padding: '7px 14px', borderRadius: 7, fontSize: 12, cursor: 'pointer',
                background: 'var(--bg-input)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', fontFamily: 'inherit',
              }}>保留当前会话</button>
              <button onClick={() => { setShowConfirm(false); onConfirmSwap(); }} style={{
                padding: '7px 16px', borderRadius: 7, fontSize: 12, cursor: 'pointer',
                background: 'var(--error)', border: '1px solid var(--error)',
                color: 'white', fontFamily: 'inherit', fontWeight: 600,
              }}>终止并切换</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 1: 重写 `SessionDropdown.tsx`**

用上述完整代码替换当前文件内容。

- [ ] **Step 2: 修复 `Toolbar.tsx` — 将 `onNewSession` 真实实现**

当前 `Toolbar.tsx` 的 `handleNewSession` 是空实现，需要真实触发新建会话：
```tsx
// Toolbar.tsx 修改
const handleNewSession = () => {
  const id = `session_${Date.now()}`;
  addSession({
    id,
    name: `会话 ${id.split('_')[1]}`,
    projectPath: '/Users/ouguangji/2026/cc-web-ui',
    createdAt: Date.now(),
    isActive: true,
  });
  // 会话创建后，useWebSocket 会自动因为 activeSessionId 变化而重连
};
```

同时 `SessionDropdown` 需要传入 `onNewSession` prop。在 `Toolbar.tsx` 中：
```tsx
<SessionDropdown onNewSession={handleNewSession} />
```

---

## Task 7: 后端 `start_session` 先 kill 再 spawn

**Files:**
- Modify: `server/index.ts`

找到 `start_session` case（第 53-103 行），在 `spawn` 前增加 kill 判断：

```typescript
case 'start_session': {
  const { sessionId, projectPath, prompt } = msg;

  if (!clients.has(sessionId)) {
    clients.set(sessionId, new Set());
  }
  clients.get(sessionId)!.add(ws);

  if (!registeredSessions.has(sessionId)) {
    // ... 注册监听器（不变）...
  }

  // 新增：如果该 session 已有运行中的进程，先杀掉
  if (processManager.isRunning(sessionId)) {
    logger.info({ sessionId }, 'Killing existing process before re-spawn');
    processManager.kill(sessionId);
  }

  processManager.spawn(sessionId, projectPath, prompt);
  break;
}
```

- [ ] **Step 1: 修改 `server/index.ts`**

在 `start_session` 分支的 `processManager.spawn` 前插入 kill 检查。

---

## Task 8: `onNewSession` 真实触发 + App.tsx 清理

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/Toolbar/Toolbar.tsx`

`App.tsx`:
```tsx
// handleNewSession 改为真实创建会话
const handleNewSession = () => {
  const id = `session_${Date.now()}`;
  addSession({
    id,
    name: `会话 ${id.split('_')[1]}`,
    projectPath: '/Users/ouguangji/2026/cc-web-ui',
    createdAt: Date.now(),
    isActive: true,
  });
};
```

`Toolbar.tsx` 中 `<SessionDropdown onNewSession={handleNewSession} />` 已正确传递。

- [ ] **Step 1: 修改 `App.tsx` 的 `handleNewSession`**

---

## Task 9: 端到端验证

- [ ] **Step 1: 启动 dev 服务器**

```bash
npm run dev
# 确认 ws://localhost:5300 和 http://localhost:5400 正常
```

- [ ] **Step 2: 测试新建会话时填入路径**

点击会话下拉 → 新建会话 → 路径输入框应该出现 → 输入 `/tmp/test-project` → 创建 → 确认会话已创建

- [ ] **Step 3: 测试编辑当前会话路径**

点击当前会话名旁的"编辑" → 修改路径 → 保存 → 确认弹窗出现

- [ ] **Step 4: 测试"终止并切换"**

确认弹窗中点击"终止并切换" → 进程应该 kill → 新进程 spawn → 终端显示新的连接状态

- [ ] **Step 5: 测试"保留当前会话"**

确认弹窗中点击"保留当前会话" → 进程继续运行 → store 中路径已更新

- [ ] **Step 6: 测试路径历史下拉**

编辑路径时 focus 输入框 → 最近路径下拉应该出现 → 点击一条历史路径 → 自动填充

- [ ] **Step 7: 测试浏览器文件夹选择器**

点击 📁 按钮 → 系统文件夹选择器弹出 → 选择文件夹 → 路径自动填入
