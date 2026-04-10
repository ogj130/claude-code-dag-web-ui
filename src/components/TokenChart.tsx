/**
 * Token 趋势折线图
 * 使用 Recharts 实现 7 天/30 天 Token 使用趋势可视化
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { TokenTrendData } from '@/utils/tokenStats';
import { formatTokens } from '@/utils/tokenStats';

interface TokenChartProps {
  /** 趋势数据 */
  data: TokenTrendData[];
}

/**
 * 自定义 Tooltip 内容
 */
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const tokenData = payload.find((p) => p.dataKey === 'totalTokens');
  const queryData = payload.find((p) => p.dataKey === 'queryCount');

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '10px 12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text-secondary)',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      {tokenData && (
        <div
          style={{
            fontSize: 12,
            color: 'var(--accent)',
            display: 'flex',
            gap: 8,
            alignItems: 'center',
          }}
        >
          <span style={{ fontWeight: 600 }}>Token:</span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            {formatTokens(tokenData.value)}
          </span>
        </div>
      )}
      {queryData && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-dim)',
            marginTop: 4,
            display: 'flex',
            gap: 8,
            alignItems: 'center',
          }}
        >
          <span>查询:</span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            {queryData.value} 次
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * 格式化 X 轴日期标签
 */
function formatXAxisDate(dateStr: string, dataLength: number): string {
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();

  // 对于 30 天数据，只显示每 5 天的标签
  if (dataLength > 10) {
    const dayOfMonth = date.getDate();
    if (dayOfMonth % 5 !== 0 && dayOfMonth !== 1) {
      return '';
    }
  }

  return `${month}/${day}`;
}

/**
 * 格式化 Y 轴数值
 */
function formatYAxis(value: number): string {
  return formatTokens(value);
}

export function TokenChart({ data }: TokenChartProps) {
  if (!data || data.length === 0) {
    return (
      <div
        style={{
          height: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-dim)',
          fontSize: 13,
        }}
      >
        暂无趋势数据
      </div>
    );
  }

  // 计算最大值用于 Y 轴范围
  const maxTokens = Math.max(...data.map((d) => d.totalTokens), 0);
  const yMax = maxTokens > 0 ? Math.ceil(maxTokens * 1.1 / 1000) * 1000 : 1000;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart
        data={data}
        margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--border)"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tickFormatter={(value) => formatXAxisDate(value, data.length)}
          stroke="var(--text-dim)"
          tick={{ fontSize: 10, fill: 'var(--text-dim)' }}
          axisLine={{ stroke: 'var(--border)' }}
          tickLine={{ stroke: 'var(--border)' }}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[0, yMax]}
          tickFormatter={formatYAxis}
          stroke="var(--text-dim)"
          tick={{ fontSize: 10, fill: 'var(--text-dim)' }}
          axisLine={{ stroke: 'var(--border)' }}
          tickLine={{ stroke: 'var(--border)' }}
          width={45}
        />
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey="totalTokens"
          stroke="var(--accent)"
          strokeWidth={2}
          dot={{
            fill: 'var(--accent)',
            stroke: 'var(--bg-card)',
            strokeWidth: 2,
            r: 3,
          }}
          activeDot={{
            fill: 'var(--accent)',
            stroke: 'var(--bg-card)',
            strokeWidth: 2,
            r: 5,
          }}
          animationDuration={800}
          animationEasing="ease-out"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}