import type { TaskResult } from './worker-agents';

// Goal represents a decomposed sub-goal from user requirement
export interface Goal {
  id: string;
  description: string;
  verified: boolean;
  verificationCriteria: string[];
  completedAt?: number;
}

// Verification result after checking task results
export interface VerificationResult {
  allGoalsMet: boolean;
  goalResults: GoalVerification[];
  missedGoals: Goal[];
  reasoning: string;
}

// Individual goal verification
export interface GoalVerification {
  goal: Goal;
  met: boolean;
  evidence: string;
  taskResults: TaskResult[];
}

// Iteration summary
export interface IterationSummary {
  iteration: number;
  goalsProcessed: Goal[];
  tasksExecuted: TaskResult[];
  newTasksGenerated: string[];
  verification: VerificationResult;
}

// Execution report - final output
export interface ExecutionReport {
  summary: string;
  originalRequirement: string;
  completedGoals: Goal[];
  missedGoals: Goal[];
  iterations: IterationSummary[];
  totalIterations: number;
  skillsUsed: string[];
  totalDuration: number;  // ms
  taskResults: TaskResult[];
  partialCompletion: boolean;  // true if max iterations reached without full completion
  timestamp: number;
}

// Goal decomposition options
export interface DecomposeGoalOptions {
  maxSubGoals?: number;  // Default: 5
  includeVerification?: boolean;  // Default: true
}

// Worker type for task assignment
export type WorkerType = 'context' | 'planning' | 'execution' | 'review';

// CEO Agent configuration
export interface CEOAgentConfig {
  maxIterations?: number;  // Default: 3
  verificationThreshold?: number;  // 0-1, default 0.8
  autoSkillLoad?: boolean;  // Default: true
}

// ── AgentPlan: LLM/规则引擎分解的结构化计划 ─────────────

/** 单个 Agent 计划项 */
export interface AgentPlanItem {
  id: string;
  type: WorkerType;
  name: string;
  description: string;
  dependsOn: string[];
  priority: number;
  verificationCriteria: string[];
}

/** CEO 分解后的完整执行计划 */
export interface AgentPlan {
  agents: AgentPlanItem[];
  strategy: 'pipeline' | 'parallel' | 'mixed';
  estimatedDuration: number;
}

/** CEO Agent 用户偏好配置 */
export interface CEOAgentPreferences {
  planMode: 'auto' | 'confirm';
  decompositionMode: 'llm' | 'rules' | 'hybrid';
  maxRetries: number;
}

/** 默认偏好 */
export const DEFAULT_CEO_PREFERENCES: CEOAgentPreferences = {
  planMode: 'auto',
  decompositionMode: 'hybrid',
  maxRetries: 1,
};
