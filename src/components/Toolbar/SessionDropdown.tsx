import { useState, useRef } from 'react';
import { useSessionStore } from '../../stores/useSessionStore';
import { usePathHistory } from '../../hooks/usePathHistory';

interface Props {
  onNewSession: () => void;
  onSwitchSession: (sessionId: string) => void;
}

function FolderIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

// ── 路径编辑弹窗 ─────────────────────────────────────────────
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
  onConfirm: () => void;
  oldPath?: string;
}

function PathEditModal({
  mode, initialName, initialPath, recentPaths,
  onNameChange, onPathChange, onBrowse, onSelectRecent,
  onCancel, onConfirm, oldPath,
}: PathEditModalProps) {
  const [pathDropdown, setPathDropdown] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleConfirm = () => {
    if (mode === 'edit' && oldPath && initialPath !== oldPath) {
      setShowConfirm(true);
    } else {
      onConfirm();
    }
  };

  const handleSwitch = () => {
    setShowConfirm(false);
    onConfirm(); // 先更新 store（路径），再由 SessionDropdown 触发 switch
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
                    color: 'var(--text-primary)', fontSize: 12,
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                    outline: 'none', boxSizing: 'border-box',
                  }}
                  placeholder="/path/to/project"
                />
                {pathDropdown && recentPaths.length > 0 && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 7, zIndex: 10, maxHeight: 160, overflowY: 'auto',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                  }}>
                    {recentPaths.map(p => (
                      <div
                        key={p}
                        onClick={() => { onSelectRecent(p); setPathDropdown(false); }}
                        style={{
                          padding: '6px 10px', fontSize: 11,
                          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
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

      {/* 切换确认弹窗 */}
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
              <div><span style={{ color: 'var(--text-dim)' }}>当前: </span><code style={{ fontSize: 12 }}>{oldPath}</code></div>
              <div style={{ marginBottom: 12 }}><span style={{ color: 'var(--text-dim)' }}>新: </span><code style={{ fontSize: 12 }}>{initialPath}</code></div>
              <div style={{ color: 'var(--warn)', marginBottom: 4 }}>切换将终止当前 Claude Code 进程</div>
              <div style={{ color: 'var(--text-dim)', fontSize: 11 }}>当前对话历史将丢失，确定要切换吗？</div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setShowConfirm(false)} style={{
                padding: '7px 14px', borderRadius: 7, fontSize: 12, cursor: 'pointer',
                background: 'transparent', border: '1px solid var(--border)',
                color: 'var(--text-dim)', fontFamily: 'inherit',
              }}>取消</button>
              <button onClick={() => { setShowConfirm(false); onCancel(); }} style={{
                padding: '7px 14px', borderRadius: 7, fontSize: 12, cursor: 'pointer',
                background: 'var(--bg-input)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', fontFamily: 'inherit',
              }}>保留当前会话</button>
              <button onClick={handleSwitch} style={{
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

// ── 主组件 ────────────────────────────────────────────────────
export function SessionDropdown({ onNewSession, onSwitchSession }: Props) {
  const { sessions, activeSessionId, setActive, addSession, updateSession } = useSessionStore();
  const { paths: recentPaths, addPath } = usePathHistory();

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPath, setEditPath] = useState('');
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
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditPath('');
  };

  const commitEdit = () => {
    if (!editingId) return;
    const trimmedPath = editPath.trim();
    if (!trimmedPath) { cancelEdit(); return; }
    const oldSession = sessions.find(s => s.id === editingId)!;
    const pathChanged = oldSession.projectPath !== trimmedPath;

    updateSession(editingId, {
      name: editName.trim() || oldSession.name,
      projectPath: trimmedPath,
    });

    if (pathChanged) {
      addPath(trimmedPath);
      // 触发路径切换：kill 当前进程并用新路径重新 spawn
      onSwitchSession(editingId);
    }
    cancelEdit();
  };

  const handleBrowse = async () => {
    try {
      const dir = await (window as unknown as { showDirectoryPicker?: () => Promise<{ name: string }> }).showDirectoryPicker?.();
      if (dir) setEditPath(dir.name);
    } catch {
      // 用户取消
    }
  };

  const handleNewBrowse = async () => {
    try {
      const dir = await (window as unknown as { showDirectoryPicker?: () => Promise<{ name: string }> }).showDirectoryPicker?.();
      if (dir) setNewPath(dir.name);
    } catch {
      // 用户取消
    }
  };

  const handleCreateSession = () => {
    const name = newName.trim() || `会话 ${Date.now()}`;
    const path = newPath.trim() || sessions[0]?.projectPath || '/Users/ouguangji/2026/cc-web-ui';
    const id = `session_${Date.now()}`;
    addSession({ id, name, projectPath: path, createdAt: Date.now(), isActive: true });
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
                <span style={{ color: 'var(--text-secondary)', fontSize: 11, flex: 1 }}>{s.name}</span>
                <span
                  onClick={(e) => { e.stopPropagation(); startEdit(s); }}
                  style={{ color: 'var(--accent)', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}
                >
                  <EditIcon /> 编辑
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

      {/* 编辑会话 */}
      {editingId && (
        <PathEditModal
          mode="edit"
          initialName={editName}
          initialPath={editPath}
          recentPaths={recentPaths}
          onNameChange={setEditName}
          onPathChange={setEditPath}
          onBrowse={handleBrowse}
          onSelectRecent={(p) => { setEditPath(p); }}
          onCancel={cancelEdit}
          onConfirm={commitEdit}
          oldPath={sessions.find(s => s.id === editingId)?.projectPath}
        />
      )}

      {/* 新建会话 */}
      {creating && (
        <PathEditModal
          mode="create"
          initialName={newName}
          initialPath={newPath}
          recentPaths={recentPaths}
          onNameChange={setNewName}
          onPathChange={setNewPath}
          onBrowse={handleNewBrowse}
          onSelectRecent={(p) => { setNewPath(p); }}
          onCancel={() => { setCreating(false); setNewName(''); setNewPath(''); }}
          onConfirm={handleCreateSession}
        />
      )}
    </>
  );
}
