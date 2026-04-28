interface StatusBarProps {
  isRunning: boolean;
  error: string | null;
  tokenUsage: { input: number; output: number };
}

export function StatusBar({ isRunning, error, tokenUsage }: StatusBarProps) {
  const statusColor = error ? 'var(--error)' : isRunning ? 'var(--success)' : 'var(--text-muted)';
  const statusLabel = error ? '错误' : isRunning ? '运行中' : '空闲';
  const totalTokens = tokenUsage.input + tokenUsage.output;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '6px 14px', background: 'var(--bg-card)',
      border: '1px solid var(--border)', borderRadius: 0, borderTop: 'none',
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: 11, flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          width: 7, height: 7, borderRadius: '50%',
          background: statusColor, display: 'inline-block',
          boxShadow: "0 0 5px "+statusColor,
        }} />
        <span style={{ color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.05em' }}>Claude Code</span>
        <span style={{ color: 'var(--border)', fontSize: 10 }}>·</span>
        <span style={{ color: 'var(--text-muted)' }}>{statusLabel}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)' }}>
        {tokenUsage.input > 0 && (
          <span>In <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{tokenUsage.input.toLocaleString()}</span></span>
        )}
        {tokenUsage.output > 0 && (
          <span>Out <span style={{ color: 'var(--success)', fontWeight: 600 }}>{tokenUsage.output.toLocaleString()}</span></span>
        )}
        {totalTokens > 0 && (
          <span style={{ color: 'var(--text-secondary)', fontSize: 10 }}>{totalTokens.toLocaleString()} tok</span>
        )}
      </div>
    </div>
  );
}
