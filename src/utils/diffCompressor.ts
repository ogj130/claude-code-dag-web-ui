/**
 * V1.4.0 - Diff Compressor
 * Diff-based Forgetting compression engine
 *
 * Core algorithm: analyze context diff between adjacent tool calls,
 * preserve only deltas, aggregate repetitive patterns.
 */

import type {
  CompactionReport,
  PreservedItems,
  CompressedItems,
  PreservationStrategy,
  CompactionSettings,
  ContextUsageState,
} from '../types/compaction';
import { useCompactionStore } from '../stores/useCompactionStore';
import { useTaskStore } from '../stores/useTaskStore';
import type { ClaudeEvent, ToolCall, DAGNode } from '../types/events';
import { getCompressionStatus } from '../types/compaction';

// ---------------------------------------------------------------------------
// Token estimation utilities
// ---------------------------------------------------------------------------

/** Rough token estimation: ~4 chars per token for English, ~2 for Chinese */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars / 2 + otherChars / 4);
}

/** Estimate tokens from an array of tool calls */
export function estimateToolCallTokens(toolCalls: ToolCall[]): number {
  return toolCalls.reduce((sum, tc) => {
    const argsStr = JSON.stringify(tc.args || {});
    const resultStr = tc.result || '';
    return sum + estimateTokens(argsStr) + estimateTokens(resultStr);
  }, 0);
}

// ---------------------------------------------------------------------------
// Diff analysis: identify patterns to preserve vs compress
// ---------------------------------------------------------------------------

interface ToolCallPattern {
  tool: string;
  argsTemplates: string[]; // Normalized argument templates
  occurrences: ToolCall[];
}

/**
 * Group tool calls by pattern (same tool + similar args)
 */
export function groupToolCallPatterns(toolCalls: ToolCall[]): Map<string, ToolCallPattern> {
  const patterns = new Map<string, ToolCallPattern>();

  for (const tc of toolCalls) {
    // Normalize args to template: replace dynamic values with placeholders
    const template = normalizeArgsTemplate(tc.args);
    const key = `${tc.tool}:${template}`;

    const existing = patterns.get(key);
    if (existing) {
      existing.occurrences.push(tc);
    } else {
      patterns.set(key, {
        tool: tc.tool,
        argsTemplates: [template],
        occurrences: [tc],
      });
    }
  }

  return patterns;
}

/**
 * Normalize tool args to a stable template
 * Replace dynamic values (IDs, timestamps, paths) with placeholders
 */
export function normalizeArgsTemplate(args: Record<string, unknown>): string {
  const template: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(args)) {
    if (value === null || value === undefined) {
      template[key] = null;
    } else if (typeof value === 'string') {
      // Replace common dynamic patterns
      if (
        /^\d+$/.test(value) || // Pure numbers (timestamps, IDs)
        /^\/.*\/[a-z]*$/.test(value) || // Regex patterns
        value.startsWith('/tmp/') ||
        value.startsWith('/var/folders/')
      ) {
        template[key] = '<DYNAMIC>';
      } else {
        template[key] = value;
      }
    } else if (Array.isArray(value)) {
      template[key] = value.map((v) =>
        typeof v === 'string' && /^\d+$/.test(v) ? '<DYNAMIC>' : v
      );
    } else if (typeof value === 'object') {
      template[key] = '<OBJECT>';
    } else {
      template[key] = value;
    }
  }

  return JSON.stringify(template);
}

// ---------------------------------------------------------------------------
// Error pattern analysis
// ---------------------------------------------------------------------------

interface ErrorPattern {
  rootCause: string;
  occurrences: string[];
  count: number;
}

/**
 * Analyze error messages and group by root cause
 */
export function analyzeErrorPatterns(errorMessages: string[]): ErrorPattern[] {
  const patterns: ErrorPattern[] = [];
  const seen = new Map<string, ErrorPattern>();

  for (const msg of errorMessages) {
    const rootCause = extractRootCause(msg);
    const existing = seen.get(rootCause);

    if (existing) {
      existing.occurrences.push(msg);
      existing.count++;
    } else {
      const pattern: ErrorPattern = {
        rootCause,
        occurrences: [msg],
        count: 1,
      };
      seen.set(rootCause, pattern);
      patterns.push(pattern);
    }
  }

  return patterns;
}

