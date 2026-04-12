/**
 * 错误率趋势图表组件
 * 使用面积图 + 渐变填充，展示每日错误率与调用次数趋势
 * 设计参考: ui-ux-pro-max Data-Dense Dashboard + Area Chart 最佳实践
 */

import { useState, useEffect, useCallback } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  getErrorRateTrend,
  type ErrorRateTrend,
  type TimeRange,
} from '@/utils/executionStats';

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

interface ErrorRateTrendChartProps {
  timeRange?: TimeRange;
  /** 工作路径（用于按路径过滤） */
  workspacePath?: string;
  style?: React.CSSProperties;
}

// ---------------------------------------------------------------------------
// 骨架屏
// ---------------------------------------------------------------------------

function ChartSkeleton() {
  return (
    <div style={{ padding: '16px 16px 12px' }}>
      {/* Y轴占位 */}
      <div style={{ display: 'flex', height: 220, gap: 0 }}>
        {/* Y轴标签 */}
        <div style={{ width: 36, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingTop: 8, paddingBottom: 16 }}>
          {[0, 25, 50, 75, 100].map(v => (
            <div key={v} style={{ height: 9, width: 28, background: 'var(--bg-input)', borderRadius: 4, opacity: 0.5 }} />
          ))}
        </div>
        {/* 图表区 */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 3, paddingBottom: 16 }}>
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: `${30 + Math.sin(i * 1.5) * 25 + 20}%`,
                background: 'linear-gradient(90deg, var(--bg-input) 25%, var(--border) 50%, var(--bg-input) 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s infinite',
                borderRadius: '4px 4px 0 0',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 空状态
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div style={{
      height: 220,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      color: 'var(--text-muted)',
    }}>
      {/* 趋势线图标 */}
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <rect x="4" y="4" width="32" height="32" rx="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.4" />
        <path d="M10 28 L18 20 L24 24 L32 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
        <circle cx="10" cy="28" r="2" fill="currentColor" opacity="0.5" />
        <circle cx="18" cy="20" r="2" fill="currentColor" opacity="0.5" />
        <circle cx="24" cy="24" r="2" fill="currentColor" opacity="0.5" />
        <circle cx="32" cy="14" r="2" fill="currentColor" opacity="0.5" />
      </svg>
      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>
        暂无趋势数据
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
        发送消息后将自动生成统计
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 自定义工具提示
// ---------------------------------------------------------------------------

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
  payload: ErrorRateTrend;
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const date = label ? new Date(label) : null;
  const dateStr = date ? `${date.getMonth() + 1}月${date.getDate()}日` : label;
  const d = payload[0]?.payload as ErrorRateTrend;

  return (
    <div style={{
      background: 'rgba(19, 19, 42, 0.92)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 10,
      padding: '10px 14px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      minWidth: 160,
    }}>
      {/* 日期标题 */}
      <div style={{
        fontSize: 11,
        fontWeight: 600,
        color: '#9ca3af',
        marginBottom: 8,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}>
        {dateStr}
      </div>

      {/* 错误率 */}
      {payload.map((entry, i) => {
        const isError = entry.name === 'errorRate';
        return (
          <div key={i} style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: isError && payload.length > 1 ? 6 : 0,
          }}>
            {/* 指示器 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: entry.color,
                boxShadow: `0 0 6px ${entry.color}80`,
                flexShrink: 0,
              }} />
              <span style={{ fontSize: 11, color: '#9ca3af' }}>
                {isError ? '错误率' : '调用次数'}
              </span>
            </div>
            {/* 数值 */}
            <span style={{
              fontSize: 13,
              fontWeight: 700,
              fontFamily: "'JetBrains Mono', monospace",
              color: entry.color,
            }}>
              {isError ? `${entry.value.toFixed(1)}%` : entry.value.toLocaleString()}
            </span>
          </div>
        );
      })}

      {/* 子数据 */}
      {d && (
        <div style={{
          marginTop: 8,
          paddingTop: 8,
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
            成功 {d.totalCalls - d.errorCalls}
          </span>
          <span style={{ fontSize: 10, color: '#f87171' }}>失败 {d.errorCalls}</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 主组件
// ---------------------------------------------------------------------------

export function ErrorRateTrendChart({ timeRange = 7, workspacePath, style }: ErrorRateTrendChartProps) {
  const [data, setData] = useState<ErrorRateTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const trend = await getErrorRateTrend(timeRange, workspacePath);
      setData(trend);
    } catch (err) {
      console.error('[ErrorRateTrendChart] Failed to load data:', err);
      setError('加载数据失败');
    } finally {
      setLoading(false);
    }
  }, [timeRange, workspacePath]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── KPI 摘要 ──────────────────────────────────────────────────────────────
  const totalCalls = data.reduce((s, d) => s + d.totalCalls, 0);
  const totalErrors = data.reduce((s, d) => s + d.errorCalls, 0);
  const avgRate = totalCalls > 0 ? (totalErrors / totalCalls) * 100 : 0;

  const kpiItems = [
    { label: '总调用', value: totalCalls.toLocaleString(), accent: '#4a9eff' },
    { label: '错误次数', value: totalErrors.toLocaleString(), accent: '#f87171' },
    { label: '平均错误率', value: `${avgRate.toFixed(1)}%`, accent: avgRate > 5 ? '#f87171' : avgRate > 2 ? '#fbbf24' : '#4ade80' },
  ];

  return (
    <div style={style}>
      {/* 标题栏 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px 0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* 趋势图标 */}
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 10 L5 6 L8 8 L13 3" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="13" cy="3" r="2" fill="var(--accent)" />
          </svg>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            错误率趋势
          </span>
        </div>

        {/* KPI 迷你指标 */}
        {!loading && data.length > 0 && (
          <div style={{ display: 'flex', gap: 16 }}>
            {kpiItems.map(item => (
              <div key={item.label} style={{ textAlign: 'right' }}>
                <div style={{
                  fontSize: 14,
                  fontWeight: 700,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: item.accent,
                  lineHeight: 1,
                }}>
                  {item.value}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 图表主体 */}
      {loading ? (
        <ChartSkeleton />
      ) : data.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ height: 220, padding: '8px 8px 8px 0' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <defs>
                {/* 错误率渐变（橙→红） */}
                <linearGradient id="errorGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f97316" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0.02} />
                </linearGradient>
                {/* 调用次数渐变（蓝→青） */}
                <linearGradient id="callsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4a9eff" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.02} />
                </linearGradient>
              </defs>

              {/* 网格线 */}
              <CartesianGrid
                strokeDasharray="2 4"
                stroke="rgba(255,255,255,0.05)"
                vertical={false}
              />

              {/* X轴 */}
              <XAxis
                dataKey="date"
                tick={{ fill: '#6b7280', fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value: string) => {
                  const d = new Date(value);
                  return `${d.getMonth() + 1}/${d.getDate()}`;
                }}
                interval={Math.floor(data.length / 7)}
              />

              {/* Y轴 */}
              <YAxis
                tick={{ fill: '#6b7280', fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `${v}%`}
                domain={[0, Math.max(10, Math.ceil(avgRate * 3 / 10) * 10)]}
                width={36}
              />

              {/* 工具提示 */}
              <Tooltip
                content={<CustomTooltip />}
                cursor={{
                  stroke: 'rgba(255,255,255,0.12)',
                  strokeWidth: 1,
                  strokeDasharray: '4 4',
                }}
              />

              {/* 图例 */}
              <Legend
                iconType="circle"
                iconSize={7}
                wrapperStyle={{
                  fontSize: 11,
                  color: '#9ca3af',
                  paddingTop: 4,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
                formatter={(value: string) =>
                  value === 'errorRate' ? '错误率' : '调用次数'
                }
              />

              {/* 调用次数面积图（放在错误率下方） */}
              <Area
                type="monotone"
                dataKey="totalCalls"
                name="totalCalls"
                stroke="#4a9eff"
                strokeWidth={1.5}
                fill="url(#callsGrad)"
                dot={false}
                activeDot={{ r: 3, fill: '#4a9eff', strokeWidth: 0 }}
              />

              {/* 错误率面积图（突出显示） */}
              <Area
                type="monotone"
                dataKey="errorRate"
                name="errorRate"
                stroke="#f97316"
                strokeWidth={2}
                fill="url(#errorGrad)"
                dot={false}
                activeDot={{ r: 4, fill: '#f97316', strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 底部 KPI 条 */}
      {!loading && data.length > 0 && (
        <div style={{
          display: 'flex',
          padding: '0 16px 12px',
          gap: 8,
        }}>
          {kpiItems.map((item, i) => (
            <div
              key={item.label}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px',
                background: 'var(--bg-input)',
                borderRadius: 8,
                border: `1px solid ${i === 2 ? item.accent + '40' : 'var(--border)'}`,
              }}
            >
              {/* 状态点 */}
              <div style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: item.accent,
                boxShadow: `0 0 8px ${item.accent}60`,
                flexShrink: 0,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: item.accent,
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {item.value}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 1 }}>
                  {item.label}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
