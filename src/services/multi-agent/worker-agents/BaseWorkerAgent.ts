import type {
  WorkerAgentType,
  TaskResult,
  WorkerContext,
  WorkerProgress,
} from '@/types/multi-agent/worker-agents';
import { getSkillRetriever } from '../skill-store/SkillRetriever';

/**
 * BaseWorkerAgent - Base class for all worker agents
 * 
 * Features:
 * - Tracks tool calls, errors, retries
 * - Auto-loads skills when struggling
 * - Skill context injection
 */
export abstract class BaseWorkerAgent {
  readonly type: WorkerAgentType;
  
  protected context: WorkerContext | null = null;
  protected toolCallCount: number = 0;
  protected errorCount: number = 0;
  protected retryCount: number = 0;
  protected loadedSkills: unknown[] = [];
  protected progressCallback?: (progress: WorkerProgress) => void;

  // Thresholds for "struggling"
  protected readonly STRUGGLE_THRESHOLDS = {
    toolCalls: 5,
    errors: 3,
    retries: 2,
  };

  constructor(type: WorkerAgentType) {
    this.type = type;
  }

  /**
   * Execute a task
   */
  async execute(context: WorkerContext): Promise<TaskResult> {
    const startTime = Date.now();
    this.context = context;
    this.resetCounters();

    this.reportProgress('initializing');

    try {
      this.reportProgress('executing');

      // Auto-load skills on dispatch
      await this.loadRelevantSkills();

      // Execute the actual task
      const output = await this.doExecute(context);

      this.reportProgress('completed');

      return {
        taskId: context.taskId,
        workerType: this.type,
        output,
        success: true,
        duration: Date.now() - startTime,
        skillsUsed: [],
        subTasks: [],
      };
    } catch (error) {
      this.errorCount++;
      
      return {
        taskId: context.taskId,
        workerType: this.type,
        output: null,
        success: false,
        duration: Date.now() - startTime,
        skillsUsed: [],
        subTasks: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Check if worker is struggling
   */
  isStruggling(): boolean {
    return (
      this.toolCallCount > this.STRUGGLE_THRESHOLDS.toolCalls ||
      this.errorCount > this.STRUGGLE_THRESHOLDS.errors ||
      this.retryCount > this.STRUGGLE_THRESHOLDS.retries
    );
  }

  /**
   * Track a tool call
   */
  trackToolCall(_toolName: string): void {
    this.toolCallCount++;

    // Check if struggling after tool call
    if (this.isStruggling() && this.loadedSkills.length === 0) {
      this.loadRelevantSkills();
    }
  }

  /**
   * Track an error
   */
  trackError(): void {
    this.errorCount++;
  }

  /**
   * Track a retry
   */
  trackRetry(): void {
    this.retryCount++;
  }

  /**
   * Load relevant skills from store
   */
  protected async loadRelevantSkills(): Promise<void> {
    if (!this.context) return;

    this.reportProgress('skill_loading');

    const retriever = getSkillRetriever();
    
    // If struggling, use struggle retrieval
    if (this.isStruggling()) {
      const skills = await retriever.retrieveForStruggle(this.context.description);
      this.loadedSkills = skills;
    } else {
      // Normal retrieval for dispatch
      const skills = await retriever.retrieveForDispatch(this.context.description);
      this.loadedSkills = skills;
    }
  }

  /**
   * Set progress callback
   */
  setProgressCallback(callback: (progress: WorkerProgress) => void): void {
    this.progressCallback = callback;
  }

  /**
   * Abstract method for actual execution - implement in subclasses
   */
  protected abstract doExecute(context: WorkerContext): Promise<unknown>;

  /**
   * Reset counters between tasks
   */
  private resetCounters(): void {
    this.toolCallCount = 0;
    this.errorCount = 0;
    this.retryCount = 0;
    this.loadedSkills = [];
  }

  /**
   * Report progress
   */
  private reportProgress(phase: WorkerProgress['phase']): void {
    if (this.progressCallback && this.context) {
      this.progressCallback({
        taskId: this.context.taskId,
        phase,
        toolCalls: this.toolCallCount,
        reflections: this.retryCount,
        message: this.getProgressMessage(phase),
      });
    }
  }

  /**
   * Get progress message
   */
  private getProgressMessage(phase: WorkerProgress['phase']): string {
    switch (phase) {
      case 'initializing':
        return 'Initializing task...';
      case 'executing':
        return `Executing (tool calls: ${this.toolCallCount})...`;
      case 'skill_loading':
        return 'Loading relevant skills...';
      case 'completed':
        return 'Task completed successfully';
      case 'failed':
        return 'Task failed';
      default:
        return 'Processing...';
    }
  }
}