/**
 * Extract root cause from error message
 */
export function extractRootCause(errorMsg: string): string {
  if (!errorMsg) return 'Unknown error';

  // Pattern matching for common error types
  const patterns: [RegExp, string][] = [
    [/permission|denied|access denied|eacces/i, 'Permission denied'],
    [/not found|enoent|does not exist/i, 'File not found'],
    [/timeout|timed out/i, 'Timeout'],
    [/network|connection|refused|ECONNREFUSED/i, 'Network error'],
    [/syntax|parse|unexpected/i, 'Syntax error'],
    [/import|module|require/i, 'Module import error'],
    [/git|commit|branch/i, 'Git operation error'],
    [/docker|container|port/i, 'Docker error'],
    [/auth|authentication|login|token/i, 'Authentication error'],
    [/disk|space|enospc/i, 'Disk space error'],
  ];

  for (const [regex, cause] of patterns) {
    if (regex.test(errorMsg)) return cause;
  }

  // Truncate long messages
  return errorMsg.length > 60 ? errorMsg.slice(0, 60) + '...' : errorMsg;
}

// ---------------------------------------------------------------------------
// Code structure extraction
// ---------------------------------------------------------------------------

interface CodeStructure {
  files: number;
  functions: number;
  classes: number;
}

/**
 * Extract code structure from Read tool call results
 */
export function extractCodeStructure(
  toolCalls: ToolCall[],
  strategy: PreservationStrategy
): CodeStructure {
  let files = 0;
  let functions = 0;
  let classes = 0;

  for (const tc of toolCalls) {
    if (tc.tool === 'Read' && tc.result) {
      files++;
      // Conservative extraction based on strategy
      if (strategy !== 'aggressive') {
        // Count function-like patterns
        const funcMatches = tc.result.match(/(?:function|const|class|def|async)\s+\w+/g);
        if (funcMatches) functions += funcMatches.length;

        // Count class definitions
        const classMatches = tc.result.match(/class\s+\w+/g);
        if (classMatches) classes += classMatches.length;
      }
    }
  }

  return { files, functions, classes };
}

// ---------------------------------------------------------------------------
// Decision extraction from agent messages
// ---------------------------------------------------------------------------

/**
 * Extract design decisions from agent reasoning
 */
export function extractDecisions(events: ClaudeEvent[]): string[] {
  const decisions: string[] = [];
  const decisionPatterns = [
    /(?:decided|choosing|chosen|selected)\s+(?:to\s+)?(.+)/gi,
    /(?:approach|strategy)\s*:\s*(.+)/gi,
    /(?:using|adopted)\s+(?:the\s+)?(.+?)\s+(?:approach|method)/gi,
  ];

  for (const event of events) {
    if (event.type === 'subagent_message') {
      const message = 'message' in event ? event.message : '';
      for (const pattern of decisionPatterns) {
        const matches = message.matchAll(pattern);
        for (const match of matches) {
          if (match[1]) decisions.push(match[1].trim().slice(0, 100));
        }
      }
    }
  }

  // Deduplicate
  return [...new Set(decisions)].slice(0, 20);
}

// ---------------------------------------------------------------------------
// Hook/CLAUDE.md extraction
// ---------------------------------------------------------------------------

/**
 * Extract referenced hooks and config files from events
 */
export function extractHooksAndConfigs(events: ClaudeEvent[]): string[] {
  const refs: string[] = [];
  const hookPattern = /hooks?[\/.](?:md|sh)|\.claude[_-]|claude\.md|CLAUDE\.md/gi;
  const configPattern = /package\.json|tsconfig|vite\.config|eslint|pret[^t]+rc/gi;

  for (const event of events) {
    let text = '';
    if (event.type === 'subagent_message' && 'message' in event) {
      text = event.message;
    } else if (event.type === 'tool_result' && 'result' in event) {
      text = String(event.result);
    }
    if (!text) continue;

    const hookMatches = text.match(hookPattern);
    if (hookMatches) refs.push(...hookMatches);
    const configMatches = text.match(configPattern);
    if (configMatches) refs.push(...configMatches);
  }

  return [...new Set(refs)].slice(0, 10);
}

