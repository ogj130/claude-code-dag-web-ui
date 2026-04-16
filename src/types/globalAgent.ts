/**
 * 全局 Agent 分析服务类型定义
 */

/** 评分维度枚举 */
export type AnalysisDimension =
  | 'codeQuality'
  | 'correctness'
  | 'performance'
  | 'consistency'
  | 'creativity'
  | 'costEfficiency'
  | 'speed';

/** Agent 配置 */
export interface GlobalAgentConfig {
  /** 使用的模型配置 ID */
  modelConfigId: string;
  /** 自定义分析提示词模板 */
  analysisPromptTemplate?: string;
  /** 是否自动分析 */
  autoAnalyze: boolean;
}

/** 单个维度的评分结果 */
export interface DimensionScore {
  dimension: AnalysisDimension;
  score: number; // 1-10 整体均分
  /** 各工作区在该维度的得分（用于对比 Top1）。AI 分析时由执行数据补充。 */
  perWorkspaceScores?: WorkspaceDimensionScore[];
  comment: string;
}

/** 单个工作区在单个维度的得分 */
export interface WorkspaceDimensionScore {
  workspaceId: string;
  workspaceName: string;
  score: number;
}

/** 工作区排名信息 */
export interface WorkspaceRanking {
  workspaceId: string;
  workspaceName: string;
  totalScore: number;
  rank: number;
  strengths: string[];
  weaknesses: string[];
}

// ── 文件分析维度（新增定量维度）──────────────────────────────────────────────
export type FileAnalysisDimension =
  | 'fileQuantity'        // 文件总数（新增+修改）
  | 'fileDiversity'       // 文件类型多样性（代码/文档/配置混合程度）
  | 'codeDocRatio'        // 代码文件 / 文档文件 比例
  | 'modificationDensity'; // 修改行数 / 总行数 比例

export type ExtendedAnalysisDimension = AnalysisDimension | FileAnalysisDimension;

// ── 文件统计数据 ─────────────────────────────────────────────────────────
export interface FileStats {
  totalCreatedFiles: number;
  totalModifiedFiles: number;
  codeFiles: number;       // .ts/.tsx/.js/.jsx/.py 等
  docFiles: number;        // .md/.txt 等
  configFiles: number;     // .json/.yaml/.toml 等
  totalLines: number;
  modifiedLines: number;
  avgFileSize: number;
}

// ── 文件条目 ─────────────────────────────────────────────────────────────
export interface FileEntry {
  path: string;
  name: string;
  extension: string;
  lines?: number;
  size?: number;
}

// ── 单个工作区文件数据 ────────────────────────────────────────────────────
export interface WorkspaceFileData {
  workspaceId: string;
  workspaceName: string;
  createdFiles: FileEntry[];
  modifiedFiles: FileEntry[];
  summary: string;
  stats: FileStats;
}

// ── 单个工作区评分结果 ────────────────────────────────────────────────────
export interface WorkspaceScoreResult {
  workspaceId: string;
  workspaceName: string;
  scores: DimensionScore[];
  compositeScore: number;
}

// ── 各维度独立排名 ────────────────────────────────────────────────────────
export interface DimensionRankingItem {
  workspaceId: string;
  workspaceName: string;
  score: number;
  rank: number;
}

export interface DimensionRanking {
  dimension: ExtendedAnalysisDimension;
  rankings: DimensionRankingItem[];
  topWinner?: string; // workspaceId
}

// ── 对比结果（嵌入 GlobalAgentResult）────────────────────────────────────
export interface ComparisonResult {
  dimensionRankings: DimensionRanking[];
  compositeRanking: WorkspaceRanking[];
  heatmapData: Record<string, Record<string, number>>; // [wsId][dimension] = score
  radarData: Record<string, DimensionScore[]>;
  generatedAt: number;
}

/** 全局 Agent 分析结果 */
export interface GlobalAgentResult {
  id: string;
  batchId: string;
  modelUsed: string;
  rankings: WorkspaceRanking[];
  scores: DimensionScore[];
  commentary: string;
  roast: string;
  recommendations: string[];
  createdAt: number;
  comparison?: ComparisonResult; // 多维度对比分析结果
}
