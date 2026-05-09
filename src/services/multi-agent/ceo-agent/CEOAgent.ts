import type {
  Goal,
  VerificationResult,
  ExecutionReport,
  IterationSummary,
  CEOAgentConfig,
  WorkerType,
  AgentPlan,
} from '@/types/multi-agent/ceo-agent';
import type { TaskResult, WorkerAgentType } from '@/types/multi-agent/worker-agents';
import type { SkillRef } from '@/types/multi-agent/skill';
import type { WorkerExecutor } from '@/services/multi-agent/types';
import { getSkillRetriever } from '../skill-store/SkillRetriever';
import { ContextAgent } from '../worker-agents/ContextAgent';
import { PlanningAgent } from '../worker-agents/PlanningAgent';
import { LLMDecomposer } from './LLMDecomposer';
import { RecoveryEngine } from './RecoveryEngine';

// Extended Goal with worker routing
interface AgentGoal extends Goal {
  workerType: WorkerType;
  agentName: string;
  dependsOn?: string[]; // goal IDs this depends on
}

/**
 * CEO Agent - Multi-agent orchestrator
 *
 * Architecture:
 * 1. Analyze requirement → determine what specialized agents are needed
 * 2. Decompose into sub-goals tagged with worker types
 * 3. Dispatch to specialized agents (ContextAgent/PlanningAgent/ExecutionAgent)
 * 4. Collect all agent outputs
 * 5. Synthesize final CEO summary
 */
export class CEOAgent {
  private config: Required<CEOAgentConfig>;
  private iteration: number = 0;
  private startTime: number = 0;
  private skillsUsed: Set<string> = new Set();
  private allAgentOutputs: Map<string, unknown> = new Map();
  private decomposer?: LLMDecomposer;
  private recoveryEngine?: RecoveryEngine;

  constructor(config: CEOAgentConfig = {}) {
    this.config = {
      maxIterations: config.maxIterations ?? 3,
      verificationThreshold: config.verificationThreshold ?? 0.8,
      autoSkillLoad: config.autoSkillLoad ?? true,
    };
  }

  /**
   * Process a user requirement end-to-end with multi-agent orchestration
   */
  async process(
    requirement: string,
    executor: WorkerExecutor,
    options?: {
      onGoalStart?: (goalId: string) => void;
      onGoalComplete?: (goalId: string, verified: boolean) => void;
      onTaskStart?: (taskId: string) => void;
      onTaskComplete?: (result: TaskResult) => void;
    }
  ): Promise<ExecutionReport> {
    this.startTime = Date.now();
    this.iteration = 0;
    this.skillsUsed = new Set();
    this.allAgentOutputs = new Map();

    // Step 1: Analyze requirement to determine needed agents
    const agentPlan = this.analyzeRequirement(requirement);
    console.log(`[CEO] Agent plan: ${agentPlan.workerTypes.join(', ')} — ${agentPlan.strategy}`);

    // Step 2: Decompose into typed sub-goals
    const goals = this.decomposeToAgentGoals(requirement, agentPlan);
    console.log(`[CEO] Decomposed into ${goals.length} specialized goals`);

    // Iteration loop
    const iterationSummaries: IterationSummary[] = [];
    const allTaskResults: TaskResult[] = [];

    while (this.iteration < this.config.maxIterations) {
      this.iteration++;
      console.log(`[CEO] Iteration ${this.iteration}/${this.config.maxIterations}`);

      // Step 2: Dispatch tasks for unverified goals
      const pendingGoals = goals.filter(g => !g.verified);
      if (pendingGoals.length === 0) {
        console.log('[CEO] All goals verified, completing');
        break;
      }

      // Step 3: Execute tasks with specialized agents
      const taskResults = await this.executeGoalsWithAgents(pendingGoals, executor, options);
      allTaskResults.push(...taskResults);

      // Step 4: Verify goals
      const verification = await this.verifyGoals(taskResults, goals);

      for (const gr of verification.goalResults) {
        if (gr.met) {
          gr.goal.verified = true;
        }
      }

      iterationSummaries.push({
        iteration: this.iteration,
        goalsProcessed: pendingGoals,
        tasksExecuted: taskResults,
        newTasksGenerated: [],
        verification,
      });

      if (verification.allGoalsMet) {
        console.log('[CEO] All goals met, iteration complete');
        break;
      }

      if (this.iteration >= this.config.maxIterations) {
        console.log('[CEO] Max iterations reached');
        break;
      }
    }

    // Step 5: Synthesize CEO summary from all agent outputs
    const ceoSummary = this.synthesizeResults(requirement, goals, allTaskResults);

    // Generate final report
    return this.generateReport(requirement, goals, iterationSummaries, allTaskResults, ceoSummary);
  }

