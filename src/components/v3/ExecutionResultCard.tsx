/**
 * ExecutionResultCard — 执行结果卡片组件
 * Extracted from FlowExecutionView.tsx
 */

import { NODE_COLORS, type FlowNode } from './FlowTypes';

export interface ExecutionResultCardProps {
  node: FlowNode;
  result?: string;
  error?: string;
}

export function ExecutionResultCard({ node, result, error }: ExecutionResultCardProps) {
  const colors = NODE_COLORS[node.type];

  return (
    <div
      style={{
        padding: 8,
        borderRadius: 6,
        border: `1px solid ${colors.border}40`,
        background: node.status === 'completed'
          ? 'rgba(16,185,129,0.06)'
          : node.status === 'failed'
            ? 'rgba(239,68,68,0.06)'
            : 'rgba(255,255,255,0.03)',
        transition: 'all 0.15s ease-out',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 500, color: colors.text }}>{node.label}</span>
        <span
          style={{
            fontSize: 9,
            padding: '1px 4px',
            borderRadius: 3,
            color: node.status === 'completed' ? '#6EE7B7' : node.status === 'failed' ? '#F87171' : '#9CA3AF',
            background: node.status === 'completed'
              ? 'rgba(16,185,129,0.15)'
              : node.status === 'failed'
                ? 'rgba(239,68,68,0.15)'
                : 'rgba(255,255,255,0.05)',
          }}
        >
          {node.status}
        </span>
      </div>
      {node.type === 'decision' && node.config?.condition && (
        <div style={{ fontSize: 9, color: '#9CA3AF', marginBottom: 2 }}>
          条件: {node.config.condition}
        </div>
      )}
      {(result || error) && (
        <div style={{
          fontSize: 10,
          marginTop: 4,
          padding: '4px 6px',
          borderRadius: 4,
          color: error ? '#FCA5A5' : '#A7F3D0',
          background: error ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)',
          wordBreak: 'break-word',
        }}>
          {error ?? result}
        </div>
      )}
    </div>
  );
}