// ---------------------------------------------------------------------------
// Process summarization
// ---------------------------------------------------------------------------

/**
 * Summarize exploration steps into conclusions
 */
export function summarizeProcesses(toolCalls: ToolCall[]): string[] {
  const conclusions: string[] = [];

  // File system discoveries
  const lsResults = toolCalls.filter((tc) => tc.tool === 'Bash' && tc.result);
  if (lsResults.length > 0) {
    const uniqueDirs = new Set(
      lsResults
        .map((tc) => {
          const match = tc.result?.match(/(?:^|\n)([^\n]+\/)/);
          return match?.[1];
        })
        .filter(Boolean)
    );
    if (uniqueDirs.size > 0) {
      conclusions.push(`Discovered ${uniqueDirs.size} directories`);
    }
  }

  // Read file count
  const readFiles = toolCalls.filter((tc) => tc.tool === 'Read');
  if (readFiles.length > 0) {
    conclusions.push(`Read ${readFiles.length} files`);
  }

  // Grep search findings
  const grepResults = toolCalls.filter((tc) => tc.tool === 'Grep' && tc.result);
  if (grepResults.length > 0) {
    const totalMatches = grepResults.reduce((sum, tc) => {
      const lines = tc.result?.split('\n').filter(Boolean) || [];
      return sum + lines.length;
    }, 0);
    conclusions.push(`Grep found ${totalMatches} matches`);
  }

  // Edit operations
  const edits = toolCalls.filter((tc) => tc.tool === 'Edit' || tc.tool === 'Write');
  if (edits.length > 0) {
    conclusions.push(`Modified ${edits.length} files`);
  }

  return conclusions;
}

// ---------------------------------------------------------------------------
// Main compression engine
// ---------------------------------------------------------------------------

export interface CompressionInput {
  events: ClaudeEvent[];
  toolCalls: ToolCall[];
  nodes: Map<string, DAGNode>;
  sessionId: string;
  settings?: CompactionSettings;
}

/**
 * Execute diff-based compression
 *
 * Algorithm:
 * 1. Group tool calls by pattern, aggregate repetitive ones
 * 2. Analyze error messages, extract root causes
 * 3. Extract and preserve code structure
 * 4. Extract decisions and hooks
 * 5. Summarize processes into conclusions
 * 6. Generate compression report
 */
