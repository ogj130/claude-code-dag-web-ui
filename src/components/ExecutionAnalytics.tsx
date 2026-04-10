/**
 * 执行分析面板组件
 * 展示工具调用统计、分布图表、错误率趋势等
 * 使用居中模态框设计，不会覆盖终端内容
 */

import { useState, useEffect, useCallback } from 'react';
import { ToolDistribution } from './ToolDistribution';
import { ToolRanking } from './ToolRanking';
import { ErrorRateTrendChart } from './ErrorRateTrendChart';
import {
  getExecutionSummary,
  type TimeRange,
} from '@/utils/executionStats';

// 时间范围选项
const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: 7, label: '7 天' },
  { value: 30, label: '30 天' },
  { value: 'all', label: '全部' },
];

interface ExecutionAnalyticsProps {
  /** 是否展开面板 */
  isOpen?: boolean;
  /** 关闭回调 */
  onClose?: () => void;
}

export function ExecutionAnalytics({ isOpen = true, onClose }: ExecutionAnalyticsProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>(7);
  const [summary, setSummary] = useState<{
    totalCalls: number;
    successCalls: number;
    errorCalls: number;
    errorRate: number;
    avgDuration: number;
    uniqueTools: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  // 加载摘要数据
  const loadSummary = useCallback(async () => {
    try {
      const data = await getExecutionSummary(timeRange);
      setSummary(data);
    } catch (err) {
      console.error('[ExecutionAnalytics] Failed to load summary:', err);
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      loadSummary();
    }
  }, [isOpen, timeRange, loadSummary]);

  if (!isOpen) return null;

  return (
    // 背景遮罩层
    <div style={overlayStyle} onClick={onClose}>
      {/* 内容面板 */}
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        {/* 标题栏 */}
        <div style={headerStyle}>
          <div style={titleStyle}>执行分析</div>
          <div style={headerRightStyle}>
            {/* 时间范围选择器 */}
            <div style={timeRangeContainerStyle}>
              {TIME_RANGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTimeRange(option.value)}
                  style={{
                    ...timeRangeButtonStyle,
                    ...(timeRange === option.value
                      ? timeRangeButtonActiveStyle
                      : {}),
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {/* 关闭按钮 */}
            {onClose && (
              <button onClick={onClose} style={closeButtonStyle}>
                ✕
              </button>
            )}
          </div>
        </div>

        {/* 统计摘要 */}
        <div style={summaryContainerStyle}>
          <div style={summaryCardStyle}>
            <div style={summaryValueStyle}>{loading ? '-' : summary?.totalCalls ?? 0}</div>
            <div style={summaryLabelStyle}>总调用次数</div>
          </div>
          <div style={summaryCardStyle}>
            <div style={{ ...summaryValueStyle, color: 'var(--color-success)' }}>
              {loading ? '-' : summary?.successCalls ?? 0}
            </div>
            <div style={summaryLabelStyle}>成功调用</div>
          </div>
          <div style={summaryCardStyle}>
            <div style={{ ...summaryValueStyle, color: 'var(--color-error)' }}>
              {loading ? '-' : summary?.errorCalls ?? 0}
            </div>
            <div style={summaryLabelStyle}>失败调用</div>
          </div>
          <div style={summaryCardStyle}>
            <div style={{ ...summaryValueStyle, color: 'var(--accent)' }}>
              {loading ? '-' : `${summary?.errorRate ?? 0}%`}
            </div>
            <div style={summaryLabelStyle}>错误率</div>
          </div>
          <div style={summaryCardStyle}>
            <div style={summaryValueStyle}>
              {loading ? '-' : formatDuration(summary?.avgDuration ?? 0)}
            </div>
            <div style={summaryLabelStyle}>平均耗时</div>
          </div>
          <div style={summaryCardStyle}>
            <div style={summaryValueStyle}>{loading ? '-' : summary?.uniqueTools ?? 0}</div>
            <div style={summaryLabelStyle}>工具种类</div>
          </div>
        </div>

        {/* 图表区域 */}
        <div style={chartsContainerStyle}>
          {/* 工具分布 */}
          <div style={chartPanelStyle}>
            <ToolDistribution timeRange={timeRange} style={{ height: '100%' }} />
          </div>

          {/* 工具排行 */}
          <div style={chartPanelStyle}>
            <ToolRanking timeRange={timeRange} style={{ height: '100%' }} />
          </div>
        </div>

        {/* 底部：错误率趋势 */}
        <div style={bottomChartStyle}>
          <ErrorRateTrendChart timeRange={timeRange} />
        </div>
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

// 模态框样式
const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const modalStyle: React.CSSProperties = {
  background: 'var(--bg-root)',
  borderRadius: 12,
  border: '1px solid var(--border)',
  width: '90%',
  maxWidth: 900,
  maxHeight: '85vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '14px 16px',
  borderBottom: '1px solid var(--border)',
  backgroundColor: 'var(--bg-card)',
  flexShrink: 0,
};

const titleStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: 15,
  color: 'var(--text-primary)',
};

const headerRightStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
};

const timeRangeContainerStyle: React.CSSProperties = {
  display: 'flex',
  backgroundColor: 'var(--bg-input)',
  borderRadius: 6,
  padding: 2,
  gap: 2,
};

const timeRangeButtonStyle: React.CSSProperties = {
  padding: '4px 10px',
  fontSize: 12,
  border: 'none',
  borderRadius: 4,
  backgroundColor: 'transparent',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  transition: 'all 0.15s',
};

const timeRangeButtonActiveStyle: React.CSSProperties = {
  backgroundColor: 'var(--accent)',
  color: '#fff',
};

const closeButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--text-dim)',
  cursor: 'pointer',
  padding: 4,
  borderRadius: 4,
  fontSize: 16,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.15s',
};

const summaryContainerStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(6, 1fr)',
  gap: 8,
  padding: 12,
  borderBottom: '1px solid var(--border)',
  flexShrink: 0,
};

const summaryCardStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-card)',
  borderRadius: 8,
  padding: '10px 12px',
  border: '1px solid var(--border)',
  textAlign: 'center',
};

const summaryValueStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: 'var(--text-primary)',
  marginBottom: 2,
  fontFamily: "'JetBrains Mono', monospace",
};

const summaryLabelStyle: React.CSSProperties = {
  fontSize: 10,
  color: 'var(--text-muted)',
};

const chartsContainerStyle: React.CSSProperties = {
  display: 'flex',
  flex: 1,
  minHeight: 0,
  borderBottom: '1px solid var(--border)',
};

const chartPanelStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  borderRight: '1px solid var(--border)',
  overflow: 'auto',
};

const bottomChartStyle: React.CSSProperties = {
  height: 280,
  overflow: 'auto',
  flexShrink: 0,
};