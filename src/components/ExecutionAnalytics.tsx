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
import { useSessionStore } from '@/stores/useSessionStore';

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

// ---------------------------------------------------------------------------
// 子组件
// ---------------------------------------------------------------------------

/** 骨架屏组件 */
function SummaryCardSkeleton() {
  return (
    <div
      style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: 8,
        padding: '10px 12px',
        border: '1px solid var(--border)',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          height: 22,
          background:
            'linear-gradient(90deg, var(--bg-input) 25%, var(--border) 50%, var(--bg-input) 75%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.5s infinite',
          borderRadius: 4,
          marginBottom: 4,
        }}
      />
      <div
        style={{
          height: 10,
          width: '60%',
          margin: '0 auto',
          background: 'var(--bg-input)',
          borderRadius: 4,
        }}
      />
    </div>
  );
}

/** 空状态组件 */
function EmptyState() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        color: 'var(--text-dim)',
        gap: 12,
      }}
    >
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect x="8" y="12" width="32" height="28" rx="3" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M8 20h32" stroke="currentColor" strokeWidth="2" />
        <path d="M16 8v8M32 8v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="24" cy="32" r="6" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M24 29v3l2 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <div style={{ fontSize: 13, fontWeight: 600 }}>暂无执行数据</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
        在此工作路径下发送消息后即可查看执行统计
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 主组件
// ---------------------------------------------------------------------------

