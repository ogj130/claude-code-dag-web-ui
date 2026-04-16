import { describe, it, expect } from 'vitest';
import { buildComparison } from '@/services/workspaceComparisonEngine';
import type { WorkspaceScoreResult } from '@/types/globalAgent';

function makeResult(wsId: string, wsName: string, scores: Record<string, number>): WorkspaceScoreResult {
  return {
    workspaceId: wsId, workspaceName: wsName,
    scores: Object.entries(scores).map(([dim, score]) => ({
      dimension: dim as any, score, comment: '',
    })),
    compositeScore: Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length,
  };
}

describe('WorkspaceComparisonEngine', () => {
  it('T3-1: dimensionRankings 按 score 降序，rank 字段为 1/2/3', () => {
    const results = [
      makeResult('ws1', 'A', { fileQuantity: 5 }),
      makeResult('ws2', 'B', { fileQuantity: 9 }),
      makeResult('ws3', 'C', { fileQuantity: 7 }),
    ];
    const comparison = buildComparison(results);
    expect(comparison.dimensionRankings).toHaveLength(1);
    const ranking = comparison.dimensionRankings[0];
    expect(ranking.rankings[0].rank).toBe(1);
    expect(ranking.rankings[0].score).toBe(9);
    expect(ranking.rankings[1].rank).toBe(2);
    expect(ranking.rankings[2].rank).toBe(3);
  });

  it('T3-2: topWinner 是各维度分数最高的工作区 ID', () => {
    const results = [
      makeResult('ws1', 'A', { fileQuantity: 5 }),
      makeResult('ws2', 'B', { fileQuantity: 9 }),
    ];
    const comparison = buildComparison(results);
    expect(comparison.dimensionRankings[0].topWinner).toBe('ws2');
  });

  it('T3-3: heatmapData[wsId][dimension] = score', () => {
    const results = [
      makeResult('ws1', 'A', { fileQuantity: 8, codeDocRatio: 6 }),
      makeResult('ws2', 'B', { fileQuantity: 5, codeDocRatio: 9 }),
    ];
    const comparison = buildComparison(results);
    expect(comparison.heatmapData['ws1']['fileQuantity']).toBe(8);
    expect(comparison.heatmapData['ws1']['codeDocRatio']).toBe(6);
    expect(comparison.heatmapData['ws2']['fileQuantity']).toBe(5);
    expect(comparison.heatmapData['ws2']['codeDocRatio']).toBe(9);
  });

  it('T3-4: radarData[wsId] = [{dimension, score}...]', () => {
    const results = [makeResult('ws1', 'A', { fileQuantity: 8, codeDocRatio: 6 })];
    const comparison = buildComparison(results);
    expect(Array.isArray(comparison.radarData['ws1'])).toBe(true);
    expect(comparison.radarData['ws1'].length).toBeGreaterThan(0);
    expect(comparison.radarData['ws1'][0]).toHaveProperty('dimension');
    expect(comparison.radarData['ws1'][0]).toHaveProperty('score');
  });

  it('T3-5: compositeRanking 按 compositeScore 降序', () => {
    const results = [
      makeResult('ws1', 'A', { fileQuantity: 3 }),
      makeResult('ws2', 'B', { fileQuantity: 9 }),
      makeResult('ws3', 'C', { fileQuantity: 7 }),
    ];
    const comparison = buildComparison(results);
    expect(comparison.compositeRanking[0].workspaceId).toBe('ws2');
    expect(comparison.compositeRanking[0].rank).toBe(1);
    expect(comparison.compositeRanking[2].rank).toBe(3);
  });

  it('T3-6: 空 results 返回空 rankings 和空 heatmapData，不抛错', () => {
    const comparison = buildComparison([]);
    expect(comparison.dimensionRankings).toHaveLength(0);
    expect(Object.keys(comparison.heatmapData)).toHaveLength(0);
    expect(comparison.compositeRanking).toHaveLength(0);
    expect(comparison.generatedAt).toBeGreaterThan(0);
  });

  it('T3-7: comparison 包含所有必需字段', () => {
    const results = [makeResult('ws1', 'A', { fileQuantity: 5 })];
    const comparison = buildComparison(results);
    expect(comparison).toHaveProperty('dimensionRankings');
    expect(comparison).toHaveProperty('compositeRanking');
    expect(comparison).toHaveProperty('heatmapData');
    expect(comparison).toHaveProperty('radarData');
    expect(comparison).toHaveProperty('generatedAt');
  });
});
