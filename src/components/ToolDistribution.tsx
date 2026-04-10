/**
 * 工具分布图表组件
 * 展示工具调用分布饼图和平均响应时间表格
 */

import { useState, useEffect, useCallback } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import {
  getToolDistribution,
  getAverageResponseTime,
  type ToolDistributionData,
  type AverageResponseTime,
  type TimeRange,
} from '@/utils/executionStats';

// 饼图颜色
const COLORS = [
  '#4a9eff', // 蓝
  '#8b5cf6', // 紫
  '#22c55e', // 绿
  '#f97316', // 橙
  '#ef4444', // 红
  '#ec4899', // 粉
  '#14b8a6', // 青
  '#f59e0b', // 黄
  '#6366f1', // 靛
  '#84cc16', // 浅绿
];

interface ToolDistributionProps {
  /** 时间范围 */
  timeRange?: TimeRange;
  /** 面板样式 */
  style?: React.CSSProperties;
}

export function ToolDistribution({ timeRange = 'all', style }: ToolDistributionProps) {
  const [distribution, setDistribution] = useState<ToolDistributionData[]>([]);
  const [responseTime, setResponseTime] = useState<AverageResponseTime[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 加载数据
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [dist, avgTime] = await Promise.all([
        getToolDistribution(timeRange),
        getAverageResponseTime(timeRange),
      ]);

      setDistribution(dist);
      setResponseTime(avgTime);
    } catch (err) {
      console.error('[ToolDistribution] Failed to load data:', err);
      setError('加载数据失败');
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-text-muted)',
      }}>
        加载中...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-error)',
      }}>
        {error}
      </div>
    );
  }

  if (distribution.length === 0) {
    return (
      <div style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-text-muted)',
      }}>
        暂无工具调用数据
      </div>
    );
  }

  return (
    <div style={style}>
      {/* 标题 */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--color-border)',
        fontWeight: 600,
        fontSize: 14,
      }}>
        工具调用分布
      </div>

      {/* 饼图 */}
      <div style={{ height: 280, padding: '16px 8px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={distribution}
              dataKey="count"
              nameKey="toolName"
              cx="50%"
              cy="50%"
              outerRadius={100}
              innerRadius={50}
              label={({ payload }: { payload?: ToolDistributionData }) =>
                payload && payload.percentage > 5 ? `${payload.toolName}` : ''
              }
              labelLine={false}
            >
              {distribution.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                const data = payload[0].payload as ToolDistributionData;
                return (
                  <div style={{
                    backgroundColor: 'var(--color-bg-elevated)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 6,
                    padding: '8px 12px',
                    fontSize: 12,
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>
                      {data.toolName}
                    </div>
                    <div>调用次数: {data.count}</div>
                    <div>占比: {data.percentage}%</div>
                  </div>
                );
              }}
            />
            <Legend
              formatter={(value) => (
                <span style={{ color: 'var(--color-text)', fontSize: 12 }}>
                  {value}
                </span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* 平均响应时间表格 */}
      <div style={{
        padding: '0 16px 16px',
      }}>
        <div style={{
          fontWeight: 500,
          fontSize: 13,
          marginBottom: 8,
          color: 'var(--color-text-muted)',
        }}>
          平均响应时间
        </div>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 12,
        }}>
          <thead>
            <tr style={{
              borderBottom: '1px solid var(--color-border)',
            }}>
              <th style={thStyle}>工具名称</th>
              <th style={thStyle}>调用次数</th>
              <th style={thStyle}>平均耗时</th>
            </tr>
          </thead>
          <tbody>
            {responseTime.slice(0, 8).map((item) => (
              <tr
                key={item.toolName}
                style={{
                  borderBottom: '1px solid var(--color-border-light)',
                }}
              >
                <td style={tdStyle}>{item.toolName}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{item.count}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  {formatDuration(item.avgTime)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// 格式化持续时间
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}min`;
}

const thStyle: React.CSSProperties = {
  padding: '6px 8px',
  textAlign: 'left',
  fontWeight: 500,
  color: 'var(--color-text-muted)',
};

const tdStyle: React.CSSProperties = {
  padding: '8px',
  color: 'var(--color-text)',
};