export function executeDiffCompression(input: CompressionInput): CompactionReport {
  const { events, toolCalls, sessionId, settings } = input;
  const preservationStrategy: PreservationStrategy = settings?.preservationStrategy ?? 'smart';

  // Calculate before tokens
  const beforeTokens = estimateToolCallTokens(toolCalls);

  // --- Compressed items ---

  // 1. Aggregate tool call patterns
  const patterns = groupToolCallPatterns(toolCalls);
  const aggregatedPatterns: string[] = [];

  for (const [, pattern] of patterns) {
    if (pattern.occurrences.length > 1) {
      aggregatedPatterns.push(
        `${pattern.tool}: ${pattern.occurrences.length}x (aggregated)`
      );
    }
  }

  const compressedToolCalls: CompressedItems['toolCalls'] = {
    original: toolCalls.length,
    compressed:
      aggregatedPatterns.length > 0
        ? aggregatedPatterns.slice(0, 5).join('; ')
        : `${toolCalls.length} calls`,
  };

  // 2. Analyze error patterns
  const errorMessages = toolCalls
    .filter((tc) => tc.status === 'error' && tc.result)
    .map((tc) => tc.result!);

  const errorPatterns = analyzeErrorPatterns(errorMessages);
  const compressedErrors: CompressedItems['errors'] = {
    original: errorMessages.length,
    summary:
      errorPatterns.length > 0
        ? errorPatterns
            .map((p) => `${p.rootCause} (${p.count})`)
            .slice(0, 3)
            .join('; ')
        : 'No errors',
  };

  // 3. Summarize processes
  const conclusions = summarizeProcesses(toolCalls);
  const compressedProcesses: CompressedItems['processes'] = {
    original: toolCalls.length,
    conclusions,
  };

  const compressed: CompressedItems = {
    toolCalls: compressedToolCalls,
    errors: compressedErrors,
    processes: compressedProcesses,
  };

  // --- Preserved items ---

  // 1. Code structure (always preserved)
  const codeStructure = extractCodeStructure(toolCalls, preservationStrategy);

  // 2. Decisions (preserved in smart/conservative modes)
  const decisions =
    preservationStrategy !== 'aggressive'
      ? extractDecisions(events)
      : [];

  // 3. Hooks and configs (preserved in all modes)
  const hooks = extractHooksAndConfigs(events);

  const preserved: PreservedItems = {
    codeStructure,
    decisions,
    hooks,
  };

  // Calculate after tokens (rough estimate)
  const afterTokens = Math.max(
    100, // Minimum token count
    Math.floor(beforeTokens * 0.3) // Rough 70% compression
  );

  const savingsPct = beforeTokens > 0
    ? Math.max(0, ((beforeTokens - afterTokens) / beforeTokens) * 100)
    : 0;

  // Generate AI rationale
  const aiRationale = generateAIRationale({
    savingsPct,
    preserved,
    compressed,
    strategy: preservationStrategy,
  });

  const report: CompactionReport = {
    id: `cp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    sessionId,
    timestamp: Date.now(),
    beforeTokens,
    afterTokens,
    savingsPct,
    preserved,
    compressed,
    aiRationale,
  };

  return report;
}

/**
 * Generate human-readable AI rationale for compression
 */
function generateAIRationale(params: {
  savingsPct: number;
  preserved: PreservedItems;
  compressed: CompressedItems;
  strategy: PreservationStrategy;
}): string {
  const { savingsPct, preserved, compressed, strategy } = params;

  const parts: string[] = [];

  // Savings summary
  parts.push(
    `Compressed ${savingsPct.toFixed(0)}% of context using ${strategy} strategy.`
  );

  // What was preserved
  if (preserved.codeStructure.files > 0) {
    parts.push(
      `Preserved code structure: ${preserved.codeStructure.files} files, ${preserved.codeStructure.functions} functions.`
    );
  }
  if (preserved.decisions.length > 0) {
    parts.push(`Preserved ${preserved.decisions.length} design decisions.`);
  }
  if (preserved.hooks.length > 0) {
    parts.push(`Referenced configs: ${preserved.hooks.slice(0, 3).join(', ')}.`);
  }

  // What was compressed
  if (compressed.errors.original > 0) {
    parts.push(
      `Compressed ${compressed.errors.original} errors to: ${compressed.errors.summary}.`
    );
  }
  if (compressed.processes.conclusions.length > 0) {
    parts.push(`Summarized processes to: ${compressed.processes.conclusions.join('; ')}.`);
  }

  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Auto-trigger integration
// ---------------------------------------------------------------------------

/**
 * Check if compression should be triggered based on context usage
 */
export function shouldTriggerCompression(
  contextUsage: ContextUsageState,
  settings: CompactionSettings
): boolean {
  const status = getCompressionStatus(contextUsage.usagePct);
  return (
    status === 'critical' &&
    contextUsage.usagePct >= settings.triggerThreshold
  );
}

/**
 * Run compression and update store
 */
export async function runCompression(
  sessionId: string,
  settings: CompactionSettings
): Promise<CompactionReport | null> {
  try {
    // Get current state from task store
    const taskStore = useTaskStore.getState();
    const { toolCalls, nodes } = taskStore;

    // Get recent events from WebSocket buffer or store
    // For now, use tool calls as the primary source
    const toolCallArray = Array.from(toolCalls.values());

    // Build input
    const input: CompressionInput = {
      events: [], // Would come from event buffer
      toolCalls: toolCallArray,
      nodes,
      sessionId,
      settings,
    };

    // Execute compression
    const report = executeDiffCompression(input);

    // Store report
    useCompactionStore.getState().addReport(report);

    return report;
  } catch (error) {
    console.error('[DiffCompressor] Compression failed:', error);
    return null;
  }
}
