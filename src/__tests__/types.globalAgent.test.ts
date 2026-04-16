import { describe, it, expect } from 'vitest';
import type {
  FileStats,
  FileEntry,
  WorkspaceFileData,
  WorkspaceScoreResult,
  DimensionRanking,
  ComparisonResult,
  ExtendedAnalysisDimension,
  GlobalAgentResult,
} from '@/types/globalAgent';

describe('globalAgent 类型扩展', () => {
  it('FileStats 包含所有必需字段', () => {
    const stats: FileStats = {
      totalCreatedFiles: 10,
      totalModifiedFiles: 5,
      codeFiles: 8,
      docFiles: 5,
      configFiles: 2,
      totalLines: 500,
      modifiedLines: 120,
      avgFileSize: 2048,
    };
    expect(stats.totalCreatedFiles).toBe(10);
  });

  it('WorkspaceFileData 结构正确', () => {
    const data: WorkspaceFileData = {
      workspaceId: 'ws1',
      workspaceName: '前端项目',
      createdFiles: [{ path: '/src/a.ts', name: 'a.ts', extension: '.ts', lines: 50 }],
      modifiedFiles: [{ path: '/src/b.ts', name: 'b.ts', extension: '.ts', lines: 30 }],
      summary: '本次任务完成了 5 个需求',
      stats: {
        totalCreatedFiles: 1, totalModifiedFiles: 1, codeFiles: 2,
        docFiles: 0, configFiles: 0, totalLines: 80, modifiedLines: 30, avgFileSize: 500,
      },
    };
    expect(data.workspaceId).toBe('ws1');
    expect(data.createdFiles).toHaveLength(1);
    expect(data.modifiedFiles).toHaveLength(1);
  });

  it('WorkspaceScoreResult 包含 compositeScore', () => {
    const result: WorkspaceScoreResult = {
      workspaceId: 'ws1',
      workspaceName: '前端项目',
      scores: [],
      compositeScore: 8.5,
    };
    expect(typeof result.compositeScore).toBe('number');
  });

  it('DimensionRanking 的 topWinner 是 workspaceId', () => {
    const ranking: DimensionRanking = {
      dimension: 'fileQuantity',
      rankings: [
        { workspaceId: 'ws1', workspaceName: 'A', score: 9, rank: 1 },
        { workspaceId: 'ws2', workspaceName: 'B', score: 7, rank: 2 },
      ],
      topWinner: 'ws1',
    };
    expect(ranking.topWinner).toBe(ranking.rankings[0].workspaceId);
  });

  it('ComparisonResult 的 heatmapData 结构正确', () => {
    const data: ComparisonResult = {
      dimensionRankings: [],
      compositeRanking: [],
      heatmapData: {
        ws1: { fileQuantity: 9, codeDocRatio: 8 },
        ws2: { fileQuantity: 7, codeDocRatio: 6 },
      },
      radarData: {},
      generatedAt: Date.now(),
    };
    expect(data.heatmapData.ws1.fileQuantity).toBe(9);
    expect(data.heatmapData.ws2.codeDocRatio).toBe(6);
  });

  it('ExtendedAnalysisDimension 包含新增的 4 个文件维度', () => {
    const dimensions: ExtendedAnalysisDimension[] = [
      'codeQuality', 'fileQuantity', 'fileDiversity', 'codeDocRatio', 'modificationDensity',
    ];
    expect(dimensions).toContain('fileQuantity');
    expect(dimensions).toContain('fileDiversity');
    expect(dimensions).toContain('codeDocRatio');
    expect(dimensions).toContain('modificationDensity');
  });

  it('DimensionRanking 的 topWinner 可选', () => {
    const ranking: DimensionRanking = {
      dimension: 'fileQuantity',
      rankings: [],
      // topWinner 省略时应合法
    };
    expect(ranking.topWinner).toBeUndefined();
  });

  it('GlobalAgentResult 完整组合结构（包含 comparison）', () => {
    const result: GlobalAgentResult = {
      id: 'gar_test',
      batchId: 'batch_123',
      modelUsed: 'claude',
      rankings: [
        { workspaceId: 'ws1', workspaceName: '前端', totalScore: 8.5, rank: 1, strengths: ['代码清晰'], weaknesses: ['速度慢'] },
      ],
      scores: [
        { dimension: 'fileQuantity', score: 9, comment: '很好' },
        { dimension: 'codeDocRatio', score: 7, comment: '不错' },
      ],
      commentary: '整体表现良好',
      roast: '还行',
      recommendations: ['继续优化'],
      createdAt: Date.now(),
      comparison: {
        dimensionRankings: [{
          dimension: 'fileQuantity',
          rankings: [{ workspaceId: 'ws1', workspaceName: '前端', score: 9, rank: 1 }],
          topWinner: 'ws1',
        }],
        compositeRanking: [{ workspaceId: 'ws1', workspaceName: '前端', totalScore: 8.5, rank: 1, strengths: [], weaknesses: [] }],
        heatmapData: { ws1: { fileQuantity: 9, codeDocRatio: 7 } },
        radarData: { ws1: [{ dimension: 'fileQuantity', score: 9, comment: '' }] },
        generatedAt: Date.now(),
      },
    };
    expect(result.id).toBe('gar_test');
    expect(result.comparison).not.toBeNull();
    expect(result.comparison!.dimensionRankings).toHaveLength(1);
    expect(result.comparison!.heatmapData['ws1']['fileQuantity']).toBe(9);
  });
});
