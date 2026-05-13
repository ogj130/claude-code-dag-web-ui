/**
 * DonutChart — 工作路径占比环形图
 * Extracted from DataDashboard.tsx
 */

import { formatNumber } from '@/utils/format';
import type { WorkspaceStats } from '@/types/dashboard';

const COLORS = ['#4a9eff', '#8b5cf6', '#22c55e', '#f97316', '#ef4444', '#ec4899', '#14b8a6'];

export interface DonutChartProps {
  stats: WorkspaceStats[];
}

export function DonutChart({ stats }: DonutChartProps) {
  const total = stats.reduce((s, w) => s + w.count, 0);
  if (total === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <svg width="120" height="120" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="40" fill="none" stroke="var(--bg-input)" strokeWidth="16" />
          <text x="60" y="56" textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--text-secondary)" fontFamily="'JetBrains Mono', monospace">0</text>
          <text x="60" y="70" textAnchor="middle" fontSize="8" fill="var(--text-muted)">会话</text>
        </svg>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>暂无数据</span>
      </div>
    );
  }

  const r = 40;
  const cx = 60;
  const cy = 60;
  const circumference = 2 * Math.PI * r;
  const centerGap = 6;

  let accumulated = 0;
  const segments = stats.map((s, i) => {
    const fraction = s.count / total;
    const dashLen = fraction * circumference - centerGap;
    const offset = accumulated * circumference;
    accumulated += fraction;
    return {
      color: COLORS[i % COLORS.length],
      dashArray: `${Math.max(0, dashLen)} ${circumference}`,
      dashOffset: -offset,
      name: s.path,
      count: s.count,
      pct: (fraction * 100).toFixed(0),
    };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg width="120" height="120" viewBox="0 0 120 120">
        <g>
          {segments.map((seg, i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth="16"
              strokeDasharray={seg.dashArray}
              strokeDashoffset={seg.dashOffset}
              style={{ transition: 'all 0.4s ease' }}
            />
          ))}
        </g>
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="16" fontWeight="700" fill="var(--text-primary)" fontFamily="'JetBrains Mono', monospace">
          {formatNumber(total)}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize="8" fill="var(--text-muted)">
          会话
        </text>
      </svg>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', justifyContent: 'center', maxWidth: 200 }}>
        {stats.slice(0, 5).map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 7, height: 7, borderRadius: 2, background: COLORS[i % COLORS.length], flexShrink: 0 }} />
            <span style={{ fontSize: 9, color: 'var(--text-muted)', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {s.path.split('/').pop() ?? s.path}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
