import type { SkillRef } from '@/types/multi-agent/skill';
import type { TaskResult } from '@/types/multi-agent/worker-agents';

/**
 * Worker Agent 执行器的上下文
 */
export interface WorkerExecutorContext {
  taskId: string;
  description: string;
  workspaceId: string;
  context?: Record<string, unknown>;
}

/**
 * Worker Agent 的执行器接口
 * 封装了"如何执行一个子任务"的逻辑
 */
export interface WorkerExecutor {
  execute(
    task: WorkerExecutorContext,
    skills: SkillRef[],
    callbacks?: {
      onOutput?: (chunk: string) => void;
      onError?: (error: string) => void;
    }
  ): Promise<TaskResult>;
}

// ── 智能恢复引擎类型 ─────────────────────────────────────

export type FailureCategory =
  | 'timeout'
  | 'permission'
  | 'syntax_error'
  | 'tool_error'
  | 'unknown';

export type RecoveryAction =
  | { type: 'retry'; newAgentType?: import('@/types/multi-agent/ceo-agent').WorkerType; subTasks?: string[] }
  | { type: 'split'; subTasks: string[] }
  | { type: 'skip'; reason: string }
  | { type: 'fail'; reason: string };

export interface RecoveryStrategy {
  diagnose(error: string, agentType: import('@/types/multi-agent/ceo-agent').WorkerType): FailureCategory;
  recover(
    category: FailureCategory,
    goal: import('@/types/multi-agent/ceo-agent').Goal,
    originalPlan: import('@/types/multi-agent/ceo-agent').AgentPlan
  ): RecoveryAction;
}

/** LLM 分解器的 prompt 模板 */
export const LLM_DECOMPOSE_PROMPT = `You are a task decomposition expert. Analyze the following requirement and break it down into specialized sub-tasks for a multi-agent system.

Available agent types:
- context: Analyzes project structure, technology stack, existing code
- planning: Designs architecture, creates implementation plans, reviews designs
- execution: Writes code, fixes bugs, runs commands, implements features
- review: Reviews code, checks quality, validates outputs

Return a JSON object with this exact structure:
{
  "agents": [
    {
      "id": "agent-1",
      "type": "context",
      "name": "ContextAgent",
      "description": "Analyze project structure and existing auth middleware",
      "dependsOn": [],
      "priority": 1,
      "verificationCriteria": ["project_structure_analyzed"]
    }
  ],
  "strategy": "pipeline",
  "estimatedDuration": 3000
}

Rules:
- Max 5 agents
- Execution type agents should depend on context or planning agents
- strategy: "parallel" if no dependencies between agents, "pipeline" if sequential, "mixed" if both
- Priority 1 = highest, runs first
- Keep descriptions under 100 characters

Requirement: `;
