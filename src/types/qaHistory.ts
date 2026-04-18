/**
 * QA History 类型定义
 * 供 qaHistoryExport.ts、QAHistoryListView.tsx 及相关服务使用
 */

/** 文件变更记录 */
export interface FileChange {
  path: string;
  type: 'create' | 'modify' | 'delete';
  size?: number;
}

/** 问答历史记录条目 */
export interface QAHistoryEntry {
  id: string;
  workspaceId: string;
  sessionId: string;
  queryId: string;
  prompt: string;
  answer: string;
  tokenUsage: number;
  cost: number;
  latency: number;
  status: string;
  tags: string[];
  rating: number;
  notes?: string;
  toolCalls?: unknown[];
  fileChanges: FileChange[];
  createdAt: number;
}

/** 搜索/筛选条件 */
export interface QASearchFilters {
  workspaceId?: string;
  sessionId?: string;
  keyword?: string;
  tags?: string[];
  rating?: number;
  timeRange?: {
    start?: number;
    end?: number;
  };
}