export function ExecutionAnalytics({ isOpen = true, onClose }: ExecutionAnalyticsProps) {
  console.info('[ExecutionAnalytics] render, isOpen:', isOpen);
  const sessions = useSessionStore(s => s.sessions);
  const activeSessionId = useSessionStore(s => s.activeSessionId);
  const currentSession = sessions.find(s => s.id === activeSessionId);
  const workspacePath = currentSession?.projectPath;
  console.info('[ExecutionAnalytics] workspacePath:', workspacePath, 'activeSessionId:', activeSessionId);

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
    console.info('[ExecutionAnalytics] loadSummary called, workspacePath:', workspacePath, 'timeRange:', timeRange);
    try {
      const data = await getExecutionSummary(timeRange, workspacePath);
      console.info('[ExecutionAnalytics] getExecutionSummary result:', data);
      setSummary(data);
    } catch (err) {
      console.error('[ExecutionAnalytics] Failed to load summary:', err);
    } finally {
      setLoading(false);
    }
  }, [timeRange, workspacePath]);

  useEffect(() => {
    console.info('[ExecutionAnalytics] useEffect triggered, isOpen:', isOpen);
    if (isOpen) {
      setLoading(true);
      loadSummary();
    }
  }, [isOpen, timeRange, loadSummary]);

  // ESC 键关闭
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const hasData = !loading && summary && summary.totalCalls > 0;

  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95) translateY(-8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .analytics-overlay {
          animation: fadeIn 0.2s ease-out;
        }
        .analytics-modal {
          animation: scaleIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .summary-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .close-btn:hover {
          color: var(--text-primary) !important;
          background: var(--bg-input) !important;
        }
        .time-btn:hover:not(.active) {
          background: var(--bg-input) !important;
        }
      `}</style>

      {/* 背景遮罩层 */}
      <div
        className="analytics-overlay"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}
      >
        {/* 内容面板 */}
        <div
          className="analytics-modal"
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'var(--bg-root)',
            borderRadius: 14,
            border: '1px solid var(--border)',
            width: '90%',
            maxWidth: 940,
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}
        >
          {/* 标题栏 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px',
              borderBottom: '1px solid var(--border)',
              backgroundColor: 'var(--bg-card)',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                fontWeight: 600,
                fontSize: 15,
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="2" width="5" height="5" rx="1" fill="var(--accent)" />
                <rect x="9" y="2" width="5" height="5" rx="1" fill="var(--accent)" opacity="0.5" />
                <rect x="2" y="9" width="5" height="5" rx="1" fill="var(--accent)" opacity="0.5" />
                <rect x="9" y="9" width="5" height="5" rx="1" fill="var(--accent)" />
              </svg>
              执行分析
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* 时间范围选择器 */}
              <div
                style={{
                  display: 'flex',
                  backgroundColor: 'var(--bg-input)',
                  borderRadius: 6,
                  padding: 2,
                  gap: 2,
                }}
              >
                {TIME_RANGE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setTimeRange(option.value)}
                    className={`time-btn ${timeRange === option.value ? 'active' : ''}`}
                    style={{
                      padding: '4px 10px',
                      fontSize: 12,
                      border: 'none',
                      borderRadius: 4,
                      backgroundColor: timeRange === option.value ? 'var(--accent)' : 'transparent',
                      color: timeRange === option.value ? '#fff' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      fontWeight: timeRange === option.value ? 600 : 400,
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {onClose && (
                <button
                  onClick={onClose}
                  className="close-btn"
                  style={{
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
                  }}
                  title="关闭 (ESC)"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* 统计摘要 */}
          {loading ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(6, 1fr)',
                gap: 8,
                padding: 12,
                borderBottom: '1px solid var(--border)',
                flexShrink: 0,
              }}
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <SummaryCardSkeleton key={i} />
              ))}
            </div>
          ) : !hasData ? (
            <div style={{ borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <EmptyState />
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(6, 1fr)',
                gap: 8,
                padding: 12,
                borderBottom: '1px solid var(--border)',
                flexShrink: 0,
              }}
            >
              <div
                className="summary-card"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  border: '1px solid var(--border)',
                  textAlign: 'center',
                  transition: 'all 0.2s',
                  cursor: 'default',
                }}
              >
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    marginBottom: 2,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {summary?.totalCalls ?? 0}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>总调用次数</div>
              </div>
              <div
                className="summary-card"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  border: '1px solid var(--border)',
                  textAlign: 'center',
                  transition: 'all 0.2s',
                  cursor: 'default',
                }}
              >
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: '#4ade80',
                    marginBottom: 2,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {summary?.successCalls ?? 0}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>成功调用</div>
              </div>
              <div
                className="summary-card"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  border: '1px solid var(--border)',
                  textAlign: 'center',
                  transition: 'all 0.2s',
                  cursor: 'default',
                }}
              >
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: '#f87171',
                    marginBottom: 2,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {summary?.errorCalls ?? 0}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>失败调用</div>
              </div>
              <div
                className="summary-card"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  border: '1px solid var(--border)',
                  textAlign: 'center',
                  transition: 'all 0.2s',
                  cursor: 'default',
                }}
              >
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: 'var(--accent)',
                    marginBottom: 2,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {summary?.errorRate ?? 0}%
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>错误率</div>
              </div>
              <div
                className="summary-card"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  border: '1px solid var(--border)',
                  textAlign: 'center',
                  transition: 'all 0.2s',
                  cursor: 'default',
                }}
              >
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    marginBottom: 2,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {formatDuration(summary?.avgDuration ?? 0)}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>平均耗时</div>
              </div>
              <div
                className="summary-card"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  border: '1px solid var(--border)',
                  textAlign: 'center',
                  transition: 'all 0.2s',
                  cursor: 'default',
                }}
              >
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    marginBottom: 2,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {summary?.uniqueTools ?? 0}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>工具种类</div>
              </div>
            </div>
          )}

          {/* 图表区域 */}
          {hasData && (
            <>
              <div
                style={{
                  display: 'flex',
                  flex: 1,
                  minHeight: 0,
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <div
                  style={{ flex: 1, minWidth: 0, borderRight: '1px solid var(--border)', overflow: 'auto' }}
                >
                  <ToolDistribution timeRange={timeRange} workspacePath={workspacePath} style={{ height: '100%' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
                  <ToolRanking timeRange={timeRange} workspacePath={workspacePath} style={{ height: '100%' }} />
                </div>
              </div>

              {/* 底部：错误率趋势 */}
              <div style={{ height: 280, overflow: 'auto', flexShrink: 0 }}>
                <ErrorRateTrendChart timeRange={timeRange} workspacePath={workspacePath} />
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// 格式化持续时间
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}min`;
}
