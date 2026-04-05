import { useTaskStore } from '../../stores/useTaskStore';

export function BottomBar() {
  const { toolCalls } = useTaskStore();
  const recent = [...toolCalls].reverse().slice(0, 8);

  const pillStyle = (status: string) => {
    const base = {
      padding: '3px 10px', borderRadius: 20, fontSize: 11,
      fontFamily: 'monospace', fontWeight: 500, border: '1px solid',
    };
    switch (status) {
      case 'completed': return { ...base, background: 'var(--success-bg)', color: 'var(--success)', borderColor: 'var(--success-border)' };
      case 'running':   return { ...base, background: 'var(--warn-bg)',    color: 'var(--warn)',    borderColor: 'var(--warn-border)' };
      case 'error':     return { ...base, background: 'var(--error-bg)',   color: 'var(--error)',   borderColor: 'var(--error-border)' };
      default:          return { ...base, background: 'var(--pending-bg)', color: 'var(--pending)', borderColor: 'var(--pending-border)' };
    }
  };

  const icon = (status: string) => {
    switch (status) {
      case 'completed': return '✓';
      case 'running':   return '⟳';
      case 'error':     return '✗';
      default:          return '○';
    }
  };

  return (
    <div style={{
      background: 'var(--bg-bar)',
      borderTop: '1px solid var(--border)',
      padding: '8px 16px',
      display: 'flex', alignItems: 'center', gap: 8,
      transition: 'background 0.3s, border-color 0.3s',
    }}>
      <span style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5, marginRight: 4 }}>
        最近工具
      </span>
      {recent.length === 0 && (
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>暂无工具调用</span>
      )}
      {recent.map(tool => (
        <span key={tool.id} style={pillStyle(tool.status)}>
          {icon(tool.status)} {tool.tool}
        </span>
      ))}
    </div>
  );
}
