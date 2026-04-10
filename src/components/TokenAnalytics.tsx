/**
 * Token 统计面板
 * 显示 Token 消耗统计和趋势图表
 */

import { useState, useEffect } from 'react';
import {
  getOverallStats,
  getRecentStats,
  getTokenTrend,
  formatTokens,
  type TokenTrendData,
} from '@/utils/tokenStats';
import { TokenChart } from './TokenChart';
import { TokenPricing } from './TokenPricing';

interface TokenAnalyticsProps {
  isOpen: boolean;
  onClose: () => void;
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

export function TokenAnalytics({ isOpen, onClose }: TokenAnalyticsProps) {
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

  // 加载统计数据
  useEffect(() => {
    async function loadStats() {
      setLoading(true);
      try {
        const [overall, recent, trend] = await Promise.all([
          getOverallStats(),
          getRecentStats(trendDays),
          getTokenTrend(trendDays),
        ]);
        setOverallStats(overall);
        setRecentStats(recent);
        setTrendData(trend);
      } catch (error) {
        console.error('[TokenAnalytics] Failed to load stats:', error);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, [trendDays]);

  // 刷新按钮点击处理
  const handleRefresh = async () => {
    setLoading(true);
    try {
      const [overall, recent, trend] = await Promise.all([
        getOverallStats(),
        getRecentStats(trendDays),
        getTokenTrend(trendDays),
      ]);
      setOverallStats(overall);
      setRecentStats(recent);
      setTrendData(trend);
    } catch (error) {
      console.error('[TokenAnalytics] Failed to refresh stats:', error);
    } finally {
      setLoading(false);
    }
  };

  // 如果未打开，不渲染
  if (!isOpen) {
    return null;
  }

  if (loading && !overallStats) {
    return (
      <div
        style={{
          padding: 24,
          textAlign: 'center',
          color: 'var(--text-dim)',
        }}
      >
        加载中...
      </div>
    );
  }

  return (
    // 背景遮罩
    <div
      onClick={onClose}
      style={{
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
      }}
    >
      {/* 内容面板 */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-root)',
          borderRadius: 12,
          border: '1px solid var(--border)',
          width: '90%',
          maxWidth: 800,
          maxHeight: '75vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
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
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            Token 统计
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-dim)',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 4,
              fontSize: 16,
            }}
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
          {/* 总体统计卡片 */}
          <div
            style={{
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
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
          <div
            style={{
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
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
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => setTrendDays(7)}
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
                  onClick={handleRefresh}
                  style={{
                    background: 'transparent',
                    color: 'var(--text-dim)',
                    border: 'none',
                    borderRadius: 4,
                    padding: '3px 8px',
                    fontSize: 10,
                    cursor: 'pointer',
                    marginLeft: 4,
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
      ) : (
        <TokenPricing />
      )}
        </div>
      </div>
    </div>
  );
}