  /**
   * 配置 LLM 分解器（混合模式）
   */
  setDecomposer(decomposer: LLMDecomposer): void {
    this.decomposer = decomposer;
  }

  /**
   * 使用混合分解器将需求分解为 AgentPlan，然后转换为 Goals 执行
   */
  async processWithDecomposer(
    requirement: string,
    executor: WorkerExecutor,
    options?: {
      onGoalStart?: (goalId: string) => void;
      onGoalComplete?: (goalId: string, verified: boolean) => void;
      onTaskStart?: (taskId: string) => void;
      onTaskComplete?: (result: TaskResult) => void;
    }
  ): Promise<ExecutionReport> {
    this.startTime = Date.now();
    this.iteration = 0;
    this.skillsUsed = new Set();
    this.allAgentOutputs = new Map();

    // Step 0: 初始化恢复引擎
    if (!this.recoveryEngine) {
      this.recoveryEngine = new RecoveryEngine();
    }

    // Step 1: 混合分解
    let agentPlan: AgentPlan;
    if (this.decomposer) {
      agentPlan = await this.decomposer.decompose(requirement);
    } else {
      const legacy = this.analyzeRequirement(requirement);
      agentPlan = this.legacyToAgentPlan(legacy);
    }
    console.log(`[CEO] Agent plan: ${agentPlan.agents.map(a => a.name).join(', ')} — ${agentPlan.strategy}`);

    // Step 2: 转换为内部 Goal 格式
    const goals = this.agentPlanToGoals(agentPlan);
    console.log(`[CEO] Decomposed into ${goals.length} goals`);

    // Step 3-5: 迭代执行
    const iterationSummaries: IterationSummary[] = [];
    const allTaskResults: TaskResult[] = [];

    while (this.iteration < this.config.maxIterations) {
      this.iteration++;
      const pendingGoals = goals.filter(g => !g.verified);
      if (pendingGoals.length === 0) break;

      const taskResults = await this.executeGoalsWithAgents(pendingGoals, executor, options);
      allTaskResults.push(...taskResults);

      // 智能恢复：检查失败的任务
      for (const result of taskResults) {
        if (!result.success && result.error) {
          const goal = goals.find(g => g.id === result.taskId);
          if (goal && this.recoveryEngine) {
            const category = this.recoveryEngine.diagnose(result.error, result.workerType as WorkerType);
            const action = this.recoveryEngine.recover(category, goal, agentPlan);
            console.log(`[CEO] Recovery: ${category} → ${action.type} for ${goal.id}`);

            if (action.type === 'retry') {
              goal.verified = false;
            } else if (action.type === 'split') {
              action.subTasks.forEach((sub, si) => {
                const parentGoal = goal as AgentGoal;
                goals.push({
                  id: `${goal.id}-r${si + 1}`,
                  description: sub,
                  verified: false,
                  verificationCriteria: goal.verificationCriteria,
                  workerType: parentGoal.workerType,
                  agentName: parentGoal.agentName,
                });
              });
            }
          }
        }
      }

      const verification = await this.verifyGoals(taskResults, goals);
      for (const gr of verification.goalResults) {
        if (gr.met) gr.goal.verified = true;
      }

      iterationSummaries.push({
        iteration: this.iteration,
        goalsProcessed: pendingGoals,
        tasksExecuted: taskResults,
        newTasksGenerated: [],
        verification,
      });

      if (verification.allGoalsMet) break;
      if (this.iteration >= this.config.maxIterations) break;
    }

    const ceoSummary = this.synthesizeResults(requirement, goals, allTaskResults);
    return this.generateReport(requirement, goals, iterationSummaries, allTaskResults, ceoSummary);
  }

