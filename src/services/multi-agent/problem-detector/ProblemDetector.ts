import type {
  ExecutionTrace,
  ReflectionType,
  ProblemSignature,
  ProblemStatus,
  DifficultyLevel,
  ProblemDetectionResult,
} from '@/types/multi-agent/problem-detector';
import { HARD_PROBLEM_THRESHOLDS } from '@/types/multi-agent/problem-detector';

/**
 * ProblemDetector - Detects "hard problems" during task execution
 * 
 * A problem is considered "hard" when:
 * - Tool call count > threshold (default: 5)
 * - Retry count > threshold (default: 2)
 * - Reflection count > threshold (default: 3)
 * - Duration > threshold (default: 5 minutes)
 */
export class ProblemDetector {
  // Active traces being tracked
  private activeTraces: Map<string, ExecutionTrace> = new Map();

  /**
   * Start tracking a task
   */
  startTracking(taskId: string): void {
    this.activeTraces.set(taskId, {
      taskId,
      toolCalls: [],
      reflections: [],
      startTime: Date.now(),
    });
  }

  /**
   * Stop tracking a task
   */
  stopTracking(taskId: string): ExecutionTrace | undefined {
    const trace = this.activeTraces.get(taskId);
    if (trace) {
      trace.endTime = Date.now();
      this.activeTraces.delete(taskId);
    }
    return trace;
  }

  /**
   * Track a tool call
   */
  trackToolCall(taskId: string, name: string, args: Record<string, unknown>, result?: unknown): void {
    const trace = this.activeTraces.get(taskId);
    if (!trace) {
      this.startTracking(taskId);
    }
    
    const updated = this.activeTraces.get(taskId)!;
    updated.toolCalls.push({
      name,
      args,
      result,
      timestamp: Date.now(),
    });
  }

  /**
   * Track a reflection (retry, error, replan, verification)
   */
  trackReflection(taskId: string, content: string, type: ReflectionType, success?: boolean): void {
    let trace = this.activeTraces.get(taskId);
    if (!trace) {
      this.startTracking(taskId);
      trace = this.activeTraces.get(taskId)!;
    }

    trace.reflections.push({
      content,
      timestamp: Date.now(),
      type,
      success,
    });
  }

  /**
   * Get current status for a task
   */
  getStatus(taskId: string): ProblemStatus {
    const trace = this.activeTraces.get(taskId);
    
    if (!trace) {
      return {
        taskId,
        isHardProblem: false,
        difficulty: 'easy',
        progress: {
          toolCalls: 0,
          reflections: 0,
          retries: 0,
          duration: 0,
        },
        thresholds: { ...HARD_PROBLEM_THRESHOLDS },
        triggered: false,
      };
    }

    const retries = trace.reflections.filter(r => r.type === 'retry').length;
    const reflections = trace.reflections.length;
    const duration = Date.now() - trace.startTime;

    const triggered = this.isHardProblemByCounts(
      trace.toolCalls.length,
      reflections,
      retries,
      duration
    );

    return {
      taskId,
      isHardProblem: triggered,
      difficulty: this.calculateDifficulty(trace),
      progress: {
        toolCalls: trace.toolCalls.length,
        reflections,
        retries,
        duration,
      },
      thresholds: { ...HARD_PROBLEM_THRESHOLDS },
      triggered,
      triggeredAt: triggered ? Date.now() : undefined,
    };
  }

  /**
   * Detect hard problems from completed traces
   */
  detect(traces: ExecutionTrace[]): ProblemSignature[] {
    return traces
      .filter(trace => this.isHardProblem(trace))
      .map(trace => this.extractSignature(trace));
  }

  /**
   * Check if a trace represents a hard problem
   */
  isHardProblem(trace: ExecutionTrace): boolean {
    const retries = trace.reflections.filter(r => r.type === 'retry').length;
    const duration = (trace.endTime || Date.now()) - trace.startTime;

    return this.isHardProblemByCounts(
      trace.toolCalls.length,
      trace.reflections.length,
      retries,
      duration
    );
  }

  /**
   * Check hard problem by numeric thresholds
   */
  private isHardProblemByCounts(
    toolCallCount: number,
    reflectionCount: number,
    retryCount: number,
    duration: number
  ): boolean {
    return (
      toolCallCount > HARD_PROBLEM_THRESHOLDS.toolCallCount ||
      retryCount > HARD_PROBLEM_THRESHOLDS.retryCount ||
      reflectionCount > HARD_PROBLEM_THRESHOLDS.reflectionCount ||
      duration > HARD_PROBLEM_THRESHOLDS.duration
    );
  }

  /**
   * Extract problem signature from trace
   */
  extractSignature(trace: ExecutionTrace): ProblemSignature {
    const difficulty = this.calculateDifficulty(trace);
    const severityMap: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
      easy: 'low',
      medium: 'medium',
      hard: 'high',
      expert: 'critical',
    };
    
