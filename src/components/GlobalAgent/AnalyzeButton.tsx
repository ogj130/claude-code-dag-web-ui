/**
 * AnalyzeButton — 全局 Agent 分析触发按钮
 */

interface AnalyzeButtonProps {
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
}

export function AnalyzeButton({ disabled, loading, onClick }: AnalyzeButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label="全局分析"
      style={{
        padding: '7px 16px',
        fontSize: 12,
        fontWeight: 500,
        background: disabled
          ? 'var(--bg-input)'
          : 'linear-gradient(135deg, rgba(74, 142, 255, 0.15), rgba(139, 92, 246, 0.15))',
        border: `1px solid ${disabled ? 'var(--border)' : 'rgba(74, 142, 255, 0.4)'}`,
        borderRadius: 8,
        color: disabled ? 'var(--text-muted)' : 'var(--accent)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        transition: 'all 0.15s',
        opacity: disabled ? 0.6 : 1,
      }}
      onMouseEnter={e => {
        if (!disabled) {
          e.currentTarget.style.background = 'linear-gradient(135deg, rgba(74, 142, 255, 0.25), rgba(139, 92, 246, 0.25))';
          e.currentTarget.style.borderColor = 'rgba(74, 142, 255, 0.6)';
        }
      }}
      onMouseLeave={e => {
        if (!disabled) {
          e.currentTarget.style.background = 'linear-gradient(135deg, rgba(74, 142, 255, 0.15), rgba(139, 92, 246, 0.15))';
          e.currentTarget.style.borderColor = 'rgba(74, 142, 255, 0.4)';
        }
      }}
    >
      {loading ? (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
            <line x1="12" y1="2" x2="12" y2="6" />
            <line x1="12" y1="18" x2="12" y2="22" />
            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
            <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
            <line x1="2" y1="12" x2="6" y2="12" />
            <line x1="18" y1="12" x2="22" y2="12" />
            <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
            <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
          </svg>
          分析中...
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="10" rx="2" />
            <circle cx="12" cy="5" r="2" />
            <path d="M12 7v4" />
            <line x1="8" y1="16" x2="8" y2="16" />
            <line x1="16" y1="16" x2="16" y2="16" />
          </svg>
          全局分析
        </>
      )}
    </button>
  );
}