  /** 将旧版 analyzeRequirement 结果转为 AgentPlan */
  private legacyToAgentPlan(analysis: ReturnType<CEOAgent['analyzeRequirement']>): AgentPlan {
    return {
      agents: analysis.workerTypes.map((wt, i) => ({
        id: `goal-${i + 1}`,
        type: wt,
        name: this.agentNameForType(wt),
        description: analysis.subGoals[i] ?? '',
        dependsOn: analysis.strategy === 'pipeline' && i > 0 ? [`goal-${i}`] : [],
        priority: i + 1,
        verificationCriteria: this.inferCriteria(analysis.subGoals[i] ?? ''),
      })),
      strategy: analysis.strategy,
      estimatedDuration: analysis.workerTypes.length * 1500,
    };
  }

  /** AgentPlan → Goal[] 转换 */
  private agentPlanToGoals(plan: AgentPlan): AgentGoal[] {
    return plan.agents.map(a => ({
      id: a.id,
      description: a.description,
      verified: false,
      verificationCriteria: a.verificationCriteria,
      workerType: a.type,
      agentName: a.name,
      dependsOn: a.dependsOn.length > 0 ? a.dependsOn : undefined,
    }));
  }

  /**
   * Analyze requirement to determine what specialized agents are needed
   */
  private analyzeRequirement(requirement: string): {
    workerTypes: WorkerType[];
    strategy: 'pipeline' | 'parallel';
    subGoals: string[];
  } {
    const lower = requirement.toLowerCase();
    const workerTypes: WorkerType[] = [];
    const subGoals: string[] = [];

    // Always start with context analysis
    if (lower.includes('项目') || lower.includes('project') ||
        lower.includes('代码') || lower.includes('code') ||
        lower.includes('文件') || lower.includes('file') ||
        lower.includes('分析') || lower.includes('analyze') ||
        lower.includes('了解') || lower.includes('understand')) {
      workerTypes.push('context');
      subGoals.push(`分析项目上下文：${requirement}`);
    }

    // Check if planning is needed
    if (lower.includes('设计') || lower.includes('design') ||
        lower.includes('架构') || lower.includes('architect') ||
        lower.includes('方案') || lower.includes('plan') ||
        lower.includes('实现') || lower.includes('implement') ||
        lower.includes('新增') || lower.includes('add') ||
        lower.includes('构建') || lower.includes('build') ||
        lower.includes('重构') || lower.includes('refactor')) {
      workerTypes.push('planning');
      subGoals.push(`设计方案：${requirement}`);
    }

    // Check if execution is needed
    if (lower.includes('实现') || lower.includes('implement') ||
        lower.includes('写') || lower.includes('write') ||
        lower.includes('修复') || lower.includes('fix') ||
        lower.includes('构建') || lower.includes('build') ||
        lower.includes('重构') || lower.includes('refactor') ||
        lower.includes('优化') || lower.includes('optimize')) {
      workerTypes.push('execution');
      subGoals.push(`执行实现：${requirement}`);
    }

    // Default: always include execution for actionable requests
    if (workerTypes.length === 0) {
      workerTypes.push('context', 'execution');
      subGoals.push(`分析：${requirement}`, `执行：${requirement}`);
    }

    // Determine strategy: pipeline if dependencies exist, parallel otherwise
    const strategy: 'pipeline' | 'parallel' =
      workerTypes.includes('context') && workerTypes.includes('planning')
        ? 'pipeline' : 'parallel';

    return { workerTypes, strategy, subGoals };
  }

