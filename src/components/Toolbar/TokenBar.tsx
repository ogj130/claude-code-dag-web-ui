import { useTaskStore } from '../../stores/useTaskStore';

export function TokenBar() {
  const { tokenUsage } = useTaskStore();
  const fmt = (n: number) => n.toLocaleString();

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      background: 'var(--success-bg)',
      border: '1px solid var(--success-border)',
      padding: '5px 10px', borderRadius: 6, fontSize: 11,
    }}>
      <span style={{ color: 'var(--text-muted)' }}>Input:</span>
      <span style={{ fontWeight: 600, color: '#3498db' }}>{fmt(tokenUsage.input)}</span>
      <span style={{ color: 'var(--border)' }}>|</span>
      <span style={{ color: 'var(--text-muted)' }}>Output:</span>
      <span style={{ fontWeight: 600, color: 'var(--success)' }}>{fmt(tokenUsage.output)}</span>
      <span style={{ color: 'var(--border)' }}>|</span>
      <span style={{ color: 'var(--text-muted)' }}>Total:</span>
      <span style={{ fontWeight: 600, color: 'var(--accent)' }}>
        {fmt(tokenUsage.input + tokenUsage.output)}
      </span>
    </div>
  );
}
