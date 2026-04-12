/**
 * Token 统计面板
 * 显示 Token 消耗统计和趋势图表
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getOverallStats,
  getRecentStats,
  getTokenTrend,
  formatTokens,
  type TokenTrendData,
} from '@/utils/tokenStats';
import { TokenChart } from './TokenChart';
import { TokenPricing } from './TokenPricing';
import { useSessionStore } from '@/stores/useSessionStore';

interface TokenAnalyticsProps {
  isOpen: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// 子组件
// ---------------------------------------------------------------------------

/** 骨架屏组件 */
function StatCardSkeleton() {
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-card)',
        borderRadius: 10,
        padding: '14px 16px',
        flex: 1,
        minWidth: 120,
      }}
    >
      <div
        style={{
          height: 10,
          width: '50%',
          background:
            'linear-gradient(90deg, var(--bg-input) 25%, var(--border) 50%, var(--bg-input) 75%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.5s infinite',
          borderRadius: 4,
          marginBottom: 8,
        }}
      />
      <div
        style={{
          height: 24,
          width: '70%',
          background:
            'linear-gradient(90deg, var(--bg-input) 25%, var(--border) 50%, var(--bg-input) 75%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.5s infinite',
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
        <rect x="6" y="10" width="36" height="28" rx="3" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M6 18h36" stroke="currentColor" strokeWidth="2" />
        <path d="M14 6v8M34 6v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M18 28l4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ fontSize: 13, fontWeight: 600 }}>暂无 Token 消耗数据</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
        在此工作路径下发送消息后即可查看 Token 消耗统计
      </div>
    </div>
  );
}

/**
 * 统计数据卡片组件
 */
function StatCard({
  label,
  value,
  subValue,
}: {
  label: string;
  value: string;
  subValue?: string;
}) {
  return (
    <div
      className="stat-card"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-card)',
        borderRadius: 10,
        padding: '14px 16px',
        flex: 1,
        minWidth: 120,
        transition: 'all 0.2s',
        cursor: 'default',
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: 'var(--text-dim)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: 'var(--text-primary)',
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        {value}
      </div>
      {subValue && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            marginTop: 4,
          }}
        >
          {subValue}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 主组件
// ---------------------------------------------------------------------------