  /**
   * Decompose requirement into agent-typed sub-goals
   */
  private decomposeToAgentGoals(
    _requirement: string,
    agentPlan: ReturnType<CEOAgent['analyzeRequirement']>
  ): AgentGoal[] {
    const goals: AgentGoal[] = [];

    for (let i = 0; i < agentPlan.subGoals.length; i++) {
      const workerType = agentPlan.workerTypes[i] ?? agentPlan.workerTypes[agentPlan.workerTypes.length - 1];
      const agentName = this.agentNameForType(workerType);

      const goal: AgentGoal = {
        id: `goal-${i + 1}`,
        description: agentPlan.subGoals[i],
        verified: false,
        verificationCriteria: this.inferCriteria(agentPlan.subGoals[i]),
        workerType,
        agentName,
      };

      // Pipeline: set dependencies between sequential agents
      if (agentPlan.strategy === 'pipeline' && i > 0) {
        goal.dependsOn = [`goal-${i}`]; // depends on previous goal
      }

      goals.push(goal);
    }

    return goals;
  }

  /**
   * Execute goals using specialized worker agents
   */
  private async executeGoalsWithAgents(
    goals: AgentGoal[],
    executor: WorkerExecutor,
    options?: {
      onGoalStart?: (goalId: string) => void;
      onGoalComplete?: (goalId: string, verified: boolean) => void;
      onTaskStart?: (taskId: string) => void;
      onTaskComplete?: (result: TaskResult) => void;
    }
  ): Promise<TaskResult[]> {
    const results: TaskResult[] = [];

    let relevantSkills: SkillRef[] = [];
    if (this.config.autoSkillLoad) {
      const retriever = getSkillRetriever();
      relevantSkills = await retriever.retrieveForDispatch(
        goals.map(g => g.description).join(' ')
      );
      relevantSkills.forEach(s => this.skillsUsed.add(s.id));
    }

    const executions = goals.map(async goal => {
      const agentTypeLabel = `${goal.agentName}`;
      console.log(`[CEO] Dispatching ${agentTypeLabel} for: ${goal.description}`);

      options?.onTaskStart?.(goal.id);

      // Inject DAG node with agent type info
      await this.injectDAGNode('query_start', goal, undefined);

      const taskContext = {
        taskId: goal.id,
        description: goal.description,
        workspaceId: '',
        context: {
          criteria: goal.verificationCriteria,
          workerType: goal.workerType,
          agentName: goal.agentName,
        },
      };

      try {
        // Execute using specialized agent + executor
        const result = await this.executeWithAgent(goal, taskContext, executor, relevantSkills);
        this.allAgentOutputs.set(goal.id, result.output);
        options?.onTaskComplete?.(result);

        // Inject DAG result with agent type
        await this.injectDAGNode('result', goal, result);

        return result;
      } catch (error) {
        const errorResult: TaskResult = {
          taskId: goal.id,
          workerType: goal.workerType as WorkerAgentType,
          output: null,
          success: false,
          duration: 0,
          skillsUsed: [],
          subTasks: [],
          error: error instanceof Error ? error.message : String(error),
        };
        options?.onTaskComplete?.(errorResult);
        return errorResult;
      }
    });

    const settled = await Promise.allSettled(executions);
    settled.forEach(r => {
      if (r.status === 'fulfilled') results.push(r.value);
    });

    return results;
  }

  /**
   * Execute a goal with the appropriate specialized agent
   */
  private async executeWithAgent(
    goal: AgentGoal,
    taskContext: { taskId: string; description: string; workspaceId: string; context: Record<string, unknown> },
    executor: WorkerExecutor,
    skills: SkillRef[]
  ): Promise<TaskResult> {
    // Create the specialized agent
    let agentOutput: unknown;

    switch (goal.workerType) {
      case 'context': {
        const contextAgent = new ContextAgent();
        const contextResult = await contextAgent.execute(taskContext as unknown as import('@/types/multi-agent/worker-agents').WorkerContext);
        agentOutput = {
          agentType: 'context',
          agentName: 'ContextAgent',
          ...(contextResult.output as Record<string, unknown> ?? {}),
        };
        break;
      }
      case 'planning': {
        const planningAgent = new PlanningAgent();
        const planResult = await planningAgent.execute(taskContext as unknown as import('@/types/multi-agent/worker-agents').WorkerContext);
        agentOutput = {
          agentType: 'planning',
          agentName: 'PlanningAgent',
          ...(planResult.output as Record<string, unknown> ?? {}),
        };
        break;
      }
      case 'execution': {
        // Execution goes through the real executor (CLI/WS in prod, simulated in dev)
        const execResult = await executor.execute(taskContext, skills);
        agentOutput = {
          agentType: 'execution',
          agentName: 'ExecutionAgent',
          output: execResult.output,
          success: execResult.success,
        };
        break;
      }
      default: {
        // Fallback to generic executor
        const result = await executor.execute(taskContext, skills);
        agentOutput = result.output;
      }
    }

    const isSuccess = goal.workerType === 'execution'
      ? (agentOutput as { success?: boolean }).success !== false
      : true;

    return {
      taskId: goal.id,
      workerType: goal.workerType as WorkerAgentType,
      output: agentOutput,
      success: isSuccess,
      duration: 500,
      skillsUsed: skills.map(s => s.id) as unknown as import('@/types/multi-agent/skill').SkillRef[],
      subTasks: [],
    };
  }

