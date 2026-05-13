/**
 * ToolBarChart — Top 6 工具调用水平柱状图
 * Extracted from DataDashboard.tsx
 */

import { formatNumber } from '@/utils/format';
import type { ToolCallStats } from '@/types/dashboard';

const COLORS = ['#4a9eff', '#8b5cf6', '#22c55e', '#f97316', '#ec4899', '#14b8a6'];

export interface ToolBarChartProps {
  tools: ToolCallStats[];
}

export function ToolBarChart({ tools }: ToolBarChartProps) {
  const maxCount = Math.max(...tools.map(t => t.count), 1);
  const top6 = tools.slice(0, 6);

  if (tools.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, color: 'var(--text-muted)', fontSize: 12 }}>
        暂无工具调用数据
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {top6.map((tool, i) => {
        const pct = (tool.count / maxCount) * 100;
        return (
          <div key={tool.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 9,
                fontWeight: 700,
                color: '#fff',
                background: COLORS[i % COLORS.length],
                flexShrink: 0,
              }}
            >
              {i + 1}
            </div>
            <div
              style={{
                width: 120,
                fontSize: 10,
                color: 'var(--text-secondary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
              title={tool.name}
            >
              {tool.name}
            </div>
            <div style={{ flex: 1, height: 6, background: 'var(--bg-input)', borderRadius: 3, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, ${COLORS[i % COLORS.length]}cc, ${COLORS[i % COLORS.length]})`,
                  borderRadius: 3,
                  transition: 'width 0.5s ease',
                }}
              />
            </div>
            <div
              style={{
                fontSize: 10,
                color: 'var(--text-primary)',
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 600,
                width: 40,
                textAlign: 'right',
                flexShrink: 0,
              }}
            >
              {formatNumber(tool.count)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
