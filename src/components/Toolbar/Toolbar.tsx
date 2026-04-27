import { TokenBar } from './TokenBar';
import { SessionDropdown } from './SessionDropdown';
import { ThemeToggle } from './ThemeToggle';
import { ModelSwitcher } from '../ModelSwitcher';
import { useSessionStore, isPrivacyModeEnabled } from '../../stores/useSessionStore';
import { useTaskStore } from '../../stores/useTaskStore';
import type { ModelConfig } from '@/types/models';

interface Props {
  theme: 'dark' | 'light';
  onThemeChange: (t: 'dark' | 'light') => void;
  onNewSession: () => void;
  onSwitchSession: (sessionId: string) => void;
  onSwitchModel?: (config: ModelConfig) => void;
}

function ToolbarRuntimeInfo() {
  const { toolCalls, pendingInputsCount, currentQueryId } = useTaskStore();
  const recent = [...toolCalls].reverse().slice(0, 3);

  if (recent.length === 0 && !currentQueryId && pendingInputsCount === 0) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
      {recent.map(tool => (
        <span
          key={tool.id}
          style={{
            padding: '1px 6px',
            borderRadius: 10,
            fontSize: 10,
            fontFamily: 'monospace',
            background: 'var(--bg-card)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border)',
            whiteSpace: 'nowrap',
          }}
        >
          {tool.tool}
        </span>
      ))}
      {currentQueryId && (
        <span style={{
          fontSize: 10, color: 'var(--warn)', fontFamily: 'monospace',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <span style={{
            width: 5, height: 5, borderRadius: '50%',
            background: 'var(--warn)', display: 'inline-block',
            animation: 'pulse-dot 1s ease-in-out infinite',
          }}/>
          {currentQueryId.slice(0, 8)}
        </span>
      )}
      {pendingInputsCount > 0 && (
        <span style={{
          padding: '1px 6px', borderRadius: 10, fontSize: 10,
          background: 'var(--warn-bg)', border: '1px solid var(--warn-border)',
          color: 'var(--warn)', fontFamily: 'monospace',
        }}>
          +{pendingInputsCount}
        </span>
      )}
    </div>
  );
}

export function Toolbar({ theme, onThemeChange, onNewSession, onSwitchSession, onSwitchModel }: Props) {
  const { addSession } = useSessionStore();

  const handleNewSession = () => {
    // 隐私模式下不创建新会话
    if (isPrivacyModeEnabled()) {
      return;
    }
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
      <span style={{ color: 'var(--border)', fontSize: 12 }}>|</span>
      <ModelSwitcher onSwitch={onSwitchModel} />

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 7, height: 7, borderRadius: '50%',
          background: 'var(--success)',
          animation: 'pulse-green 2s infinite',
        }}/>
        <span style={{ fontSize: 11, color: 'var(--success)' }}>Connected</span>
        <span style={{ color: 'var(--border)', fontSize: 12 }}>|</span>
        <ThemeToggle theme={theme} onChange={onThemeChange} />
        <ToolbarRuntimeInfo />
      </div>
    </div>
  );
}
