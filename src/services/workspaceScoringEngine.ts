import type { WorkspaceFileData, WorkspaceScoreResult, DimensionScore } from '@/types/globalAgent';
import type { DispatchWorkspaceResult } from '@/types/global-dispatch';
import type { ExtendedAnalysisDimension } from '@/types/globalAgent';

export const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs',
  '.cpp', '.c', '.rb', '.php', '.swift', '.kt', '.scala', '.lua',
]);

export const DIMENSION_WEIGHTS: Record<ExtendedAnalysisDimension, number> = {
  codeQuality: 0.20,
  correctness: 0.20,
  performance: 0.10,
  consistency: 0.10,
  creativity: 0.10,
  costEfficiency: 0.10,
  speed: 0.05,
  fileQuantity: 0.05,
  fileDiversity: 0.05,
  codeDocRatio: 0.03,
  modificationDensity: 0.02,
};

export function zScoreNormalize(values: number[]): number[] {
  if (values.length === 1) return [...values];
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const std = Math.sqrt(variance);
  if (std === 0) return values.map(() => 5);
  return values.map(v => {
    const z = (v - mean) / std;
    return Math.round(Math.max(1, Math.min(10, z * 1.5 + 5)) * 10) / 10;
  });
}

export function scoreWorkspace(
  workspaceId: string,
  workspaceName: string,
  fileData: WorkspaceFileData,
  dispatchResult: DispatchWorkspaceResult,
  aiScores: { costEfficiency: number; speed: number },
): WorkspaceScoreResult {
  const { stats } = fileData;

  const rawScores: Record<string, number> = {
    fileQuantity: stats.totalCreatedFiles + stats.totalModifiedFiles,
    fileDiversity: stats.codeFiles + stats.docFiles + stats.configFiles,
    codeDocRatio: stats.docFiles === 0 ? 10 : Math.min(10, stats.codeFiles / stats.docFiles),
    modificationDensity: stats.totalLines === 0 ? 5 : Math.min(10, (stats.modifiedLines / stats.totalLines) * 10),
  };

  const scores: DimensionScore[] = [
    { dimension: 'fileQuantity', score: rawScores.fileQuantity, comment: `共 ${rawScores.fileQuantity} 个文件` },
    { dimension: 'fileDiversity', score: rawScores.fileDiversity, comment: `含 ${stats.codeFiles} 代码 / ${stats.docFiles} 文档 / ${stats.configFiles} 配置` },
    { dimension: 'codeDocRatio', score: rawScores.codeDocRatio, comment: `代码/文档比 = ${rawScores.codeDocRatio.toFixed(1)}` },
    { dimension: 'modificationDensity', score: rawScores.modificationDensity, comment: `修改密度 = ${rawScores.modificationDensity.toFixed(1)}/10` },
    { dimension: 'costEfficiency', score: aiScores.costEfficiency, comment: '成本效率评分' },
    { dimension: 'speed', score: aiScores.speed, comment: '执行速度评分' },
    { dimension: 'codeQuality', score: 7, comment: '' },
    { dimension: 'correctness', score: 7, comment: '' },
    { dimension: 'performance', score: 7, comment: '' },
    { dimension: 'consistency', score: 7, comment: '' },
    { dimension: 'creativity', score: 7, comment: '' },
  ];

  const compositeScore = scores.reduce(
    (sum, s) => sum + s.score * DIMENSION_WEIGHTS[s.dimension],
    0
  );

  return { workspaceId, workspaceName, scores, compositeScore: Math.round(compositeScore * 10) / 10 };
}
