import { useTaskStore } from '../../stores/useTaskStore';
import { ToolIcon, CheckIcon, XIcon } from '../Icons';

const PILL_STYLES = {
  completed: {
    bg: 'var(--success-bg)', color: 'var(--success)', border: 'var(--success-border)',
  },
  running: {
    bg: 'var(--warn-bg)', color: 'var(--warn)', border: 'var(--warn-border)',
  },
  error: {
    bg: 'var(--error-bg)', color: 'var(--error)', border: 'var(--error-border)',
  },
  default: {
    bg: 'var(--pending-bg)', color: 'var(--pending)', border: 'var(--pending-border)',
  },
};

function StatusIcon({ status }: { status: string }) {
  if (status === 'completed') return <CheckIcon size={10} />;
  if (status === 'error') return <XIcon size={10} />;
  // running: animated pulse via CSS
  return (
    <span style={{
      width: 7, height: 7, borderRadius: '50%',
      background: 'currentColor',
      display: 'inline-block',
      animation: 'pulse-dot 1.2s ease-in-out infinite',
    }} />
  );
}

export function BottomBar() {
  const { toolCalls, pendingInputsCount, currentQueryId } = useTaskStore();
  const recent = [...toolCalls].reverse().slice(0, 8);

  return (
    <div style={{
      background: 'var(--bg-bar)',
      borderTop: '1px solid var(--border)',
      padding: '7px 16px',
      display: 'flex', alignItems: 'center', gap: 10,
      transition: 'background 0.3s, border-color 0.3s',
      minHeight: 38,
    }}>
      {/* 标签 */}
      <span style={{
        fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase',
        letterSpacing: '0.08em', flexShrink: 0, fontFamily: 'monospace',
      }}>
        工具
      </span>

      {/* 工具药丸 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
        {recent.length === 0 ? (
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>—</span>
        ) : recent.map(tool => {
          const s = PILL_STYLES[tool.status as keyof typeof PILL_STYLES] ?? PILL_STYLES.default;
          return (
            <div
              key={tool.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '2px 8px', borderRadius: 20,
                fontSize: 10, fontFamily: 'monospace', fontWeight: 500,
                background: s.bg, color: s.color,
                border: `1px solid ${s.border}`,
                transition: 'all 0.3s',
                animation: tool.status === 'running' ? 'card-in 0.3s ease-out' : 'none',
              }}
            >
              <StatusIcon status={tool.status} />
              <ToolIcon tool={tool.tool} size={10} />
              {tool.tool}
            </div>
          );
        })}
      </div>

      {/* 当前 Query 状态（居中） */}
      {currentQueryId && (
        <div style={{
          flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 5,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--warn)',
            display: 'inline-block',
            animation: 'pulse-dot 1s ease-in-out infinite',
            flexShrink: 0,
          }} />
          <span style={{ fontSize: 11, color: 'var(--warn)', fontFamily: 'monospace' }}>
            {currentQueryId}
          </span>
        </div>
      )}

      {/* 队列提示 */}
      {pendingInputsCount > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          marginLeft: 'auto', flexShrink: 0,
          padding: '2px 8px', borderRadius: 20,
          background: 'var(--warn-bg)',
          border: '1px solid var(--warn-border)',
          fontSize: 10, color: 'var(--warn)',
          fontFamily: 'monospace',
        }}>
          +{pendingInputsCount} 排队中
        </div>
      )}
    </div>
  );
}
