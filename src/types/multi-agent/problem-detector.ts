// Tool call record
export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  error?: string;
  timestamp: number;
}

// Reflection types during execution
export type ReflectionType = 'retry' | 'error' | 'replan' | 'verification';

// Reflection record
export interface Reflection {
  content: string;
  timestamp: number;
  type: ReflectionType;
  success?: boolean;
}

// Execution trace for a single task
export interface ExecutionTrace {
  taskId: string;
  toolCalls: ToolCall[];
  reflections: Reflection[];
  startTime: number;
  endTime?: number;
  error?: string;
}

// Difficulty level
export type DifficultyLevel = 'easy' | 'medium' | 'hard' | 'expert';

// Problem signature - extracted from traces
export interface ProblemSignature {
  taskId: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';  // Added missing field
  difficulty: DifficultyLevel;
  keyPatterns: string[];
  rootCauses: string[];
  solutionApproach: string;
  traces: ExecutionTrace;
}

// Current problem status for a task
export interface ProblemStatus {
  taskId: string;
  isHardProblem: boolean;
  difficulty: DifficultyLevel;
  progress: {
    toolCalls: number;
    reflections: number;
    retries: number;
    duration: number;  // ms
  };
  thresholds: {
    toolCallCount: number;
    reflectionCount: number;
    retryCount: number;
    duration: number;
  };
  triggered: boolean;
  triggeredAt?: number;
}

// HARD_PROBLEM_THRESHOLDS - when a problem is considered "hard"
export const HARD_PROBLEM_THRESHOLDS = {
  toolCallCount: 5,
  reflectionCount: 3,      // retry type only
  retryCount: 2,
  duration: 5 * 60 * 1000, // 5 minutes in ms
} as const;

// Problem detection result
export interface ProblemDetectionResult {
  problems: ProblemSignature[];
  totalTraces: number;
  hardProblemCount: number;
  averageDifficulty: DifficultyLevel;
}
