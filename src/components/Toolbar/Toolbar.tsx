import { useState } from 'react';
import { TokenBar } from './TokenBar';
import { SessionDropdown } from './SessionDropdown';
import { ThemeToggle } from './ThemeToggle';
import { useSessionStore, isPrivacyModeEnabled } from '../../stores/useSessionStore';
import { useTaskStore } from '../../stores/useTaskStore';
import { PrivacySettings } from '../PrivacySettings';

interface Props {
  theme: 'dark' | 'light';
  onThemeChange: (t: 'dark' | 'light') => void;
  onNewSession: () => void;
  onSwitchSession: (sessionId: string) => void;
  onOpenThemeSettings: () => void;
  onOpenAnalytics?: () => void;
  onOpenTokenAnalytics?: () => void;
  onOpenRAG?: () => void;
}

export function Toolbar({ theme, onThemeChange, onNewSession, onSwitchSession, onOpenThemeSettings, onOpenAnalytics, onOpenTokenAnalytics, onOpenRAG }: Props) {
  const { addSession } = useSessionStore();
  const { groupingEnabled, toggleGrouping } = useTaskStore();
  const [showPrivacySettings, setShowPrivacySettings] = useState(false);
  const [privacyMode, setPrivacyMode] = useState(isPrivacyModeEnabled());

  // 定时刷新隐私模式状态
  useState(() => {
    const interval = setInterval(() => {
      setPrivacyMode(isPrivacyModeEnabled());
    }, 1000);
    return () => clearInterval(interval);
  });

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

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 7, height: 7, borderRadius: '50%',
          background: 'var(--success)',
          animation: 'pulse-green 2s infinite',
        }}/>
        <span style={{ fontSize: 11, color: 'var(--success)' }}>Connected</span>
        <span style={{ color: 'var(--border)', fontSize: 12 }}>|</span>
        <ThemeToggle theme={theme} onChange={onThemeChange} />
        <button
          onClick={toggleGrouping}
          style={{
            background: groupingEnabled ? 'var(--accent)' : 'transparent',
            color: groupingEnabled ? 'white' : 'var(--text-muted)',
            border: '1px solid var(--border)', padding: '6px 12px',
            borderRadius: 6, fontSize: 12, cursor: 'pointer',
            fontFamily: 'inherit', transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth={1.8}
            strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          节点分组
        </button>
        <button
          onClick={() => setShowPrivacySettings(true)}
          style={{
            background: 'transparent', color: 'var(--text-muted)',
            border: '1px solid var(--border)', padding: '6px 12px',
            borderRadius: 6, fontSize: 12, cursor: 'pointer',
            fontFamily: 'inherit', transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', gap: 5,
            position: 'relative',
          }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth={1.8}
            strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
            <circle cx="12" cy="16" r="1" fill="currentColor" />
          </svg>
          隐私设置
          {privacyMode && (
            <span style={{
              position: 'absolute',
              top: -3,
              right: -3,
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: 'var(--accent)',
              border: '2px solid var(--bg-bar)',
            }} />
          )}
        </button>
        <button
          onClick={onOpenAnalytics}
          style={{
            background: 'transparent', color: 'var(--text-muted)',
            border: '1px solid var(--border)', padding: '6px 12px',
            borderRadius: 6, fontSize: 12, cursor: 'pointer',
            fontFamily: 'inherit', transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth={1.8}
            strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/>
            <path d="M22 12A10 10 0 0 0 12 2v10z"/>
          </svg>
          执行分析
        </button>
        <button
          onClick={onOpenTokenAnalytics}
          style={{
            background: 'transparent', color: 'var(--text-muted)',
            border: '1px solid var(--border)', padding: '6px 12px',
            borderRadius: 6, fontSize: 12, cursor: 'pointer',
            fontFamily: 'inherit', transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth={1.8}
            strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v20M2 12h20" />
            <path d="M4 4l16 16M20 4L4 20" />
          </svg>
          Token 统计
        </button>
        <button
          onClick={onOpenRAG}
          style={{
            background: 'transparent', color: 'var(--text-muted)',
            border: '1px solid var(--border)', padding: '6px 12px',
            borderRadius: 6, fontSize: 12, cursor: 'pointer',
            fontFamily: 'inherit', transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth={1.8}
            strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
          RAG 检索
        </button>
        <button
          onClick={onOpenThemeSettings}
          style={{
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
      <PrivacySettings
        isOpen={showPrivacySettings}
        onClose={() => setShowPrivacySettings(false)}
      />
    </div>
  );
}
