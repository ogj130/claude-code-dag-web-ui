import type { SkillRef } from './skill';
// WorkerType is used by ceo-agent for worker classification

// Worker types
export type WorkerAgentType = 'context' | 'planning' | 'execution' | 'base';

// Task result from worker execution
export interface TaskResult {
  taskId: string;
  workerType: WorkerAgentType;
  output: unknown;
  success: boolean;
  duration: number;  // ms
  skillsUsed: SkillRef[];
  subTasks: TaskResult[];
  error?: string;
  metadata?: Record<string, unknown>;
}

// Worker context - injected into agent
export interface WorkerContext {
  taskId: string;
  description: string;
  skillRefs: SkillRef[];
  /** 工作区 ID（用于真实执行和 LLM 上下文注入） */
  workspaceId?: string;
  /** 工作区路径（项目根目录） */
  workspacePath?: string;
  metadata?: Record<string, unknown>;
}

// Worker execution options
export interface WorkerExecutionOptions {
  timeout?: number;  // ms, default 5 minutes
  retries?: number;
  onProgress?: (progress: WorkerProgress) => void;
}

// Worker progress update
export interface WorkerProgress {
  taskId: string;
  phase: 'initializing' | 'executing' | 'skill_loading' | 'completed' | 'failed';
  toolCalls: number;
  reflections: number;
  message?: string;
}

// Base worker agent interface
export interface IWorkerAgent {
  type: WorkerAgentType;
  execute(context: WorkerContext): Promise<TaskResult>;
  isStruggling(): boolean;
  loadRelevantSkills(): Promise<void>;
}
