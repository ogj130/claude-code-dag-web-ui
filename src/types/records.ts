/**
 * Storage record type definitions for hierarchical storage model.
 * These types mirror the IndexedDB schema defined in db.ts but are
 * used throughout the application layer.
 */

import type { DAGData } from './dag';

/** Session metadata record */
export interface SessionRecord {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  queryCount: number;
  tokenUsage: number;
  tags: string[];
  summary: string;
  status: 'active' | 'archived' | 'deleted';
}

/** Query record with embedded tool call references */
export interface QueryRecord {
  id: string;
  sessionId: string;
  question: string;
  answer: string;
  toolCalls: ToolCall[];
  dag: DAGData;
  tokenUsage: number;
  duration: number;
  createdAt: number;
  status: 'success' | 'error' | 'partial';
  errorMessage?: string;
}

/** Individual tool call within a query */
export interface ToolCall {
  id: string;
  queryId: string;
  toolName: string;
  arguments: string;
  result: string;
  startTime: number;
  endTime: number;
  status: 'success' | 'error';
}

// DAG types (DAGData, DAGNode, DAGEdge) are defined in types/dag.ts

/** Compressed text wrapper — used when content exceeds 1KB threshold */
export interface CompressedContent {
  /** LZ-compressed base64 string */
  compressed: string;
  /** Original uncompressed size in bytes */
  originalSize: number;
  /** Always true — used for runtime type guard */
  __compressed: true;
}

/** Check if a value is a CompressedContent marker */
export function isCompressedContent(value: unknown): value is CompressedContent {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__compressed' in value &&
    (value as CompressedContent).__compressed === true
  );
}

/** Session shard — created when a single session exceeds 10MB */
export interface SessionShard {
  id: string;
  sessionId: string;
  shardIndex: number;
  data: string;
  originalSize: number;
  createdAt: number;
}