  /**
   * Synthesize all agent outputs into a CEO summary
   */
  private synthesizeResults(
    requirement: string,
    goals: AgentGoal[],
    allResults: TaskResult[]
  ): string {
    const parts: string[] = [];
    parts.push(`## CEO 执行总结\n`);
    parts.push(`**原始需求**：${requirement}\n`);

    // Summarize each agent's contribution
    for (const goal of goals) {
      const result = allResults.find(r => r.taskId === goal.id);
      const icon = result?.success ? '✅' : '❌';
      parts.push(`### ${icon} ${goal.agentName}：${goal.description}`);
      if (result?.output) {
        parts.push(this.formatAgentOutput(result.output));
      }
      if (result?.error) {
        parts.push(`> ⚠️ 错误：${result.error}`);
      }
      parts.push('');
    }

    // CEO final assessment
    const successCount = allResults.filter(r => r.success).length;
    parts.push(`---`);
    parts.push(`### 📊 执行统计`);
    parts.push(`- 总Agent数：${goals.length}`);
    parts.push(`- 成功：${successCount}`);
    parts.push(`- 失败：${allResults.length - successCount}`);
    parts.push(`- Agent类型：${goals.map(g => g.agentName).join(' → ')}`);
    parts.push(`- 执行策略：${goals[0]?.dependsOn ? '流水线（pipeline）' : '并行（parallel）'}`);
    parts.push(`- 耗时：${Date.now() - this.startTime}ms`);

    return parts.join('\n');
  }

  /**
   * Format agent output for display
   */
  private formatAgentOutput(output: unknown): string {
    if (!output) return '';
    if (typeof output === 'string') return output;
    try {
      const obj = output as Record<string, unknown>;
      const lines: string[] = [];
      if (obj.summary) lines.push(`**摘要**：${obj.summary}`);
      if (obj.successRate !== undefined) lines.push(`**成功率**：${Number(obj.successRate) * 100}%`);
      if (obj.filesAnalyzed !== undefined) lines.push(`**分析文件数**：${obj.filesAnalyzed}`);
      if (obj.approved !== undefined) lines.push(`**审批**：${obj.approved ? '通过' : '未通过'}`);
      return lines.join('\n') || JSON.stringify(obj).slice(0, 200);
    } catch {
      return String(output).slice(0, 200);
    }
  }

  /**
   * Inject DAG node — 直接写入 useTaskStore，创建 agent_group 类型节点
   */
  private async injectDAGNode(
    eventType: 'query_start' | 'result',
    goal: AgentGoal,
    result: TaskResult | undefined
  ): Promise<void> {
    try {
      const { useTaskStore } = await import('@/stores/useTaskStore');
      const nodeId = `agent-${goal.id}`;

      if (eventType === 'query_start') {
        // 直接往 store.nodes 中插入 agent_group 类型节点
        const currentNodes = new Map(useTaskStore.getState().nodes);
        const newNode: import('@/types/events').DAGNode = {
          id: nodeId,
          type: 'agent_group',
          label: goal.agentName,
          status: 'running',
          parentId: 'main-agent',
          agentName: goal.agentName,
          childCount: 0,
          collapsed: false,
          taskDescription: goal.description,
          workspaceId: '',
          startTime: Date.now(),
        };
        currentNodes.set(nodeId, newNode);
        useTaskStore.setState({ nodes: currentNodes });
      } else if (result) {
        // 更新 agent_group 节点状态
        const currentNodes = new Map(useTaskStore.getState().nodes);
        const existing = currentNodes.get(nodeId);
        if (existing) {
          currentNodes.set(nodeId, {
            ...existing,
            status: result.success ? 'completed' : 'failed',
            endTime: Date.now(),
            toolMessage: result.error?.slice(0, 100),
            childCount: result.subTasks?.length ?? 0,
          });
          useTaskStore.setState({ nodes: currentNodes });
        }
      }
    } catch { /* 非浏览器环境，静默忽略 */ }
  }