    return {
      taskId: trace.taskId,
      description: this.generateDescription(trace),
      severity: severityMap[difficulty] || 'medium',
      difficulty,
      keyPatterns: this.extractPatterns(trace),
      rootCauses: this.analyzeRootCauses(trace),
      solutionApproach: this.suggestApproach(trace),
      traces: trace,
    };
  }

  /**
   * Calculate difficulty level
   */
  private calculateDifficulty(trace: ExecutionTrace): DifficultyLevel {
    const retries = trace.reflections.filter(r => r.type === 'retry').length;
    const errors = trace.reflections.filter(r => r.type === 'error').length;
    const toolCalls = trace.toolCalls.length;

    if (retries >= 5 || errors >= 3 || toolCalls >= 15) {
      return 'expert';
    }
    if (retries >= 3 || errors >= 2 || toolCalls >= 10) {
      return 'hard';
    }
    if (retries >= 1 || toolCalls >= 5) {
      return 'medium';
    }
    return 'easy';
  }

  /**
   * Generate problem description
   */
  private generateDescription(trace: ExecutionTrace): string {
    const toolCount = trace.toolCalls.length;
    const retryCount = trace.reflections.filter(r => r.type === 'retry').length;
    const errorCount = trace.reflections.filter(r => r.type === 'error').length;

    return `Task ${trace.taskId}: ${toolCount} tool calls, ${retryCount} retries, ${errorCount} errors`;
  }

  /**
   * Extract key patterns from trace
   */
  private extractPatterns(trace: ExecutionTrace): string[] {
    const patterns: string[] = [];
    
    // Tool usage patterns
    const toolNames = trace.toolCalls.map(t => t.name);
    const uniqueTools = Array.from(new Set(toolNames));
    
    if (uniqueTools.length > 5) {
      patterns.push('high_tool_diversity');
    }
    
    if (toolNames.filter(n => n.includes('retry') || n.includes('retry')).length > 2) {
      patterns.push('repeated_retries');
    }

    // Error patterns
    const errors = trace.reflections.filter(r => r.type === 'error');
    if (errors.length > 2) {
      patterns.push('multiple_errors');
    }

    // Replan patterns
    const replans = trace.reflections.filter(r => r.type === 'replan');
    if (replans.length > 1) {
      patterns.push('multiple_replans');
    }

    return patterns;
  }

  /**
   * Analyze root causes
   */
  private analyzeRootCauses(trace: ExecutionTrace): string[] {
    const causes: string[] = [];
    
    // Check for common issues
    const errors = trace.reflections.filter(r => r.type === 'error');
    const errorContents = errors.map(e => e.content.toLowerCase());

    if (errorContents.some(c => c.includes('timeout'))) {
      causes.push('operation_timeout');
    }
    if (errorContents.some(c => c.includes('not found') || c.includes('undefined'))) {
      causes.push('missing_resource');
    }
    if (errorContents.some(c => c.includes('permission') || c.includes('denied'))) {
      causes.push('permission_issue');
    }
    if (errorContents.some(c => c.includes('loop') || c.includes('infinite'))) {
      causes.push('infinite_loop');
    }

    // High tool count suggests complexity
    if (trace.toolCalls.length >= 10) {
      causes.push('high_complexity');
    }

    return causes;
  }

  /**
   * Suggest solution approach based on patterns and root causes
   */
  private suggestApproach(trace: ExecutionTrace): string {
    const patterns = this.extractPatterns(trace);
    const rootCauses = this.analyzeRootCauses(trace);

    if (rootCauses.includes('infinite_loop') || patterns.includes('infinite_loop')) {
      return 'Add loop detection and early termination. Consider caching repeated operations.';
    }
    if (rootCauses.includes('missing_resource') || patterns.includes('missing_resource')) {
      return 'Check resource existence before operations. Add proper initialization.';
    }
    if (rootCauses.includes('operation_timeout') || patterns.includes('operation_timeout')) {
      return 'Increase timeout values or break operation into smaller chunks.';
    }
    if (rootCauses.includes('permission_issue')) {
      return 'Review and fix permissions before operations.';
    }
    if (patterns.includes('high_tool_diversity')) {
      return 'Consider abstracting common operations into reusable functions.';
    }

    return 'Review task decomposition and simplify execution flow.';
  }

  /**
   * Get aggregate detection results
   */
  getDetectionResult(traces: ExecutionTrace[]): ProblemDetectionResult {
    const problems = this.detect(traces);
    
    const difficultyOrder: DifficultyLevel[] = ['easy', 'medium', 'hard', 'expert'];
    const difficulties = problems.map(p => p.difficulty);
    const avgDifficultyIndex = difficulties.length > 0
      ? difficulties.reduce((sum, d) => sum + difficultyOrder.indexOf(d), 0) / difficulties.length
      : 0;

    return {
      problems,
      totalTraces: traces.length,
      hardProblemCount: problems.length,
      averageDifficulty: difficultyOrder[Math.round(avgDifficultyIndex)] || 'easy',
    };
  }
}

// Singleton
let detectorInstance: ProblemDetector | null = null;

export function getProblemDetector(): ProblemDetector {
  if (!detectorInstance) {
    detectorInstance = new ProblemDetector();
  }
  return detectorInstance;
}

export function resetProblemDetector(): void {
  detectorInstance = new ProblemDetector();
}
