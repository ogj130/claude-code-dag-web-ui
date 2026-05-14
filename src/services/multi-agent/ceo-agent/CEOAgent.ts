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
import { LLMDecomposer } from './LLMDecomposer';
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
  private currentRequirement: string = '';
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
      /** LLM 调用用的角色设定（不参与分解，仅转发给 executor） */
      systemPrompt?: string;
    }
  ): Promise<ExecutionReport> {
    // 编排模式：有预定义 Flow 时走 executeWithOrchestration
    if (this.hasOrchestrationFlow()) {
      return this.executeWithOrchestration(requirement, executor, options);
    }

    this.currentRequirement = requirement;
    this.startTime = Date.now();
    this.iteration = 0;
    this.skillsUsed = new Set();
    this.allAgentOutputs = new Map();

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

    // Step 2.5: 注入规划拓扑节点（DAG 可视化：展示 CEO 分解方案）
    // 使用 'plan-' 前缀区分执行时 WebSocket 创建的 agent_group 节点
    for (const goal of goals) {
      await this.injectPlanNode(goal);
    }

    // Step 3-5: 迭代执行
    const iterationSummaries: IterationSummary[] = [];
    const allTaskResults: TaskResult[] = [];

    while (this.iteration < this.config.maxIterations) {
      this.iteration++;
      const pendingGoals = goals.filter(g => !g.verified);
      if (pendingGoals.length === 0) break;

      const taskResults = await this.executeGoalsWithAgents(pendingGoals, executor, options);
      allTaskResults.push(...taskResults);

      // 失败任务：Claude Code 内部已重试，此处标记为已处理
      for (const result of taskResults) {
        if (!result.success) {
          const goal = goals.find(g => g.id === result.taskId);
          if (goal) {
            goal.verified = true; // 不再重试，让 CEO 汇总时展示失败信息
            console.warn(`[CEO] Task ${goal.id} failed: ${result.error ?? 'unknown'}`);
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
      systemPrompt?: string;
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

      // 保持"运行中"状态可见至少 500ms，避免过快完成导致用户看不到进度
      await new Promise(r => setTimeout(r, 500));

      // DAG agent_group 节点由 WebSocket 事件系统（agent_start/agent_end）统一创建
      // 此处不再重复注入，避免双重节点导致 DAGCanvas 渲染崩溃

      // Inject skill nodes for loaded skills
      for (const skill of relevantSkills) {
        await this.injectSkillNode(goal.id, skill.name, skill.domain ?? 'general', undefined);
      }

      // 构建 B+C 格式 prompt：系统角色 + 依赖输出 + 子任务 + 输出要求
      const depOutputs = (goal.dependsOn ?? [])
        .filter(depId => this.allAgentOutputs.has(depId))
        .map(depId => ({ goalId: depId, output: this.allAgentOutputs.get(depId) }));
      const subAgentPrompt = this.buildSubAgentPrompt(
        goal, this.currentRequirement, depOutputs, options?.systemPrompt
      );

      const taskContext = {
        taskId: goal.id,
        description: subAgentPrompt,
        workspaceId: this.workspaceId,
        workspacePath: this.workspacePath,
        context: {
          criteria: goal.verificationCriteria,
          workerType: goal.workerType,
          agentName: goal.agentName,
          // 角色设定仅转发给 executor，不参与分解或 CEO 摘要
          systemPrompt: options?.systemPrompt,
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

        // 更新规划节点状态：plan-{goal.id} 从 pending → completed/failed
        await this.updatePlanNode(goal.id, result.success);
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
   * Execute a goal via the real executor (Claude Code session)
   * All agent types (context/planning/execution/review) go through the same real execution path
   */
  private async executeWithAgent(
    goal: AgentGoal,
    taskContext: { taskId: string; description: string; workspaceId: string; context: Record<string, unknown> },
    executor: WorkerExecutor,
    skills: SkillRef[]
  ): Promise<TaskResult> {
    getProblemDetector().startTracking(taskContext.taskId);

    const result = await executor.execute(taskContext, skills);

    getProblemDetector().stopTracking(taskContext.taskId);

    return {
      taskId: goal.id,
      workerType: goal.workerType as WorkerAgentType,
      output: result.output,
      success: result.success,
      duration: result.duration,
      skillsUsed: result.skillsUsed,
      subTasks: result.subTasks ?? [],
    };
  }

  /**
   * 构建 B+C 格式子 Agent prompt
   * 包含：系统角色 + 依赖 Agent 输出 + 子任务 + 输出格式要求
   */
  private buildSubAgentPrompt(
    goal: AgentGoal,
    requirement: string,
    depOutputs: Array<{ goalId: string; output: unknown }>,
    systemPrompt?: string,
  ): string {
    const parts: string[] = [];

    // 系统角色
    if (systemPrompt) {
      parts.push(systemPrompt);
    }
    parts.push(`[系统角色]`);
    parts.push(`你是 CEO Agent 的一个子 Agent：${goal.agentName}（${goal.workerType}）`);
    parts.push(`用户原始需求：${requirement}`);
    parts.push(`完成后请在最终回复中给出一段结构化的执行总结。`);

    // 依赖 Agent 的输出
    if (depOutputs.length > 0) {
      parts.push('');
      parts.push(`[依赖 Agent 的输出]`);
      for (const dep of depOutputs) {
        const outStr = typeof dep.output === 'string'
          ? dep.output
          : JSON.stringify(dep.output, null, 2);
        parts.push(`--- ${dep.goalId} 的输出 ---`);
        parts.push(outStr.slice(0, 2000)); // 限制上下文长度
      }
    }

    // 子任务
    parts.push('');
    parts.push(`[你的子任务]`);
    parts.push(goal.description);

    // 验证标准
    if (goal.verificationCriteria.length > 0) {
      parts.push('');
      parts.push(`[验证标准]`);
      parts.push(goal.verificationCriteria.join('\n'));
    }

    // 输出格式要求
    parts.push('');
    parts.push(`[输出格式]`);
    parts.push(`请在最终回复末尾包含以下结构化总结：`);
    parts.push(`### 执行总结`);
    parts.push(`（一段话总结你完成了什么）`);
    parts.push(`### 涉及的文件`);
    parts.push(`- path/to/changed/file`);
    parts.push(`### 关键决策`);
    parts.push(`（如果有的话）`);

    return parts.join('\n');
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

    parts.push(`### 📋 各 Agent 执行详情\n`);
    for (const goal of goals) {
      const result = allResults.find(r => r.taskId === goal.id);
      const icon = result?.success ? '✅' : '❌';
      const details = this.formatAgentOutput(result?.output);
      parts.push(`#### ${icon} ${goal.agentName}`);
      parts.push(`**任务**：${goal.description}`);
      parts.push(`**耗时**：${result?.duration ?? '?'}ms`);
      if (details) parts.push(details);
      if (result?.error) parts.push(`> ⚠️ 错误：${result.error}`);
      parts.push('');
    }

    const successCount = allResults.filter(r => r.success).length;
    const elapsed = Date.now() - this.startTime;
    const elapsedStr = elapsed < 1000 ? `${elapsed}ms` : `${(elapsed / 1000).toFixed(1)}s`;

    parts.push(`---`);
    parts.push(`### 📊 执行统计`);
    parts.push(`- 总Agent数：${goals.length}`);
    parts.push(`- 成功：${successCount}`);
    parts.push(`- 失败：${allResults.length - successCount}`);
    parts.push(`- 总耗时：${elapsedStr}`);

    parts.push('');
    parts.push(`### 🧠 CEO 总结`);
    parts.push(this.buildNaturalSummary(requirement, goals, allResults, elapsedStr));

    return parts.join('\n');
  }

  /**
   * Build a natural language summary of the entire execution.
   */
  private buildNaturalSummary(
    requirement: string, goals: AgentGoal[], allResults: TaskResult[], elapsedStr: string,
  ): string {
    const successCount = allResults.filter(r => r.success).length;
    const firstWord = requirement.slice(0, Math.min(20, requirement.length));
    const prefix = requirement.length > 20 ? '…' : '';
    let s = `针对「${firstWord}${prefix}」的需求，CEO 调用了 ${goals.length} 个子 Agent，总耗时 ${elapsedStr}。\n\n`;
    for (const goal of goals) {
      const r = allResults.find(x => x.taskId === goal.id);
      const icon = r?.success ? '✅' : '❌';
      const parsed = this.parseSubAgentOutput(r?.output);
      s += `${icon} **${goal.agentName}**（${goal.workerType}）`;
      if (parsed.execSummary) s += ` — ${parsed.execSummary.slice(0, 150)}`;
      if (parsed.changedFiles.length > 0) s += ` | 修改 ${parsed.changedFiles.length} 个文件`;
      s += '\n';
    }
    if (successCount === goals.length && successCount > 0) {
      s += `\n所有 ${goals.length} 个子任务均已成功完成。`;
    } else if (successCount > 0) {
      s += `\n${successCount}/${goals.length} 个子任务完成，${goals.length - successCount} 个失败。`;
    } else {
      s += `\n所有子任务均未成功完成，请检查子 Agent 输出排查问题。`;
    }
    return s;
  }

  /**
   * Extract a short meaningful description from an agent's output.
   */
  /** Parse sub-agent B+C format output: exec summary / changed files / key decisions */
  private parseSubAgentOutput(output: unknown): {
    execSummary: string; changedFiles: string[]; keyDecisions: string[];
  } {
    const r = { execSummary: '', changedFiles: [] as string[], keyDecisions: [] as string[] };
    let text = '';
    if (typeof output === 'string') { text = output; }
    else if (output && typeof output === 'object') {
      text = String((output as Record<string,unknown>).summary ?? (output as Record<string,unknown>).message ?? JSON.stringify(output));
    }
    if (!text) return r;
    const em = text.match(/###\s*执行总结\s*\n([\s\S]*?)(?=###|$)/i);
    r.execSummary = em ? em[1].trim().slice(0, 500) : text.slice(0, 300).trim();
    const fm = text.match(/###\s*涉及的文件\s*\n([\s\S]*?)(?=###|$)/i);
    if (fm) r.changedFiles = fm[1].split('\n').map(l=>l.replace(/^[\s\-*]+/,'').trim()).filter(l=>l.length>0).slice(0,20);
    const dm = text.match(/###\s*关键决策\s*\n([\s\S]*?)(?=###|$)/i);
    if (dm) r.keyDecisions = dm[1].split('\n').map(l=>l.replace(/^[\s\-*]+/,'').trim()).filter(l=>l.length>0).slice(0,10);
    return r;
  }

  /** Format agent output — delegates to parseSubAgentOutput */
  private formatAgentOutput(output: unknown): string {
    if (!output) return '';
    if (typeof output === 'string') return output.slice(0, 500);
    const p = this.parseSubAgentOutput(output);
    const parts: string[] = [];
    if (p.execSummary) parts.push(`**执行总结**：${p.execSummary}`);
    if (p.changedFiles.length > 0) parts.push(`**涉及的文件**：${p.changedFiles.join('、')}`);
    if (p.keyDecisions.length > 0) parts.push(`**关键决策**：${p.keyDecisions.join('；')}`);
    return parts.join('\n');
  }

  /* old extractMeaning — kept for reference, unused *

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
   * 注入规划拓扑节点 — 在 DAG 中展示 CEO 分解方案（独立模式）
   * 使用 'plan-' 前缀区分执行时 WebSocket 创建的 agent_group 节点
   */
  private async injectPlanNode(goal: AgentGoal): Promise<void> {
    try {
      const { useTaskStore } = await import('@/stores/useTaskStore');
      const currentNodes = new Map(useTaskStore.getState().nodes);

      // 升级 main-agent 为 CEO 标签（覆盖 session_start 的 "Claude Agent"）
      const mainNode = currentNodes.get('main-agent');
      if (mainNode) {
        currentNodes.set('main-agent', {
          ...mainNode,
          label: '🧠 CEO',
          type: 'agent_group',
          agentName: 'CEO',
          taskDescription: `用户需求: ${this.currentRequirement.slice(0, 60)}`,
        } as import('@/types/events').DAGNode);
      }

      const nodeId = `plan-${goal.id}`;
      const planNode: import('@/types/events').DAGNode = {
        id: nodeId,
        type: 'agent_group',
        label: goal.agentName,
        status: 'pending',
        parentId: 'main-agent',
        source: 'orchestration' as import('@/types/events').DAGNode['source'],
        agentName: goal.agentName,
        childCount: 0,
        collapsed: false,
        taskDescription: goal.description,
        workspaceId: this.workspaceId,
        startTime: Date.now(),
      };
      (planNode as import('@/types/events').DAGNode & { agentType: string }).agentType = goal.workerType;
      currentNodes.set(nodeId, planNode);
      useTaskStore.setState({ nodes: currentNodes });
    } catch { /* 非浏览器环境，静默忽略 */ }
  }

  /**
   * 更新规划节点状态 — 执行完成后从 pending → completed/failed
   */
  private async updatePlanNode(goalId: string, success: boolean): Promise<void> {
    try {
      const { useTaskStore } = await import('@/stores/useTaskStore');
      const currentNodes = new Map(useTaskStore.getState().nodes);
      const nodeId = `plan-${goalId}`;
      const existing = currentNodes.get(nodeId);
      if (existing) {
        currentNodes.set(nodeId, {
          ...existing,
          status: success ? 'completed' : 'failed',
          endTime: Date.now(),
        });
        useTaskStore.setState({ nodes: currentNodes });
      }
    } catch { /* 非浏览器环境，静默忽略 */ }
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

      // 最小内容检查：output 不能为空/null（ContextAgent 至少应扫描了文件）
      const hasContent = relatedResults.some(r => {
        if (!r.success) return false;
        if (r.output === null || r.output === undefined) return false;
        if (typeof r.output === 'object' && Object.keys(r.output as object).length === 0) return false;
        return true;
      });

      // 每个 criteria 独立验证：检查 criteria 关键词是否在结果中出现
      const criteriaMet = hasContent && goal.verificationCriteria.every(criteria => {
        const criteriaLower = criteria.toLowerCase();
        return relatedResults.some(r => {
          const outputStr = JSON.stringify(r.output ?? '').toLowerCase();
          return outputStr.includes(criteriaLower) || r.success;
        });
      });

      const met = criteriaMet && hasContent;

      return {
        goal,
        met,
        evidence: met
          ? 'All verification criteria met with content'
          : !hasContent
            ? 'Agent returned empty output — no real analysis performed'
            : 'Partial completion - some criteria not met',
        taskResults: relatedResults,
      };
    });

    const metCount = goalResults.filter(g => g.met).length;
    const allGoalsMet = goalResults.every(g => g.met);
    const metRatio = goals.length > 0 ? metCount / goals.length : 0;

    return {
      allGoalsMet: allGoalsMet || metRatio >= this.config.verificationThreshold,
      goalResults,
      missedGoals: goalResults.filter(g => !g.met).map(g => g.goal),
      reasoning: allGoalsMet
        ? 'All goals verified successfully'
        : `${metCount}/${goals.length} goals met (${goalResults.filter(g => !g.met).map(g => g.goal.description).join(', ')})`,
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
