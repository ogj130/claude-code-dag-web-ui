interface ErrorFallbackProps {
  /** 错误信息 */
  message?: string;
  /** 重置错误状态的回调 */
  onReset?: () => void;
}

export function ErrorFallback({ message = '组件渲染出错', onReset }: ErrorFallbackProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        background: 'var(--bg-card)',
        border: '1px solid var(--error-border)',
        borderRadius: 10,
        margin: 8,
        minHeight: 120,
        boxShadow: '0 2px 8px rgba(231,76,60,0.08)',
      }}
    >
      {/* 错误图标 */}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: 'rgba(231,76,60,0.1)',
          border: '1px solid rgba(231,76,60,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 10,
          flexShrink: 0,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M8 1L15 14H1L8 1Z"
            stroke="var(--error)"
            strokeWidth="1.4"
            strokeLinejoin="round"
            fill="rgba(231,76,60,0.1)"
          />
          <line x1="8" y1="6" x2="8" y2="9.5" stroke="var(--error)" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="8" cy="11.5" r="0.8" fill="var(--error)" />
        </svg>
      </div>

      {/* 错误提示 */}
      <p
        style={{
          margin: '0 0 10px',
          fontSize: 12,
          fontFamily: "'JetBrains Mono', monospace",
          color: 'var(--error)',
          fontWeight: 600,
          letterSpacing: '0.02em',
          textAlign: 'center',
        }}
      >
        {message}
      </p>

      {/* 重新渲染按钮 */}
      <button
        onClick={onReset}
        style={{
          padding: '5px 14px',
          fontSize: 11,
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 600,
          color: 'var(--error)',
          background: 'rgba(231,76,60,0.1)',
          border: '1px solid rgba(231,76,60,0.3)',
          borderRadius: 6,
          cursor: 'pointer',
          transition: 'background 0.2s, border-color 0.2s',
          letterSpacing: '0.04em',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(231,76,60,0.2)';
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(231,76,60,0.5)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(231,76,60,0.1)';
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(231,76,60,0.3)';
        }}
      >
        重新渲染
      </button>

      {/* 提示文字 */}
      <p
        style={{
          margin: '6px 0 0',
          fontSize: 10,
          color: 'var(--text-dim)',
          textAlign: 'center',
        }}
      >
        点击「重新渲染」尝试恢复
      </p>
    </div>
  );
}