  private agentNameForType(type: WorkerType): string {
    switch (type) {
      case 'context': return 'ContextAgent';
      case 'planning': return 'PlanningAgent';
      case 'execution': return 'ExecutionAgent';
      case 'review': return 'ReviewAgent';
      default: return 'WorkerAgent';
    }
  }

  private inferCriteria(goalDescription: string): string[] {
    const criteria: string[] = [];
    const lower = goalDescription.toLowerCase();
    if (lower.includes('优化') || lower.includes('performance')) criteria.push('performance_metrics_improved');
    if (lower.includes('修复') || lower.includes('fix') || lower.includes('bug')) criteria.push('issue_resolved');
    if (lower.includes('重构') || lower.includes('refactor')) criteria.push('code_review_approved');
    if (lower.includes('测试') || lower.includes('test')) criteria.push('tests_pass');
    if (lower.includes('文档') || lower.includes('doc')) criteria.push('documentation_complete');
    if (criteria.length === 0) criteria.push('task_completed');
    return criteria;
  }

  private async verifyGoals(
    taskResults: TaskResult[],
    goals: Goal[]
  ): Promise<VerificationResult> {
    const goalResults = goals.map(goal => {
      const relatedResults = taskResults.filter(r =>
        JSON.stringify(r).includes(goal.id)
      );
      const criteriaMet = goal.verificationCriteria.every(() =>
        relatedResults.some(r => r.success)
      );
      return {
        goal,
        met: criteriaMet || relatedResults.some(r => r.success),
        evidence: criteriaMet
          ? 'All verification criteria met'
          : 'Partial completion - some criteria not met',
        taskResults: relatedResults,
      };
    });

    const allGoalsMet = goalResults.every(g => g.met);
    const metRatio = goalResults.filter(g => g.met).length / goalResults.length;

    return {
      allGoalsMet: allGoalsMet || metRatio >= this.config.verificationThreshold,
      goalResults,
      missedGoals: goalResults.filter(g => !g.met).map(g => g.goal),
      reasoning: allGoalsMet
        ? 'All goals verified successfully'
        : `${goalResults.filter(g => g.met).length}/${goalResults.length} goals met`,
    };
  }

  private generateReport(
    requirement: string,
    goals: Goal[],
    iterations: IterationSummary[],
    taskResults: TaskResult[],
    ceoSummary?: string
  ): ExecutionReport {
    const completedGoals = goals.filter(g => g.verified);
    const missedGoals = goals.filter(g => !g.verified);
    const partialCompletion =
      iterations.length >= this.config.maxIterations && missedGoals.length > 0;

    const summary = ceoSummary
      || (partialCompletion
        ? `Partial completion: ${completedGoals.length}/${goals.length} goals`
        : `Completed: ${goals.length} goals verified in ${iterations.length} iteration(s)`);

    return {
      summary,
      originalRequirement: requirement,
      completedGoals,
      missedGoals,
      iterations,
      totalIterations: this.iteration,
      skillsUsed: Array.from(this.skillsUsed),
      totalDuration: Date.now() - this.startTime,
      taskResults,
      partialCompletion,
      timestamp: Date.now(),
    };
  }
}

// Singleton
let ceoAgentInstance: CEOAgent | null = null;

export function getCEOAgent(config?: CEOAgentConfig): CEOAgent {
  if (!ceoAgentInstance) {
    ceoAgentInstance = new CEOAgent(config);
  }
  return ceoAgentInstance;
}

export function resetCEOAgent(): void {
  ceoAgentInstance = null;
}
