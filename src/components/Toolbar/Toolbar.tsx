import { TokenBar } from './TokenBar';
import { SessionDropdown } from './SessionDropdown';
import { ThemeToggle } from './ThemeToggle';
import { useSessionStore } from '../../stores/useSessionStore';

interface Props {
  theme: 'dark' | 'light';
  onThemeChange: (t: 'dark' | 'light') => void;
  onNewSession: () => void;
  onSwitchSession: (sessionId: string) => void;
}

export function Toolbar({ theme, onThemeChange, onNewSession, onSwitchSession }: Props) {
  const { addSession } = useSessionStore();

  const handleNewSession = () => {
    const id = `session_${Date.now()}`;
    addSession({
      id,
      name: `会话 ${id.split('_')[1]}`,
      projectPath: '/Users/ouguangji/2026/cc-web-ui',
      createdAt: Date.now(),
      isActive: true,
    });
    onNewSession();
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 16px',
      background: 'var(--bg-bar)',
      borderBottom: '1px solid var(--border)',
      transition: 'background 0.3s, border-color 0.3s',
    }}>
      <button
        onClick={handleNewSession}
        style={{
          background: 'var(--accent)', color: 'white',
          border: 'none', padding: '6px 14px', borderRadius: 6,
          fontSize: 12, fontWeight: 500, cursor: 'pointer',
          fontFamily: 'inherit', transition: 'background 0.2s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-dim)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent)')}
      >+ 新会话</button>

      <span style={{ color: 'var(--border)', fontSize: 12 }}>|</span>
      <SessionDropdown
        onNewSession={onNewSession}
        onSwitchSession={onSwitchSession}
      />
      <span style={{ color: 'var(--border)', fontSize: 12 }}>|</span>
      <TokenBar />

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 7, height: 7, borderRadius: '50%',
          background: 'var(--success)',
          animation: 'pulse-green 2s infinite',
        }}/>
        <span style={{ fontSize: 11, color: 'var(--success)' }}>Connected</span>
        <span style={{ color: 'var(--border)', fontSize: 12 }}>|</span>
        <ThemeToggle theme={theme} onChange={onThemeChange} />
        <button style={{
          background: 'transparent', color: 'var(--text-muted)',
          border: '1px solid var(--border)', padding: '6px 12px',
          borderRadius: 6, fontSize: 12, cursor: 'pointer',
          fontFamily: 'inherit', transition: 'all 0.2s',
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth={1.8}
            strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          设置
        </button>
      </div>
    </div>
  );
}
