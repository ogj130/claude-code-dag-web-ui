/**
 * RankingCard — 排名卡片组件
 */

import type { WorkspaceRanking } from '@/types/globalAgent';

interface RankingCardProps {
  ranking: WorkspaceRanking;
}

const RANK_COLORS = ['#fbbf24', '#94a3b8', '#cd7c4a'];
const RANK_EMOJI = ['🥇', '🥈', '🥉'];

export function RankingCard({ ranking }: RankingCardProps) {
  const isTop3 = ranking.rank <= 3;
  const rankColor = RANK_COLORS[ranking.rank - 1] ?? 'var(--text-muted)';
  const rankEmoji = RANK_EMOJI[ranking.rank - 1] ?? `#${ranking.rank}`;

  return (
    <div
      style={{
        flex: '0 0 auto',
        minWidth: 160,
        background: 'var(--bg-input)',
        border: `1px solid ${isTop3 ? rankColor + '40' : 'var(--border)'}`,
        borderRadius: 10,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {/* 排名标题 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 16 }}>{rankEmoji}</span>
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            color: rankColor,
            background: rankColor + '15',
            padding: '1px 6px',
            borderRadius: 20,
            letterSpacing: '0.05em',
          }}>
            第{ranking.rank}名
          </span>
        </div>
        <div style={{
          fontSize: 18,
          fontWeight: 700,
          color: rankColor,
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {ranking.totalScore.toFixed(1)}
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>/10</span>
        </div>
      </div>

      {/* 工作区名称 */}
      <div style={{
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--text-primary)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {ranking.workspaceName}
      </div>

      {/* 优点/缺点列表 */}
      {ranking.strengths.length > 0 && (
        <div style={{ fontSize: 10, color: 'var(--success)', lineHeight: 1.5 }}>
          <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>优点</div>
          {ranking.strengths.slice(0, 2).map((s, i) => (
            <div key={i}>+ {s}</div>
          ))}
        </div>
      )}
      {ranking.weaknesses.length > 0 && (
        <div style={{ fontSize: 10, color: 'var(--error)', lineHeight: 1.5 }}>
          <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>待改进</div>
          {ranking.weaknesses.slice(0, 2).map((w, i) => (
            <div key={i}>- {w}</div>
          ))}
        </div>
      )}
    </div>
  );
}
