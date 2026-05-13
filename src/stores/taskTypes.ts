/**
 * Task Store Types — extracted from useTaskStore.ts
 */
import type { RAGChunk } from '../types/events';
import type { PendingAttachment } from '../types/attachment';

export interface PendingAttachmentData extends PendingAttachment {}

export interface MarkdownCardData {
  id: string;
  queryId: string;
  timestamp: number;
  query: string;
  analysis: string;
  summary?: string;
  completeSummary?: string;
  tokenUsage?: number;
  ragChunks?: RAGChunk[];
  attachments?: PendingAttachmentData[];
  workspaceId?: string;
  // agent variant
  variant?: 'normal' | 'agent' | 'agent-process';
  agentReport?: {
    totalGoals: number;
    completedGoals: number;
    missedGoals: number;
    duration: number;
    skillsUsed?: Array<{ name: string; domain: string; matchScore?: number }>;
    recoveries?: Array<{ type: string; agentId: string; success: boolean }>;
  };
  /** 多 Agent 三阶段过程数据（variant='agent-process' 时使用） */
  agentProcess?: {
    query: string;
    strategy: string;
    plan: Array<{
      id: string;
      name: string;
      type: string;
      description: string;
      dependsOn?: string[];
    }>;
    results: Array<{
      taskId: string;
      agentName: string;
      agentType: string;
      success: boolean;
      duration: number;
      output: string;       // 子 Agent 输出文本
      error?: string;
    }>;
    summary: string;        // CEO 总结 (Markdown)
  };
}

export interface CurrentCardData {
  queryId: string;
  query: string;
  timestamp: number;
  summary?: string;
  isCollapsed?: boolean;
  ragChunks?: Array<{
    id: string;
    content: string;
    score: number;
    sourceSessionId: string;
    sourceSessionTitle: string;
    timestamp: number;
  }>;
  attachments?: PendingAttachmentData[];
}
