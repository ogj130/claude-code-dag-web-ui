import { useState, useRef, useEffect } from 'react';
import { useSessionStore } from '../../stores/useSessionStore';

interface Props {
  onNewSession: () => void;
}

export function SessionDropdown({ onNewSession }: Props) {
  const { sessions, activeSessionId, setActive } = useSessionStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = sessions.find(s => s.id === activeSessionId);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'var(--bg-input)', border: '1px solid var(--border)',
          padding: '6px 12px', borderRadius: 6, fontSize: 12,
          color: 'var(--text-secondary)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
          fontFamily: 'inherit', transition: 'all 0.2s',
        }}
      >
        <span style={{ color: 'var(--accent)' }}>●</span>
        <span>{active?.name ?? '选择会话'}</span>
        <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 8, minWidth: 220, zIndex: 200,
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)', overflow: 'hidden',
        }}>
          {sessions.map(s => (
            <div
              key={s.id}
              onClick={() => { setActive(s.id); setOpen(false); }}
              style={{
                padding: '10px 14px', fontSize: 12,
                color: s.id === activeSessionId ? 'var(--accent)' : 'var(--text-secondary)',
                background: s.id === activeSessionId ? 'var(--bg-input)' : 'transparent',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = s.id === activeSessionId ? 'var(--bg-input)' : 'transparent')}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }}/>
              <span style={{ flex: 1 }}>{s.name}</span>
              <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                {new Date(s.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
          <div
            onClick={() => { onNewSession(); setOpen(false); }}
            style={{
              borderTop: '1px solid var(--border)', padding: '8px 14px',
              color: 'var(--accent)', fontSize: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-input)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >+ 新建会话</div>
        </div>
      )}
    </div>
  );
}
