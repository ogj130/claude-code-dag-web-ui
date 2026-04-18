import type {
  WorkspaceScoreResult,
  ComparisonResult,
  DimensionRanking,
  DimensionRankingItem,
  DimensionScore,
  ExtendedAnalysisDimension,
} from '@/types/globalAgent';
import { zScoreNormalize } from './workspaceScoringEngine';

export function buildComparison(results: WorkspaceScoreResult[]): ComparisonResult {
  if (results.length === 0) {
    return {
      dimensionRankings: [],
      compositeRanking: [],
      heatmapData: {},
      radarData: {},
      generatedAt: Date.now(),
    };
  }

  const allDimensions = new Set<string>();
  for (const r of results) {
    for (const s of r.scores) {
      allDimensions.add(s.dimension);
    }
  }

  const dimScores: Record<string, Record<string, number>> = {};
  for (const dim of allDimensions) {
    dimScores[dim] = {};
    for (const r of results) {
      const score = r.scores.find(s => s.dimension === dim)?.score ?? 0;
      dimScores[dim][r.workspaceId] = score;
    }
  }

  const normalizedScores: Record<string, Record<string, number>> = {};
  for (const dim of allDimensions) {
    const wsIds = results.map(r => r.workspaceId);
    const rawValues = wsIds.map(id => dimScores[dim][id]);
    const normalized = zScoreNormalize(rawValues);
    wsIds.forEach((id, i) => {
      if (!normalizedScores[id]) normalizedScores[id] = {};
      normalizedScores[id][dim] = normalized[i];
    });
  }

  const dimensionRankings: DimensionRanking[] = [];
  for (const dim of allDimensions) {
    // 排序使用标准化分数，决定 rank；展示使用原始分数
    const entries = results
      .map(r => {
        const normalized = normalizedScores[r.workspaceId]?.[dim] ?? 0;
        const raw = dimScores[dim][r.workspaceId] ?? 0;
        return {
          workspaceId: r.workspaceId,
          workspaceName: r.workspaceName,
          score: raw,        // 展示用原始分数
          normalizedScore: normalized, // 排序用标准化分数
        };
      })
      .sort((a, b) => b.normalizedScore - a.normalizedScore);

    const rankings: DimensionRankingItem[] = entries.map((e, i) => ({
      workspaceId: e.workspaceId,
      workspaceName: e.workspaceName,
      score: e.score,
      rank: i + 1,
    }));

    dimensionRankings.push({
      dimension: dim as any,
      rankings,
      topWinner: rankings[0]?.workspaceId ?? '',
    });
  }

  const weightedScores = results.map(r => {
    const total = r.scores.reduce((sum, s) => {
      const dim = s.dimension;
      const normalized = normalizedScores[r.workspaceId]?.[dim] ?? s.score;
      return sum + normalized * (dim.includes('file') ? 0.05 : 0.1);
    }, 0);
    return { workspaceId: r.workspaceId, workspaceName: r.workspaceName, totalScore: total };
  });

  const compositeRanking = weightedScores
    .sort((a, b) => b.totalScore - a.totalScore)
    .map((e, i) => ({ ...e, rank: i + 1, strengths: [], weaknesses: [] }));

  const heatmapData: Record<string, Record<string, number>> = {};
  const radarData: Record<string, DimensionScore[]> = {};

  for (const r of results) {
    heatmapData[r.workspaceId] = {};
    radarData[r.workspaceId] = [];
    for (const dim of allDimensions) {
      const rawScore = dimScores[dim][r.workspaceId] ?? 0;
      heatmapData[r.workspaceId][dim] = rawScore;
      radarData[r.workspaceId].push({ dimension: dim as ExtendedAnalysisDimension, score: rawScore, comment: '' });
    }
  }

  return {
    dimensionRankings,
    compositeRanking,
    heatmapData,
    radarData,
    generatedAt: Date.now(),
  };
}
