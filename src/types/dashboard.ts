/**
 * dashboard — DataDashboard 共享类型
 * Extracted from DataDashboard.tsx
 */

export interface ToolCallStats {
  name: string;
  count: number;
}

export interface QueryTrend {
  date: string;
  count: number;
}

export interface WorkspaceStats {
  path: string;
  count: number;
}

export interface DashboardData {
  workspacePaths: number;
  totalSessions: number;
  totalQueries: number;
  totalVectors: number;
  workspaceStats: WorkspaceStats[];
  queryTrend: QueryTrend[];
  toolRanking: ToolCallStats[];
  indexedQueries: number;
  indexedToolCalls: number;
  vectorUsageMB: number;
  ragHealth: number; // 0-100
  loading: boolean;
}
