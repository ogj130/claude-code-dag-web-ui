/**
 * RecoveryNode — DAG 恢复节点组件
 *
 * 展示 RecoveryEngine 的诊断和恢复操作。
 * 类型：retry（琥珀色）、split（蓝色）、skip（灰色）、fail（红色）
 */
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

export interface RecoveryNodeData {
  label: string;
  recoveryType: 'retry' | 'split' | 'skip' | 'fail';
  agentId?: string;
  recoveryAgentId?: string;
  errorMessage?: string;
  status: 'running' | 'completed' | 'failed';
}

const TYPE_CONFIG: Record<string, { color: string; bg: string; border: string; icon: string }> = {
  retry: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: '#f59e0b', icon: '🔄' },
  split: { color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: '#3b82f6', icon: '🔀' },
  skip: { color: '#6b7280', bg: 'rgba(107,114,128,0.08)', border: '#6b7280', icon: '⏭️' },
  fail: { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: '#ef4444', icon: '❌' },
};

const STATUS_ANIM: Record<string, React.CSSProperties> = {
  running: { animation: 'recovery-blink 1s ease-in-out infinite' },
  completed: { opacity: 0.7 },
  failed: { opacity: 1 },
};

export const RecoveryNode = memo(function RecoveryNode({ data }: { data: RecoveryNodeData }) {
  const config = TYPE_CONFIG[data.recoveryType] ?? TYPE_CONFIG.retry;
  const animStyle = STATUS_ANIM[data.status] ?? {};

  return (
    <div
      style={{
        padding: '8px 12px',
        borderRadius: 8,
        background: config.bg,
        border: `1.5px dashed ${config.border}`,
        minWidth: 140,
        maxWidth: 200,
        fontSize: 11,
        color: config.color,
        ...animStyle,
      }}
    >
      <Handle type="target" position={Position.Top} style={{ visibility: 'hidden' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span>{config.icon}</span>
        <span style={{ fontWeight: 600, textTransform: 'uppercase', fontSize: 10 }}>
          {data.recoveryType}
        </span>
        <span style={{
          marginLeft: 'auto',
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: data.status === 'running' ? config.color : data.status === 'completed' ? '#10b981' : '#ef4444',
        }} />
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.3 }}>
        {data.label}
      </div>
      {data.errorMessage && (
        <div style={{
          fontSize: 9,
          color: 'var(--text-muted)',
          marginTop: 4,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {data.errorMessage.slice(0, 60)}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden' }} />
    </div>
  );
});

export default RecoveryNode;
