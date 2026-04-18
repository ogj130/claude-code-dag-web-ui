/**
 * DimensionLeaderboard — 各维度 Top1 对比表
 */

import type { GlobalAgentResult, ExtendedAnalysisDimension } from '@/types/globalAgent';

interface DimensionLeaderboardProps {
  result: GlobalAgentResult;
}

const DIMENSION_LABELS: Record<ExtendedAnalysisDimension, string> = {
  codeQuality: '代码质量',
  correctness: '正确性',
  performance: '性能',
  consistency: '一致性',
  creativity: '创意',
  costEfficiency: '成本效率',
  speed: '速度',
  fileQuantity: '文件数量',
  fileDiversity: '文件多样性',
  codeDocRatio: '代码文档比',
  modificationDensity: '修改密度',
};

export function DimensionLeaderboard({ result }: DimensionLeaderboardProps) {
  const { rankings, scores } = result;

  // 如果没有 perWorkspaceScores 数据，不渲染
  const firstWithPerWs = scores.find(s => s.perWorkspaceScores && s.perWorkspaceScores.length > 0);
  if (!firstWithPerWs) return null;

  const wsOrder = rankings.map(r => r.workspaceId);
  const wsNames = new Map(rankings.map(r => [r.workspaceId, r.workspaceName]));

  return (
    <div style={{
      background: 'var(--bg-input)',
      borderRadius: 10,
      border: '1px solid var(--border)',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 16px',
        fontSize: 10,
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        borderBottom: '1px solid var(--border)',
      }}>
        各维度 Top1 对比
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                维度
              </th>
              {wsOrder.map(wsId => (
                <th key={wsId} style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                  {wsNames.get(wsId) ?? wsId}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scores.map(s => {
              const wsScoresMap = new Map((s.perWorkspaceScores ?? []).map(w => [w.workspaceId, w.score]));
              const maxScore = Math.max(...(s.perWorkspaceScores ?? []).map(w => w.score), 0);

              return (
                <tr key={s.dimension}>
                  <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                    {DIMENSION_LABELS[s.dimension] ?? s.dimension}
                  </td>
                  {wsOrder.map(wsId => {
                    const sc = wsScoresMap.get(wsId) ?? 0;
                    const isWinner = sc === maxScore && maxScore > 0;
                    return (
                      <td key={wsId} style={{
                        padding: '8px 12px',
                        textAlign: 'right',
                        borderBottom: '1px solid var(--border)',
                        fontFamily: "'JetBrains Mono', monospace",
                        color: isWinner ? 'var(--success)' : 'var(--text-secondary)',
                        fontWeight: isWinner ? 700 : 400,
                      }}>
                        {sc > 0 ? (
                          <span>{isWinner ? '🏆 ' : ''}{sc.toFixed(1)}</span>
                        ) : (
                          <span style={{ color: 'var(--text-dim)' }}>—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
