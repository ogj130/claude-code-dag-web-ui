/**
 * 错误率趋势图表组件
 * 展示每日工具调用错误率折线图
 */

import { useState, useEffect, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { getErrorRateTrend, type ErrorRateTrend, type TimeRange } from '@/utils/executionStats';

interface ErrorRateTrendChartProps {
  /** 时间范围 */
  timeRange?: TimeRange;
  /** 面板样式 */
  style?: React.CSSProperties;
}

export function ErrorRateTrendChart({ timeRange = 7, style }: ErrorRateTrendChartProps) {
  const [data, setData] = useState<ErrorRateTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 加载数据
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const trend = await getErrorRateTrend(timeRange);
      setData(trend);
    } catch (err) {
      console.error('[ErrorRateTrendChart] Failed to load data:', err);
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

  if (data.length === 0) {
    return (
      <div style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-text-muted)',
      }}>
        暂无错误率趋势数据
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
        错误率趋势
      </div>

      {/* 折线图 */}
      <div style={{ height: 260, padding: '16px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-border-light)"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-border)' }}
              tickFormatter={(value) => {
                const date = new Date(value);
                return `${date.getMonth() + 1}/${date.getDate()}`;
              }}
            />
            <YAxis
              tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-border)' }}
              tickFormatter={(value) => `${value}%`}
              domain={[0, 'auto']}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div style={{
                    backgroundColor: 'var(--color-bg-elevated)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 6,
                    padding: '10px 14px',
                    fontSize: 12,
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--color-text)' }}>
                      {label}
                    </div>
                    {payload.map((entry, index) => {
                      const data = entry.payload as ErrorRateTrend;
                      const name = entry.name === 'errorRate' ? '错误率' : '调用次数';
                      return (
                        <div
                          key={index}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 16,
                            marginBottom: 4,
                          }}
                        >
                          <span style={{ color: 'var(--color-text-muted)' }}>
                            {name}:
                          </span>
                          <span style={{ fontWeight: 500, color: entry.color }}>
                            {entry.name === 'errorRate'
                              ? `${data.errorRate}%`
                              : data.totalCalls}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              }}
            />
            <Legend
              formatter={(value) => (
                <span style={{ color: 'var(--color-text)', fontSize: 12 }}>
                  {value === 'errorRate' ? '错误率 (%)' : '调用次数'}
                </span>
              )}
            />
            <Line
              type="monotone"
              dataKey="totalCalls"
              name="totalCalls"
              stroke="var(--color-primary)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: 'var(--color-primary)' }}
            />
            <Line
              type="monotone"
              dataKey="errorRate"
              name="errorRate"
              stroke="var(--color-error)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: 'var(--color-error)' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 统计摘要 */}
      <div style={{
        display: 'flex',
        padding: '0 16px 16px',
        gap: 16,
      }}>
        <div style={summaryCardStyle}>
          <div style={summaryValueStyle}>{getTotalCalls(data)}</div>
          <div style={summaryLabelStyle}>总调用次数</div>
        </div>
        <div style={summaryCardStyle}>
          <div style={{ ...summaryValueStyle, color: 'var(--color-error)' }}>
            {getTotalErrors(data)}
          </div>
          <div style={summaryLabelStyle}>错误次数</div>
        </div>
        <div style={summaryCardStyle}>
          <div style={{ ...summaryValueStyle, color: 'var(--color-accent)' }}>
            {getAvgErrorRate(data)}%
          </div>
          <div style={summaryLabelStyle}>平均错误率</div>
        </div>
      </div>
    </div>
  );
}

// 计算总调用次数
function getTotalCalls(data: ErrorRateTrend[]): number {
  return data.reduce((sum, d) => sum + d.totalCalls, 0);
}

// 计算总错误次数
function getTotalErrors(data: ErrorRateTrend[]): number {
  return data.reduce((sum, d) => sum + d.errorCalls, 0);
}

// 计算平均错误率
function getAvgErrorRate(data: ErrorRateTrend[]): string {
  if (data.length === 0) return '0';
  const totalCalls = getTotalCalls(data);
  const totalErrors = getTotalErrors(data);
  if (totalCalls === 0) return '0';
  return String(Math.round((totalErrors / totalCalls) * 100 * 10) / 10);
}

const summaryCardStyle: React.CSSProperties = {
  flex: 1,
  backgroundColor: 'var(--color-bg-elevated)',
  borderRadius: 8,
  padding: '12px 16px',
  border: '1px solid var(--color-border-light)',
};

const summaryValueStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  color: 'var(--color-text)',
  marginBottom: 4,
};

const summaryLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--color-text-muted)',
};