export function TokenAnalytics({ isOpen, onClose }: TokenAnalyticsProps) {
  const sessions = useSessionStore(s => s.sessions);
  const activeSessionId = useSessionStore(s => s.activeSessionId);
  const currentSession = sessions.find(s => s.id === activeSessionId);
  const workspacePath = currentSession?.projectPath;

  const [overallStats, setOverallStats] = useState<{
    totalTokens: number;
    totalQueries: number;
    avgTokensPerQuery: number;
  } | null>(null);

  const [recentStats, setRecentStats] = useState<{
    totalTokens: number;
    totalQueries: number;
    avgTokensPerQuery: number;
    dailyAvg: number;
  } | null>(null);

  const [trendData, setTrendData] = useState<TokenTrendData[]>([]);
  const [trendDays, setTrendDays] = useState<7 | 30>(7);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'trend' | 'pricing'>('trend');

  const hasData = !loading && overallStats && overallStats.totalTokens > 0;

  // 加载统计数据
  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const [overall, recent, trend] = await Promise.all([
        getOverallStats(workspacePath),
        getRecentStats(trendDays, workspacePath),
        getTokenTrend(trendDays, workspacePath),
      ]);
      setOverallStats(overall);
      setRecentStats(recent);
      setTrendData(trend);
    } catch (error) {
      console.error('[TokenAnalytics] Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  }, [trendDays, workspacePath]);

  useEffect(() => {
    if (isOpen) {
      loadStats();
    }
  }, [isOpen, trendDays, loadStats]);

  // ESC 键关闭
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // 如果未打开，不渲染
  if (!isOpen) {
    return null;
  }

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
        .token-overlay {
          animation: fadeIn 0.2s ease-out;
        }
        .token-modal {
          animation: scaleIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .token-close-btn:hover {
          color: var(--text-primary) !important;
          background: var(--bg-input) !important;
        }
        .tab-btn:hover:not(.active) {
          opacity: 0.8;
        }
        .trend-btn:hover:not(.active) {
          background: var(--bg-input) !important;
        }
        .refresh-btn:hover {
          color: var(--text-primary) !important;
          background: var(--bg-input) !important;
        }
      `}</style>

      {/* 背景遮罩 */}
      <div
        className="token-overlay"
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
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
          className="token-modal"
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'var(--bg-root)',
            borderRadius: 14,
            border: '1px solid var(--border)',
            width: '90%',
            maxWidth: 800,
            maxHeight: '75vh',
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
              background: 'var(--bg-card)',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12M2 8h8M2 12h10" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="13" cy="10" r="3" fill="var(--accent)" opacity="0.5" />
              </svg>
              Token 统计
            </span>
            <button
              onClick={onClose}
              className="token-close-btn"
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
          </div>

          <div
            style={{
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              maxHeight: 'calc(80vh - 56px)',
              overflow: 'auto',
            }}
          >
            {/* Tab 切换 */}
            <div
              style={{
                display: 'flex',
                gap: 8,
                borderBottom: '1px solid var(--border)',
                paddingBottom: 8,
              }}
            >
              <button
                onClick={() => setActiveTab('trend')}
                className={`tab-btn ${activeTab === 'trend' ? 'active' : ''}`}
                style={{
                  background: activeTab === 'trend' ? 'var(--accent)' : 'transparent',
                  color: activeTab === 'trend' ? '#fff' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: 6,
                  padding: '6px 14px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                Token 趋势
              </button>
              <button
                onClick={() => setActiveTab('pricing')}
                className={`tab-btn ${activeTab === 'pricing' ? 'active' : ''}`}
                style={{
                  background: activeTab === 'pricing' ? 'var(--accent)' : 'transparent',
                  color: activeTab === 'pricing' ? '#fff' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: 6,
                  padding: '6px 14px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                模型定价
              </button>
            </div>

            {activeTab === 'trend' ? (
              <>
                {/* 骨架屏状态 */}
                {loading && !overallStats ? (
                  <>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <StatCardSkeleton />
                      <StatCardSkeleton />
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <StatCardSkeleton />
                      <StatCardSkeleton />
                    </div>
                  </>
                ) : !hasData ? (
                  <EmptyState />
                ) : (
                  <>
                    {/* 总体统计卡片 */}
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <StatCard
                        label="总消耗"
                        value={formatTokens(overallStats?.totalTokens ?? 0)}
                        subValue={`${overallStats?.totalQueries ?? 0} 次查询`}
                      />
                      <StatCard
                        label="平均/次"
                        value={formatTokens(overallStats?.avgTokensPerQuery ?? 0)}
                      />
                    </div>

                    {/* 近期统计 */}
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <StatCard
                        label={`近${trendDays}天消耗`}
                        value={formatTokens(recentStats?.totalTokens ?? 0)}
                        subValue={`${recentStats?.totalQueries ?? 0} 次查询`}
                      />
                      <StatCard
                        label="日均"
                        value={formatTokens(recentStats?.dailyAvg ?? 0)}
                        subValue="Token/天"
                      />
                    </div>

                    {/* 趋势图表 */}
                    <div
                      style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-card)',
                        borderRadius: 10,
                        padding: 16,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: 12,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: 'var(--text-secondary)',
                          }}
                        >
                          Token 使用趋势
                        </span>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <button
                            onClick={() => setTrendDays(7)}
                            className={`trend-btn ${trendDays === 7 ? 'active' : ''}`}
                            style={{
                              background: trendDays === 7 ? 'var(--accent-dim)' : 'transparent',
                              color: trendDays === 7 ? 'var(--accent)' : 'var(--text-dim)',
                              border: `1px solid ${trendDays === 7 ? 'var(--accent)' : 'var(--border)'}`,
                              borderRadius: 4,
                              padding: '3px 8px',
                              fontSize: 10,
                              fontWeight: 600,
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                            }}
                          >
                            7天
                          </button>
                          <button
                            onClick={() => setTrendDays(30)}
                            className={`trend-btn ${trendDays === 30 ? 'active' : ''}`}
                            style={{
                              background: trendDays === 30 ? 'var(--accent-dim)' : 'transparent',
                              color: trendDays === 30 ? 'var(--accent)' : 'var(--text-dim)',
                              border: `1px solid ${trendDays === 30 ? 'var(--accent)' : 'var(--border)'}`,
                              borderRadius: 4,
                              padding: '3px 8px',
                              fontSize: 10,
                              fontWeight: 600,
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                            }}
                          >
                            30天
                          </button>
                          <button
                            onClick={loadStats}
                            className="refresh-btn"
                            style={{
                              background: 'transparent',
                              color: 'var(--text-dim)',
                              border: 'none',
                              borderRadius: 4,
                              padding: '3px 8px',
                              fontSize: 10,
                              cursor: 'pointer',
                              marginLeft: 4,
                              transition: 'all 0.15s',
                            }}
                            title="刷新"
                          >
                            ↻
                          </button>
                        </div>
                      </div>
                      <TokenChart data={trendData} />
                    </div>
                  </>
                )}
              </>
            ) : (
              <TokenPricing />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
