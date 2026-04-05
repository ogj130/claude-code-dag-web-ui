import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { DAGNode as DAGNodeType } from '../../types/events';

interface Props {
  data: DAGNodeType;
}

const statusStyle: Record<string, React.CSSProperties> = {
  pending: { borderColor: 'var(--dag-node-border)', opacity: 0.6 },
  running: {
    borderColor: 'var(--warn)',
    background: 'var(--warn-bg)',
    animation: 'node-pulse 1.5s infinite',
  },
  completed: { borderColor: 'var(--success)', background: 'var(--success-bg)' },
  failed: { borderColor: 'var(--error)', background: 'var(--error-bg)' },
};

const statusLabel: Record<string, string> = {
  pending: '○ 等待',
  running: '⟳ 运行中',
  completed: '✓ 完成',
  failed: '✗ 失败',
};

const statusColor: Record<string, string> = {
  pending: 'var(--text-dim)',
  running: 'var(--warn)',
  completed: 'var(--success)',
  failed: 'var(--error)',
};

export const DAGNodeComponent = memo(({ data }: Props) => {
  const s = statusStyle[data.status] ?? statusStyle.pending;

  return (
    <div style={{
      background: 'var(--dag-node)',
      border: '1.5px solid',
      borderRadius: 10,
      padding: '10px 14px',
      minWidth: 120,
      textAlign: 'center',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      transition: 'all 0.3s',
      ...s,
    }}>
      {data.parentId && (
        <Handle type="target" position={Position.Top} style={{ background: 'var(--accent)' }} />
      )}
      <div style={{ fontSize: 16, marginBottom: 4 }}>
        {data.type === 'agent' ? '🤖' : '🔧'}
      </div>
      <div style={{ color: 'var(--text-primary)', fontWeight: 500, fontSize: 12 }}>
        {data.label}
      </div>
      <div style={{ fontSize: 10, marginTop: 4, color: statusColor[data.status] ?? 'var(--text-dim)' }}>
        {statusLabel[data.status] ?? '○ 等待'}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: 'var(--accent)' }} />
    </div>
  );
});

DAGNodeComponent.displayName = 'DAGNodeComponent';
