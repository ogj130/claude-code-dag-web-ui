/**
 * V1.4.0 - Context Diff Compression Types
 * Diff-based Forgetting compression engine type definitions
 */

/**
 * Compression report stored in IndexedDB
 */
export interface CompactionReport {
  id: string;
  sessionId: string;
  timestamp: number;
  beforeTokens: number;
  afterTokens: number;
  savingsPct: number;
  preserved: PreservedItems;
  compressed: CompressedItems;
  aiRationale: string;
}

/**
 * Items preserved during compression
 */
export interface PreservedItems {
  codeStructure: CodeStructure;
  decisions: string[];
  hooks: string[];
}

/**
 * Code structure information preserved
 */
export interface CodeStructure {
  files: number;
  functions: number;
  classes: number;
}

/**
 * Items compressed/summarized during compression
 */
export interface CompressedItems {
  toolCalls: ToolCallsSummary;
  errors: ErrorsSummary;
  processes: ProcessSummary;
}

/**
 * Tool call compression summary
 */
export interface ToolCallsSummary {
  original: number;
  compressed: string; // e.g., "Read 15 files"
}

/**
 * Error compression summary
 */
export interface ErrorsSummary {
  original: number;
  summary: string; // e.g., "Permission issues (3 types)"
}

/**
 * Process compression summary
 */
export interface ProcessSummary {
  original: number;
  conclusions: string[];
}

/**
 * Preservation strategy options
 */
export type PreservationStrategy = 'smart' | 'conservative' | 'aggressive';

/**
 * Compression settings stored in IndexedDB
 */
export interface CompactionSettings {
  id: string; // 'default'
  triggerThreshold: number; // 50-95, default 80
  preservationStrategy: PreservationStrategy;
  autoCleanupDays: number; // Days to keep compaction records, default 30
}

/**
 * Context usage tracking state
 */
export interface ContextUsageState {
  totalInputTokens: number;
  estimatedWindow: number; // Based on model
  usagePct: number; // Calculated percentage
  lastUpdated: number;
}

/**
 * Context window estimates by model
 */
export const CONTEXT_WINDOW_ESTIMATES: Record<string, number> = {
  'claude-3.5-sonnet': 128000,
  'claude-3.7-sonnet': 200000,
  'claude-opus-4': 200000,
  'default': 128000, // Conservative default
};

/**
 * Default compaction settings
 */
export const DEFAULT_COMPACTION_SETTINGS: CompactionSettings = {
  id: 'default',
  triggerThreshold: 80,
  preservationStrategy: 'smart',
  autoCleanupDays: 30,
};

/**
 * Compression trigger status
 */
export type CompressionTriggerStatus = 'normal' | 'warning' | 'critical' | 'compressing';

/**
 * Get status based on usage percentage
 */
export function getCompressionStatus(usagePct: number): CompressionTriggerStatus {
  if (usagePct >= 80) return 'critical';
  if (usagePct >= 60) return 'warning';
  return 'normal';
}
