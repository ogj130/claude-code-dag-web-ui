/**
 * 热点工具排行组件
 * 展示 Top 10 最常用工具及其统计信息
 */

import { useState, useEffect, useCallback } from 'react';
import { getHotToolRanking, type HotToolEntry, type TimeRange } from '@/utils/executionStats';

interface ToolRankingProps {
  /** 时间范围 */
  timeRange?: TimeRange;
  /** 工作路径（用于按路径过滤） */
  workspacePath?: string;
  /** 面板样式 */
  style?: React.CSSProperties;
}

export function ToolRanking({ timeRange = 'all', workspacePath, style }: ToolRankingProps) {
  const [ranking, setRanking] = useState<HotToolEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 加载数据
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getHotToolRanking(10, timeRange, workspacePath);
      setRanking(data);
    } catch (err) {
      console.error('[ToolRanking] Failed to load data:', err);
      setError('加载数据失败');
    } finally {
      setLoading(false);
    }
  }, [timeRange, workspacePath]);

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

  if (ranking.length === 0) {
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
        热点工具排行
      </div>

      {/* 排行榜表格 */}
      <div style={{ padding: '8px 0' }}>
        {ranking.map((entry) => (
          <div
            key={entry.toolName}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '10px 16px',
              borderBottom: '1px solid var(--color-border-light)',
              transition: 'background-color 0.15s',
            }}
          >
            {/* 排名 */}
            <div style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 13,
              marginRight: 12,
              backgroundColor: getRankColor(entry.rank),
              color: '#fff',
            }}>
              {entry.rank}
            </div>

            {/* 工具名称 */}
            <div style={{
              flex: 1,
              fontWeight: 500,
              fontSize: 13,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginRight: 12,
            }}>
              {entry.toolName}
            </div>

            {/* 统计信息 */}
            <div style={{
              display: 'flex',
              gap: 16,
              fontSize: 12,
              color: 'var(--color-text-muted)',
            }}>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
              }}>
                <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                  {entry.count}
                </span>
                <span style={{ fontSize: 10 }}>调用次数</span>
              </div>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
              }}>
                <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                  {formatDuration(entry.avgTime)}
                </span>
                <span style={{ fontSize: 10 }}>平均耗时</span>
              </div>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
              }}>
                <span style={{
                  fontWeight: 600,
                  color: entry.errorRate > 5 ? 'var(--color-error)' : 'var(--color-text)',
                }}>
                  {entry.errorRate}%
                </span>
                <span style={{ fontSize: 10 }}>错误率</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 获取排名颜色
function getRankColor(rank: number): string {
  switch (rank) {
    case 1: return '#FFD700'; // 金
    case 2: return '#C0C0C0'; // 银
    case 3: return '#CD7F32'; // 铜
    default: return 'var(--color-primary)';
  }
}

// 格式化持续时间
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}min`;
}