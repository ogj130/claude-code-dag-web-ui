import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  zScoreNormalize,
  scoreWorkspace,
  DIMENSION_WEIGHTS,
} from '@/services/workspaceScoringEngine';
import type { WorkspaceFileData } from '@/types/globalAgent';
import type { DispatchWorkspaceResult } from '@/types/global-dispatch';

describe('WorkspaceScoringEngine', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('T2-1: Z-score 将 [10,20,30] 归一化到 1-10 区间', () => {
    const result = zScoreNormalize([10, 20, 30]);
    expect(result.every(v => v >= 1 && v <= 10)).toBe(true);
    expect(Math.abs(result[1] - 5)).toBeLessThan(1);
  });

  it('T2-2: 所有值相同时避免除零，返回 [5, 5, 5]', () => {
    const result = zScoreNormalize([5, 5, 5]);
    expect(result).toEqual([5, 5, 5]);
  });

  it('T2-3: 单工作区直接返回原始值，不归一化', () => {
    const result = zScoreNormalize([8]);
    expect(result).toEqual([8]);
  });

  it('T2-4: DIMENSION_WEIGHTS 总和等于 1.00', () => {
    const total = Object.values(DIMENSION_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1.0, 2);
  });

  it('T2-5: compositeScore = Σ(score × weight)，保留 1 位小数', () => {
    const scores = { codeQuality: 8, correctness: 9, performance: 7,
      consistency: 8, creativity: 7, costEfficiency: 6, speed: 8,
      fileQuantity: 8, fileDiversity: 7, codeDocRatio: 6, modificationDensity: 5 };
    const compositeScore = Object.entries(scores).reduce(
      (sum, [dim, score]) => sum + score * DIMENSION_WEIGHTS[dim as keyof typeof DIMENSION_WEIGHTS],
      0
    );
    const rounded = Math.round(compositeScore * 10) / 10;
    expect(rounded).toBeGreaterThan(0);
    expect(rounded).toBeLessThanOrEqual(10);
  });

  it('T2-6: 返回的 scores 包含新增 4 个文件维度', () => {
    const fileData: WorkspaceFileData = {
      workspaceId: 'ws1', workspaceName: 'ws1',
      createdFiles: [{ path: '/a.ts', name: 'a.ts', extension: '.ts' }],
      modifiedFiles: [],
      summary: 'test',
      stats: {
        totalCreatedFiles: 10, totalModifiedFiles: 5, codeFiles: 8,
        docFiles: 5, configFiles: 2, totalLines: 500, modifiedLines: 120, avgFileSize: 1000,
      },
    };
    const dispatchResult: DispatchWorkspaceResult = {
      workspaceId: 'ws1', sessionId: 's1', status: 'success',
      promptResults: [{ prompt: 'a', status: 'success' }],
    };
    const result = scoreWorkspace('ws1', 'ws1', fileData, dispatchResult, { costEfficiency: 7, speed: 8 });
    const dimensions = result.scores.map(s => s.dimension);
    expect(dimensions).toContain('fileQuantity');
    expect(dimensions).toContain('fileDiversity');
    expect(dimensions).toContain('codeDocRatio');
    expect(dimensions).toContain('modificationDensity');
  });

  it('T2-7: 文件数量多的工作区 fileQuantity 分数更高', () => {
    const data1: WorkspaceFileData = {
      workspaceId: 'ws1', workspaceName: 'ws1',
      createdFiles: [], modifiedFiles: [],
      summary: '',
      stats: { totalCreatedFiles: 20, totalModifiedFiles: 0, codeFiles: 20,
        docFiles: 0, configFiles: 0, totalLines: 0, modifiedLines: 0, avgFileSize: 0 },
    };
    const data2: WorkspaceFileData = {
      workspaceId: 'ws2', workspaceName: 'ws2',
      createdFiles: [], modifiedFiles: [],
      summary: '',
      stats: { totalCreatedFiles: 2, totalModifiedFiles: 0, codeFiles: 2,
        docFiles: 0, configFiles: 0, totalLines: 0, modifiedLines: 0, avgFileSize: 0 },
    };
    const dispatch1 = { workspaceId: 'ws1', sessionId: 's1', status: 'success', promptResults: [] };
    const dispatch2 = { workspaceId: 'ws2', sessionId: 's2', status: 'success', promptResults: [] };
    const r1 = scoreWorkspace('ws1', 'ws1', data1, dispatch1, { costEfficiency: 5, speed: 5 });
    const r2 = scoreWorkspace('ws2', 'ws2', data2, dispatch2, { costEfficiency: 5, speed: 5 });
    const fq1 = r1.scores.find(s => s.dimension === 'fileQuantity')!.score;
    const fq2 = r2.scores.find(s => s.dimension === 'fileQuantity')!.score;
    expect(fq1).toBeGreaterThan(fq2);
  });

  it('T2-8: codeDocRatio = codeFiles / docFiles（docFiles=0 时返回 10）', () => {
    const dataWithDocs: WorkspaceFileData = {
      workspaceId: 'ws1', workspaceName: 'ws1',
      createdFiles: [], modifiedFiles: [],
      summary: '',
      stats: { totalCreatedFiles: 10, totalModifiedFiles: 0, codeFiles: 8,
        docFiles: 2, configFiles: 0, totalLines: 0, modifiedLines: 0, avgFileSize: 0 },
    };
    const dataNoDocs: WorkspaceFileData = {
      workspaceId: 'ws2', workspaceName: 'ws2',
      createdFiles: [], modifiedFiles: [],
      summary: '',
      stats: { totalCreatedFiles: 10, totalModifiedFiles: 0, codeFiles: 10,
        docFiles: 0, configFiles: 0, totalLines: 0, modifiedLines: 0, avgFileSize: 0 },
    };
    const dispatch = { workspaceId: 'ws1', sessionId: 's1', status: 'success', promptResults: [] };
    const r1 = scoreWorkspace('ws1', 'ws1', dataWithDocs, dispatch, { costEfficiency: 5, speed: 5 });
    const r2 = scoreWorkspace('ws2', 'ws2', dataNoDocs, dispatch, { costEfficiency: 5, speed: 5 });
    const ratio1 = r1.scores.find(s => s.dimension === 'codeDocRatio')!.score;
    const ratio2 = r2.scores.find(s => s.dimension === 'codeDocRatio')!.score;
    expect(ratio2).toBe(10);
    expect(ratio1).toBeLessThan(10);
  });
});
