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
import type { FlowDefinition, FlowAgent } from '@/types/multi-agent/flow-definition';
import { getSkillRetriever } from '../skill-store/SkillRetriever';
import { ContextAgent } from '../worker-agents/ContextAgent';
import { PlanningAgent } from '../worker-agents/PlanningAgent';
import { LLMDecomposer } from './LLMDecomposer';
import { RecoveryEngine } from './RecoveryEngine';
import { getProblemDetector } from '../problem-detector/ProblemDetector';

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
  /** 当前工作区 ID（由调用方通过 setWorkspace() 注入） */
  private workspaceId: string = '';
  /** 当前工作区路径（项目根目录） */
  private workspacePath: string = '';
  /** 编排模式下的预定义 Flow 拓扑 */
  private orchestrationFlow: FlowDefinition | null = null;

  constructor(config: CEOAgentConfig = {}) {
    this.config = {
      maxIterations: config.maxIterations ?? 3,
      verificationThreshold: config.verificationThreshold ?? 0.8,
      autoSkillLoad: config.autoSkillLoad ?? true,
    };
  }

  /**
   * 设置当前工作区信息。
   * 调用方（GlobalTerminal / TerminalView）应在创建 CEOAgent 后立即调用此方法，
   * 以便 ContextAgent 和 PlanningAgent 获取项目路径等上下文。
   */
  setWorkspace(id: string, path: string): void {
    this.workspaceId = id;
    this.workspacePath = path;
  }

  /** 设置编排拓扑（编排画布 → CEOAgent 桥接） */
  setOrchestrationFlow(flow: FlowDefinition): void {
    this.orchestrationFlow = flow;
  }

  /** 当前是否有编排配置 */
  hasOrchestrationFlow(): boolean {
    return this.orchestrationFlow !== null;
  }

  /** 清除编排配置（回到独立模式） */
  clearOrchestrationFlow(): void {
    this.orchestrationFlow = null;
  }

  /**
   * Process a user requirement end-to-end with multi-agent orchestration
   */
  /**
   * @deprecated 使用 processWithDecomposer() 代替。该方法内部委托给 processWithDecomposer()。
   * 当无 LLMDecomposer 时，processWithDecomposer 自动降级为 analyzeRequirement() 规则引擎。
   * 保留此方法仅供旧测试使用。
   */
  async process(
    requirement: string,
    executor: WorkerExecutor,
    options?: {
      onTaskStart?: (taskId: string) => void;
      onTaskComplete?: (result: TaskResult) => void;
    }
  ): Promise<ExecutionReport> {
    console.warn('[CEO] process() is deprecated, delegating to processWithDecomposer()');
    // 清除 decomposer 使 processWithDecomposer 使用 analyzeRequirement 规则引擎
    const savedDecomposer = this.decomposer;
    this.decomposer = undefined;
    try {
      return await this.processWithDecomposer(requirement, executor, options);
    } finally {
      this.decomposer = savedDecomposer;
    }
  }

  /**
   * 配置 LLM 分解器（混合模式）
   */
  setDecomposer(decomposer: LLMDecomposer): void {
    this.decomposer = decomposer;
  }

  /**
   * 编排模式执行入口 — 使用预定义的 FlowDefinition 拓扑
   * 不经过 LLMDecomposer，直接按编排画布配置的 agents + mode 执行
   */
  async executeWithOrchestration(
    requirement: string,
    executor: WorkerExecutor,
    options?: {
      onTaskStart?: (taskId: string) => void;
      onTaskComplete?: (result: TaskResult) => void;
    }
  ): Promise<ExecutionReport> {
    const flow = this.orchestrationFlow!;
    this.startTime = Date.now();
    this.iteration = 0;
    this.skillsUsed = new Set();
    this.allAgentOutputs = new Map();

    if (!this.recoveryEngine) {
      this.recoveryEngine = new RecoveryEngine();
    }

    // Step 1: 注入编排拓扑节点到 DAG (source: 'orchestration')
    for (const agent of flow.agents) {
      await this.injectOrchestrationNode(agent);
    }

    // Step 2: 将 FlowAgent 转换为 AgentGoal
    const goals: AgentGoal[] = flow.agents.map(a => ({
      id: a.id,
      description: a.taskDescription,
      verified: false,
      verificationCriteria: this.inferCriteria(a.taskDescription),
      workerType: a.agentType,
      agentName: a.name,
      dependsOn: a.dependencies.length > 0 ? a.dependencies : undefined,
    }));

    console.log(`[CEO] 编排模式执行: ${goals.length} agents, mode=${flow.mode}`);

    // Step 3: 按 flow.mode 执行
    let taskResults: TaskResult[];

    switch (flow.mode) {
      case 'sequential':
        taskResults = await this.executeSequentialOrchestration(goals, executor, options);
        break;
      case 'parallel':
        taskResults = await this.executeParallelOrchestration(goals, executor, options);
        break;
      case 'pipeline':
        taskResults = await this.executePipelineOrchestration(goals, executor, options);
        break;
      case 'coordinator':
        taskResults = await this.executeCoordinatorOrchestration(goals, executor, options);
        break;
      case 'reviewer':
        taskResults = await this.executeReviewerOrchestration(goals, executor, options);
        break;
      default:
        taskResults = await this.executeParallelOrchestration(goals, executor, options);
    }

    // Step 4: 验证与总结
    this.iteration = 1;
    const verification = await this.verifyGoals(taskResults, goals);
    for (const gr of verification.goalResults) {
      if (gr.met) gr.goal.verified = true;
    }

    const ceoSummary = this.synthesizeResults(requirement, goals, taskResults);
    await this.injectSummaryNode(ceoSummary);

    return this.generateReport(
      requirement, goals,
      [{ iteration: 1, goalsProcessed: goals, tasksExecuted: taskResults, newTasksGenerated: [], verification }],
      taskResults, ceoSummary
    );
  }

  // ── 编排模式执行策略 ──────────────────────────────────────

  /** 顺序执行：一个接一个 */
  private async executeSequentialOrchestration(
    goals: AgentGoal[],
    executor: WorkerExecutor,
    options?: Parameters<CEOAgent['executeWithOrchestration']>[2]
  ): Promise<TaskResult[]> {
    const results: TaskResult[] = [];
    for (const goal of goals) {
      const result = await this.executeOrchestrationGoal(goal, executor, options);
      results.push(result);
    }
    return results;
  }

  /** 并行执行：全部同时启动 */
  private async executeParallelOrchestration(
    goals: AgentGoal[],
    executor: WorkerExecutor,
    options?: Parameters<CEOAgent['executeWithOrchestration']>[2]
  ): Promise<TaskResult[]> {
    const settled = await Promise.allSettled(
      goals.map(g => this.executeOrchestrationGoal(g, executor, options))
    );
    return settled.map(r => r.status === 'fulfilled' ? r.value : {
      taskId: 'unknown', workerType: 'execution' as WorkerAgentType,
      output: null, success: false, duration: 0, skillsUsed: [], subTasks: [],
      error: r.status === 'rejected' ? String(r.reason) : 'Unknown error',
    });
  }

  /** 流水线：前一个输出作为后一个输入上下文 */
  private async executePipelineOrchestration(
    goals: AgentGoal[],
    executor: WorkerExecutor,
    options?: Parameters<CEOAgent['executeWithOrchestration']>[2]
  ): Promise<TaskResult[]> {
    const results: TaskResult[] = [];
    for (const goal of goals) {
      // 将之前所有 agent 输出注入依赖上下文
      goal.dependsOn = results.length > 0
        ? [results[results.length - 1].taskId]
        : goal.dependsOn;
      const result = await this.executeOrchestrationGoal(goal, executor, options);
      results.push(result);
    }
    return results;
  }

  /** 协调者模式：planning 先执行，再并行 execution */
  private async executeCoordinatorOrchestration(
    goals: AgentGoal[],
    executor: WorkerExecutor,
    options?: Parameters<CEOAgent['executeWithOrchestration']>[2]
  ): Promise<TaskResult[]> {
    const coordinator = goals.find(g => g.workerType === 'planning');
    const workers = goals.filter(g => g.workerType === 'execution');

    if (!coordinator || workers.length === 0) {
      return this.executeSequentialOrchestration(goals, executor, options);
    }

    // Coordinator 先执行
    const coordinatorResult = await this.executeOrchestrationGoal(coordinator, executor, options);
    const results: TaskResult[] = [coordinatorResult];

    // Workers 并行执行
    const settled = await Promise.allSettled(
      workers.map(g => this.executeOrchestrationGoal(g, executor, options))
    );
    for (const r of settled) {
      results.push(r.status === 'fulfilled' ? r.value : {
        taskId: 'unknown', workerType: 'execution' as WorkerAgentType,
        output: null, success: false, duration: 0, skillsUsed: [], subTasks: [],
        error: r.status === 'rejected' ? String(r.reason) : 'Unknown error',
      });
    }

    return results;
  }

  /** 审查模式：execution 先执行，再 review 审查 */
  private async executeReviewerOrchestration(
    goals: AgentGoal[],
    executor: WorkerExecutor,
    options?: Parameters<CEOAgent['executeWithOrchestration']>[2]
  ): Promise<TaskResult[]> {
    const workers = goals.filter(g => g.workerType === 'execution');
    const reviewer = goals.find(g => g.workerType === 'review');

    if (!reviewer || workers.length === 0) {
      return this.executeSequentialOrchestration(goals, executor, options);
    }

    // Workers 先执行
    const workerResults = await this.executeParallelOrchestration(workers, executor, options);

    // Reviewer 审查（将所有 worker 输出注入上下文）
    reviewer.dependsOn = workerResults.map(r => r.taskId);
    const reviewResult = await this.executeOrchestrationGoal(reviewer, executor, options);

    return [...workerResults, reviewResult];
  }

  /** 执行单个编排 Goal（不直接注入 DAG 节点，由 WebSocket 事件系统处理） */
  private async executeOrchestrationGoal(
    goal: AgentGoal,
    executor: WorkerExecutor,
    options?: Parameters<CEOAgent['executeWithOrchestration']>[2]
  ): Promise<TaskResult> {
    options?.onTaskStart?.(goal.id);

    // DAG agent_group 节点由 WebSocket 事件系统（agent_start/agent_end）统一创建

    const taskContext = {
      taskId: goal.id,
      description: goal.description,
      workspaceId: this.workspaceId,
      workspacePath: this.workspacePath,
      context: {
        criteria: goal.verificationCriteria,
        workerType: goal.workerType,
        agentName: goal.agentName,
        dependencyOutputs: (goal.dependsOn ?? [])
          .filter(depId => this.allAgentOutputs.has(depId))
          .map(depId => ({ goalId: depId, output: this.allAgentOutputs.get(depId) })),
      },
    };

    try {
      const result = await this.executeWithAgent(goal, taskContext, executor, []);
      this.allAgentOutputs.set(goal.id, result.output);
      options?.onTaskComplete?.(result);

      // DAG 节点状态由 WebSocket 事件系统（agent_end）统一更新
      return result;
    } catch (error) {
      const errorResult: TaskResult = {
        taskId: goal.id,
        workerType: goal.workerType as WorkerAgentType,
        output: null, success: false, duration: 0, skillsUsed: [], subTasks: [],
        error: error instanceof Error ? error.message : String(error),
      };
      options?.onTaskComplete?.(errorResult);
      return errorResult;
    }
  }

  /** 注入编排拓扑节点到 DAG (source: 'orchestration') */
  private async injectOrchestrationNode(agent: FlowAgent): Promise<void> {
    try {
      const { useTaskStore } = await import('@/stores/useTaskStore');
      const nodeId = `orch-${agent.id}`;
      const currentNodes = new Map(useTaskStore.getState().nodes);
      const newNode: import('@/types/events').DAGNode = {
        id: nodeId,
        type: 'agent_group',
        label: agent.name,
        status: 'pending',
        parentId: 'main-agent',
        source: 'orchestration',
        agentName: agent.name,
        taskDescription: agent.taskDescription,
        workspaceId: this.workspaceId,
      };
      currentNodes.set(nodeId, newNode);
      useTaskStore.setState({ nodes: currentNodes });
    } catch { /* 非浏览器环境，静默忽略 */ }
  }

  /**
   * 使用混合分解器将需求分解为 AgentPlan，然后转换为 Goals 执行。
   *
   * @param requirement 用户原始需求
   * @param executor WorkerExecutor 实例
   * @param options 回调 + 可选的预计算 plan
   *   - options.plan: 如果调用方已经完成分解（如在 UI 层展示 plan），传入以避免二次 LLM 调用
   */
  async processWithDecomposer(
    requirement: string,
    executor: WorkerExecutor,
    options?: {
      onTaskStart?: (taskId: string) => void;
      onTaskComplete?: (result: TaskResult) => void;
      /** 预计算的 AgentPlan — 传入后跳过内部 decompose() 步骤 */
      plan?: AgentPlan;
    }
  ): Promise<ExecutionReport> {
    // 编排模式：有预定义 Flow 时走 executeWithOrchestration
    if (this.hasOrchestrationFlow()) {
      return this.executeWithOrchestration(requirement, executor, options);
    }

    this.startTime = Date.now();
    this.iteration = 0;
    this.skillsUsed = new Set();
    this.allAgentOutputs = new Map();

    // Step 0: 初始化恢复引擎
    if (!this.recoveryEngine) {
      this.recoveryEngine = new RecoveryEngine();
    }

    // Step 1: 混合分解（优先使用调用方传入的预计算 plan）
    let agentPlan: AgentPlan;
    const decompositionSource: string[] = [];
    if (options?.plan) {
      agentPlan = options.plan;
      decompositionSource.push('precomputed');
      console.log(`[CEO] Using precomputed plan: ${agentPlan.agents.map(a => a.name).join(', ')} — ${agentPlan.strategy}`);
    } else if (this.decomposer) {
      agentPlan = await this.decomposer.decompose(requirement);
      // 检测分解来源（LLM vs 规则引擎）
      const isLLM = agentPlan.agents.some(a => (a as unknown as Record<string, unknown>)._llmDecomposed);
      decompositionSource.push(isLLM ? 'llm' : 'rules');
      console.log(`[CEO] Agent plan (${decompositionSource.join(',')}): ${agentPlan.agents.map(a => a.name).join(', ')} — ${agentPlan.strategy}`);
    } else {
      const legacy = this.analyzeRequirement(requirement);
      agentPlan = this.legacyToAgentPlan(legacy);
      decompositionSource.push('legacy');
      console.log(`[CEO] Agent plan (legacy): ${agentPlan.agents.map(a => a.name).join(', ')} — ${agentPlan.strategy}`);
    }

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

            // 注入恢复 DAG 节点
            await this.injectRecoveryNode(goal.id, action.type, result.error);

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
            } else if (action.type === 'fail') {
              goal.verified = true; // 标记为已处理（不再重试）
              console.warn(`[CEO] Recovery failed for ${goal.id}, marking as done`);
            }
            // 'skip' 类型静默跳过（goal 保持 verified: false，下一轮迭代重试）
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

    // Inject CEO Summary node into DAG
    await this.injectSummaryNode(ceoSummary);

    // ── 自进化闭环：自动触发 ─────────────────────────────
    await this.triggerEvolutionPipeline(requirement, goals, allTaskResults);

    return this.generateReport(requirement, goals, iterationSummaries, allTaskResults, ceoSummary);
  }

  /**
   * 自进化闭环：自动记录轨迹 → 触发进化循环 → 注册候选技能
   */
  private async triggerEvolutionPipeline(
    _requirement: string,
    _goals: AgentGoal[],
    allTaskResults: TaskResult[]
  ): Promise<void> {
    try {
      const { runCycle, recordExecution, getPendingTraces } = await import('@/services/evolutionLoop');

      // 1. 记录每条执行轨迹
      for (const result of allTaskResults) {
        recordExecution({
          workspaceId: '',
          taskDescription: result.taskId,
          toolsUsed: [],
          isSuccess: result.success,
          errorMessage: result.error,
          tokenCount: 0,
          durationMs: result.duration,
        });
      }

      // 2. 检查轨迹是否足够触发进化
      const pendingCount = getPendingTraces().length;

      if (pendingCount >= 5) {
        const cycleResult = await runCycle('');

        // 3. 注册高置信度候选技能到 SkillStore
        if (cycleResult.candidatesRefined > 0) {
          try {
            const { getSkillStore } = await import('../skill-store/SkillStore');
            const store = getSkillStore();
            const { getCandidateSkills } = await import('@/services/evolutionLoop');
            const candidates = getCandidateSkills();
            for (const candidate of candidates) {
              if ((candidate.confidence ?? 0) > 0.5) {
                store.register({
                  name: candidate.name,
                  domain: 'general' as import('@/types/multi-agent/skill').SkillDomain,
                  trigger: { keywords: [], contextPatterns: [] },
                  summary: candidate.description.slice(0, 200),
                  stepsHint: [],
                  detail: {
                    id: `detail-${Date.now()}`,
                    steps: [],
                    examples: [],
                    verification: { method: 'manual', expectedOutcome: '' },
                  },
                });
              }
            }
          } catch { /* 注册失败静默忽略 */ }

          // 4. 注入进化 DAG 节点
          await this.injectEvolutionNode(
            cycleResult.phase,
            cycleResult.candidatesRefined
          );
        }
      }
    } catch {
      // evolutionLoop 或 SkillStore 不可用时静默跳过
      console.warn('[CEO] Self-evolution pipeline skipped (module not available in this environment)');
    }
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
   * Execute goals using specialized worker agents
   * Respects dependsOn: topological sort + layer-by-layer parallel execution
   */
  private async executeGoalsWithAgents(
    goals: AgentGoal[],
    executor: WorkerExecutor,
    options?: {
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

    // Topological sort: compute execution layers based on dependsOn
    const completedGoalIds = new Set<string>();

    const executeGoal = async (goal: AgentGoal): Promise<TaskResult> => {
      const agentTypeLabel = `${goal.agentName}`;
      console.log(`[CEO] Dispatching ${agentTypeLabel} for: ${goal.description}`);

      options?.onTaskStart?.(goal.id);

      // DAG agent_group 节点由 WebSocket 事件系统（agent_start/agent_end）统一创建
      // 此处不再重复注入，避免双重节点导致 DAGCanvas 渲染崩溃

      // Inject skill nodes for loaded skills
      for (const skill of relevantSkills) {
        await this.injectSkillNode(goal.id, skill.name, skill.domain ?? 'general', undefined);
      }

      const taskContext = {
        taskId: goal.id,
        description: goal.description,
        workspaceId: this.workspaceId,
        workspacePath: this.workspacePath,
        context: {
          criteria: goal.verificationCriteria,
          workerType: goal.workerType,
          agentName: goal.agentName,
          // Pass outputs from dependency goals into context
          dependencyOutputs: (goal.dependsOn ?? [])
            .filter(depId => this.allAgentOutputs.has(depId))
            .map(depId => ({ goalId: depId, output: this.allAgentOutputs.get(depId) })),
        },
      };

      try {
        // Execute using specialized agent + executor
        const result = await this.executeWithAgent(goal, taskContext, executor, relevantSkills);
        this.allAgentOutputs.set(goal.id, result.output);
        options?.onTaskComplete?.(result);

        // DAG 节点状态由 WebSocket 事件系统（agent_end）统一更新
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
    };

    // Execute in dependency layers: no-dependency goals first (parallel),
    // then goals whose dependencies are all completed, repeat until all done
    const remaining = new Set(goals.map(g => g.id));
    while (remaining.size > 0) {
      // Find goals whose dependencies are all satisfied
      const readyGoals = goals.filter(g =>
        remaining.has(g.id) &&
        (g.dependsOn ?? []).every(depId => completedGoalIds.has(depId))
      );

      if (readyGoals.length === 0) {
        // Circular dependency or stale refs — execute remaining to avoid infinite loop
        console.warn('[CEO] Unresolvable dependencies, executing remaining goals');
        const stuckGoals = goals.filter(g => remaining.has(g.id));
        const settled = await Promise.allSettled(stuckGoals.map(executeGoal));
        settled.forEach(r => {
          if (r.status === 'fulfilled') results.push(r.value);
        });
        break;
      }

      // Execute all ready goals in parallel
      const settled = await Promise.allSettled(readyGoals.map(executeGoal));
      for (const r of settled) {
        if (r.status === 'fulfilled') {
          results.push(r.value);
          completedGoalIds.add(r.value.taskId);
          remaining.delete(r.value.taskId);
        }
      }
    }

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
    // Step 0: ProblemDetector 开始追踪
    getProblemDetector().startTracking(taskContext.taskId);

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

    // Step N: ProblemDetector — 追踪工具调用并获取状态
    const pDetector = getProblemDetector();
    // 根据 agent 输出模拟工具调用追踪（WorkerAgent 内部的 trackToolCall 未桥接到 ProblemDetector）
    if (agentOutput && typeof agentOutput === 'object') {
      const out = agentOutput as Record<string, unknown>;
      // PlanningAgent: track spec/design generation steps
      if (out.specDocument) pDetector.trackToolCall(taskContext.taskId, 'generateSpec', {});
      if (out.designDocument) pDetector.trackToolCall(taskContext.taskId, 'generateDesign', {});
      if (out.reviewResult) pDetector.trackToolCall(taskContext.taskId, 'reviewPlan', {});
      // ExecutionAgent: track sub-tasks
      if (Array.isArray(out.subTaskResults)) {
        for (const st of out.subTaskResults) {
          pDetector.trackToolCall(taskContext.taskId, 'executeSubTask', { task: (st as Record<string, unknown>).task });
        }
      }
      // ContextAgent: track file analysis
      if (out.filesAnalyzed !== undefined) {
        pDetector.trackToolCall(taskContext.taskId, 'analyzeFiles', { count: out.filesAnalyzed });
      }
    }
    pDetector.stopTracking(taskContext.taskId);
    const problemStatus = pDetector.getStatus(taskContext.taskId);

    // 注入 DAG 节点进度（困难问题标记）
    if (problemStatus.isHardProblem) {
      await this.injectDAGProblemStatus(goal.id, problemStatus);
    }

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

    // ── CEO 最终自然语言总结 ─────────────────────────
    const successCount = allResults.filter(r => r.success).length;
    const failedCount = allResults.length - successCount;
    const strategy = goals[0]?.dependsOn ? '流水线' : '并行';
    const elapsed = Date.now() - this.startTime;

    parts.push(`---`);
    parts.push(`### 📊 执行统计`);
    parts.push(`- 总Agent数：${goals.length}`);
    parts.push(`- 成功：${successCount}`);
    parts.push(`- 失败：${failedCount}`);
    parts.push(`- Agent类型：${goals.map(g => g.agentName).join(' → ')}`);
    parts.push(`- 执行策略：${strategy}`);
    parts.push(`- 耗时：${elapsed}ms`);

    // 自然语言总结段落
    parts.push('');
    parts.push(`### 🧠 CEO 总结`);
    const agentNames = goals.map(g => g.agentName).join('、');
    const naturalSummary = this.buildNaturalSummary(
      requirement, goals, allResults, agentNames,
      successCount, failedCount, strategy, elapsed
    );
    parts.push(naturalSummary);

    return parts.join('\n');
  }

  /**
   * Build a natural language summary of the entire execution.
   */
  private buildNaturalSummary(
    requirement: string,
    goals: AgentGoal[],
    allResults: TaskResult[],
    agentNames: string,
    successCount: number,
    _failedCount: number,
    strategy: string,
    elapsed: number
  ): string {
    const firstWord = requirement.slice(0, Math.min(20, requirement.length));
    const elapsedStr = elapsed < 1000 ? `${elapsed}ms` : `${(elapsed / 1000).toFixed(1)}s`;

    let summary = `针对「${firstWord}${requirement.length > 20 ? '…' : ''}」的需求，`;
    summary += `CEO 引擎调用了 ${goals.length} 个子 Agent（${agentNames}），采用${strategy}策略执行，总耗时 ${elapsedStr}。\n\n`;

    for (const goal of goals) {
      const result = allResults.find(r => r.taskId === goal.id);
      const icon = result?.success ? '✅' : '❌';
      summary += `${icon} **${goal.agentName}**：${goal.description}`;
      if (result) {
        const meaning = this.extractMeaning(result.output, goal.workerType);
        if (meaning) summary += ` — ${meaning}`;
      }
      summary += '\n';
    }

    if (successCount === goals.length) {
      summary += `\n所有子任务均已完成，目标达成。`;
    } else {
      summary += `\n${goals.length - successCount} 个子任务未完成，建议检查相关 Agent 输出并重试。`;
    }

    return summary;
  }

  /**
   * Extract a short meaningful description from an agent's output.
   */
  private extractMeaning(output: unknown, workerType: string): string {
    if (!output || typeof output !== 'object') return '';
    const obj = output as Record<string, unknown>;

    switch (workerType) {
      case 'context':
        if (obj.summary) return String(obj.summary).slice(0, 200);
        if (obj.filesAnalyzed !== undefined) return `分析了 ${obj.filesAnalyzed} 个文件`;
        return '';
      case 'planning':
        if (obj.approved === true) return '方案已通过审核';
        if (obj.designDocument && typeof obj.designDocument === 'string') {
          return `生成了设计方案（${obj.designDocument.length} 字）`;
        }
        return '';
      case 'execution':
        if (obj.aggregated && typeof obj.aggregated === 'object') {
          const agg = obj.aggregated as Record<string, unknown>;
          if (agg.summary) return String(agg.summary);
        }
        return '';
      default:
        return '';
    }
  }

  /**
   * Format agent output as a natural language summary line.
   * Extracts meaningful information from each agent type's structured output.
   */
  private formatAgentOutput(output: unknown): string {
    if (!output) return '';
    if (typeof output === 'string') return output;
    try {
      const obj = output as Record<string, unknown>;

      // ── PlanningAgent output ──────────────────────────
      if (obj.goalAnalysis && obj.designDocument) {
        const ga = obj.goalAnalysis as Record<string, unknown>;
        const goalType = ga.type ?? 'general';
        const approved = obj.approved === true ? '✅ 通过' : '⚠️ 待审核';
        const lines: string[] = [];
        lines.push(`**目标类型**：${goalType}`);
        lines.push(`**审核结果**：${approved}`);
        const designDoc = obj.designDocument as string;
        if (typeof designDoc === 'string' && designDoc.length > 0) {
          // 提取设计文档的第一段（## Goal 后的内容）
          const goalMatch = designDoc.match(/## Goal\n(.+?)(?:\n|$)/);
          if (goalMatch) lines.push(`**设计方案**：${goalMatch[1].trim()}`);
        }
        if (obj.reviewResult) {
          const review = obj.reviewResult as Record<string, unknown>;
          if (Array.isArray(review.feedback) && review.feedback.length > 0) {
            lines.push(`**评审反馈**：${review.feedback[0]}`);
          }
        }
        return lines.join('\n');
      }

      // ── ExecutionAgent output ─────────────────────────
      if (obj.plan && obj.aggregated) {
        const agg = obj.aggregated as Record<string, unknown>;
        const ver = (obj.verification ?? {}) as Record<string, unknown>;
        const lines: string[] = [];
        if (agg.summary) lines.push(`**执行结果**：${agg.summary}`);
        if (agg.successRate !== undefined) {
          lines.push(`**成功率**：${Math.round(Number(agg.successRate) * 100)}%`);
        }
        if (ver.verificationPassed !== undefined) {
          lines.push(`**验证**：${ver.verificationPassed ? '✅ 通过' : '❌ 未通过'}`);
        }
        return lines.join('\n');
      }

      // ── ContextAgent output ───────────────────────────
      if (obj.relevantCode || obj.projectStructure) {
        const lines: string[] = [];
        if (obj.summary) {
          lines.push(`**摘要**：${obj.summary}`);
        }
        if (obj.filesAnalyzed !== undefined) {
          lines.push(`**分析文件数**：${obj.filesAnalyzed}`);
        }
        if (obj.contextNeeded && Array.isArray(obj.contextNeeded)) {
          lines.push(`**分析领域**：${(obj.contextNeeded as string[]).join('、')}`);
        }
        return lines.join('\n');
      }

      // ── Fallback: known keys ─────────────────────────
      const lines: string[] = [];
      if (obj.summary) lines.push(`**摘要**：${obj.summary}`);
      if (obj.successRate !== undefined) lines.push(`**成功率**：${Number(obj.successRate) * 100}%`);
      if (obj.filesAnalyzed !== undefined) lines.push(`**分析文件数**：${obj.filesAnalyzed}`);
      if (obj.approved !== undefined) lines.push(`**审批**：${obj.approved ? '通过' : '未通过'}`);
      if (lines.length > 0) return lines.join('\n');

      // 最后的 fallback：不返回原始 JSON，而是提取有意义的信息
      const keys = Object.keys(obj);
      const sampleKeys = keys.slice(0, 3).join('、');
      return `处理完成（输出包含 ${keys.length} 个结果字段：${sampleKeys}${keys.length > 3 ? '...' : ''}）`;
    } catch {
      return String(output).slice(0, 200);
    }
  }

  /**
   * Inject CEO summary node into DAG so Agent → Summary edges have a real sink.
   */
  private async injectSummaryNode(summary: string): Promise<void> {
    try {
      const { useTaskStore } = await import('@/stores/useTaskStore');
      const currentNodes = new Map(useTaskStore.getState().nodes);
      const summaryNode: import('@/types/events').DAGNode = {
        id: 'ceo-summary',
        type: 'summary',
        label: 'CEO Summary',
        status: 'completed',
        parentId: 'main-agent',
        summaryContent: summary,
        workspaceId: this.workspaceId,
        startTime: this.startTime,
        endTime: Date.now(),
      };
      currentNodes.set(summaryNode.id, summaryNode);
      useTaskStore.setState({ nodes: currentNodes });
    } catch { /* 非浏览器环境，静默忽略 */ }
  }

  /**
   * 注入恢复操作 DAG 节点
   */
  private async injectRecoveryNode(
    agentId: string,
    recoveryType: 'retry' | 'split' | 'skip' | 'fail',
    errorMessage?: string
  ): Promise<void> {
    try {
      const { useTaskStore } = await import('@/stores/useTaskStore');
      const currentNodes = new Map(useTaskStore.getState().nodes);
      const nodeId = `recovery-${agentId}-${Date.now()}`;
      const recoveryNode: import('@/types/events').DAGNode = {
        id: nodeId,
        type: 'recovery',
        label: recoveryType,
        status: recoveryType === 'fail' ? 'failed' : 'completed',
        parentId: agentId,
        recoveryType,
        recoveryAgentId: agentId,
        errorMessage,
        workspaceId: '',
        startTime: Date.now(),
        endTime: Date.now(),
      };
      currentNodes.set(nodeId, recoveryNode);
      useTaskStore.setState({ nodes: currentNodes });
    } catch { /* 非浏览器环境 */ }
  }

  /**
   * 注入技能使用 DAG 节点
   */
  private async injectSkillNode(
    agentId: string,
    skillName: string,
    domain: string,
    matchScore?: number
  ): Promise<void> {
    try {
      const { useTaskStore } = await import('@/stores/useTaskStore');
      const currentNodes = new Map(useTaskStore.getState().nodes);
      const nodeId = `skill-${agentId}-${skillName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '-')}`;
      const skillNode: import('@/types/events').DAGNode = {
        id: nodeId,
        type: 'skill',
        label: skillName,
        status: 'completed',
        parentId: agentId,
        skillName,
        skillDomain: domain,
        matchScore,
        workspaceId: '',
        startTime: Date.now(),
      };
      currentNodes.set(nodeId, skillNode);
      useTaskStore.setState({ nodes: currentNodes });
    } catch { /* 非浏览器环境 */ }
  }

  /**
   * 注入自进化 DAG 节点
   */
  private async injectEvolutionNode(
    stage: string,
    candidateCount: number,
    scoreSummary?: Record<string, number>
  ): Promise<void> {
    try {
      const { useTaskStore } = await import('@/stores/useTaskStore');
      const currentNodes = new Map(useTaskStore.getState().nodes);
      const nodeId = `evolution-${Date.now()}`;
      // 移除旧的 evolution 节点（只保留最新一次）
      for (const key of currentNodes.keys()) {
        if (key.startsWith('evolution-')) currentNodes.delete(key);
      }
      const evoNode: import('@/types/events').DAGNode = {
        id: nodeId,
        type: 'evolution',
        label: '自进化循环',
        status: 'completed',
        parentId: 'ceo-summary',
        evolutionStage: stage,
        candidateCount,
        scoreSummary,
        workspaceId: '',
        startTime: Date.now(),
        endTime: Date.now(),
      };
      currentNodes.set(nodeId, evoNode);
      useTaskStore.setState({ nodes: currentNodes });
    } catch { /* 非浏览器环境 */ }
  }

  /**
   * 将 ProblemDetector 状态推送到 Agent Group 节点的 progress 字段
   */
  private async injectDAGProblemStatus(
    goalId: string,
    status: import('@/types/multi-agent/problem-detector').ProblemStatus
  ): Promise<void> {
    try {
      const { useTaskStore } = await import('@/stores/useTaskStore');
      const currentNodes = new Map(useTaskStore.getState().nodes);
      const nodeId = `agent-${goalId}`;
      const existing = currentNodes.get(nodeId);
      if (existing) {
        currentNodes.set(nodeId, {
          ...existing,
          childCount: status.progress.toolCalls,
          taskDescription: status.isHardProblem
            ? `⚠️ 困难问题 (级别: ${status.difficulty}, 工具调用: ${status.progress.toolCalls}/${status.thresholds.toolCallCount})`
            : existing.taskDescription,
        });
        useTaskStore.setState({ nodes: currentNodes });
      }
    } catch { /* 非浏览器环境 */ }
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
