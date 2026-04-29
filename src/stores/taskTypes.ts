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
