import { TokenBar } from './TokenBar';
import { SessionDropdown } from './SessionDropdown';
import { ThemeToggle } from './ThemeToggle';
import { useSessionStore } from '../../stores/useSessionStore';

interface Props {
  theme: 'dark' | 'light';
  onThemeChange: (t: 'dark' | 'light') => void;
  onNewSession: () => void;
}

export function Toolbar({ theme, onThemeChange, onNewSession }: Props) {
  const { addSession } = useSessionStore();

  const handleNewSession = () => {
    const id = `session_${Date.now()}`;
    addSession({
      id,
      name: `会话 ${id.split('_')[1]}`,
      projectPath: '/',
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
      <SessionDropdown onNewSession={handleNewSession} />
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
        }}>⚙ 设置</button>
      </div>
    </div>
  );
}
