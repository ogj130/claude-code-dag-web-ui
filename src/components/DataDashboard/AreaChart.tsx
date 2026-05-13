/**
 * AreaChart — 近 7 天 Query 趋势面积图
 * Extracted from DataDashboard.tsx
 */

import { formatNumber, getLast7Days } from '@/utils/format';
import type { QueryTrend } from '@/types/dashboard';

export interface AreaChartProps {
  data: QueryTrend[];
}

export function AreaChart({ data }: AreaChartProps) {
  const days = getLast7Days();
  const values = data.map(d => d.count);
  const maxVal = Math.max(...values, 1);

  const W = 280;
  const H = 120;
  const padX = 8;
  const padY = 8;
  const chartW = W - padX * 2;
  const chartH = H - padY * 2;

  const pts = values.map((v, i) => ({
    x: padX + (i / (values.length - 1)) * chartW,
    y: padY + chartH - (v / maxVal) * chartH,
  }));

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${pts[pts.length - 1].x} ${padY + chartH} L ${padX} ${padY + chartH} Z`;

  const yLabels = [maxVal, 0];

  return (
    <div style={{ width: '100%' }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H + 24}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* 网格线 */}
        {[0, 0.5, 1].map((frac, i) => (
          <line
            key={i}
            x1={padX}
            y1={padY + chartH * frac}
            x2={padX + chartW}
            y2={padY + chartH * frac}
            stroke="var(--border)"
            strokeWidth="0.5"
            strokeDasharray={frac === 0 ? 'none' : '3 3'}
          />
        ))}

        {/* Y轴标签 */}
        {yLabels.map((v, i) => (
          <text
            key={i}
            x={padX - 2}
            y={padY + chartH * i + 4}
            textAnchor="end"
            fontSize="8"
            fill="var(--text-muted)"
            fontFamily="'JetBrains Mono', monospace"
          >
            {formatNumber(v)}
          </text>
        ))}

        {/* 面积 */}
        <path d={areaPath} fill="url(#areaGrad)" />
        {/* 折线 */}
        <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* 数据点 */}
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="var(--accent)" />
        ))}

        {/* X轴标签 */}
        {days.map((d, i) => (
          <text
            key={i}
            x={padX + (i / (days.length - 1)) * chartW}
            y={H + 14}
            textAnchor="middle"
            fontSize="8"
            fill="var(--text-muted)"
          >
            {d}
          </text>
        ))}
      </svg>
    </div>
  );
}
