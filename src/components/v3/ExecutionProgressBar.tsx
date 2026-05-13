/**
 * ExecutionProgressBar — 执行进度条组件
 * Extracted from FlowExecutionView.tsx
 */

import { STEP_COLORS, type NodeStatus } from './FlowTypes';

export interface ExecutionProgressBarProps {
  current: number;
  total: number;
  statusLabel: NodeStatus;
}

export function ExecutionProgressBar({ current, total, statusLabel }: ExecutionProgressBarProps) {
  const ratio = total > 0 ? Math.round((current / total) * 100) : 0;
  const sc = STEP_COLORS[statusLabel];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{
        flex: 1,
        height: 6,
        borderRadius: 3,
        background: 'rgba(255,255,255,0.05)',
        overflow: 'hidden',
      }}>
        <div
          style={{
            width: `${ratio}%`,
            height: '100%',
            borderRadius: 3,
            background: sc.stroke,
            transition: 'width 0.3s ease-out',
          }}
        />
      </div>
      <span style={{ fontSize: 10, color: sc.stroke, fontWeight: 500, minWidth: 32, textAlign: 'right' }}>
        {ratio}%
      </span>
    </div>
  );
}
