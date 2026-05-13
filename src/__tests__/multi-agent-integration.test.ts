/**
 * 多Agent系统 端到端集成测试
 *
 * 覆盖 5 大场景：
 * 1. 独立模式 (Independent Mode) — CEOAgent 无编排拓扑
 * 2. 编排模式 (Orchestration Mode) — CEOAgent + FlowDefinition
 * 3. FlowDefinition 类型测试
 * 4. DAGNode source 字段
 * 5. 监控面板数据映射
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CEOAgent } from '../services/multi-agent/ceo-agent';
import { LLMDecomposer } from '../services/multi-agent/ceo-agent/LLMDecomposer';
import { useTaskStore } from '@/stores/useTaskStore';
import type { WorkerExecutor, WorkerExecutorContext } from '../services/multi-agent/types';
import type { TaskResult } from '@/types/multi-agent/worker-agents';
import type { SkillRef } from '@/types/multi-agent/skill';
import type { FlowDefinition, FlowAgent } from '@/types/multi-agent/flow-definition';
import type { DAGNode } from '@/types/events';
import type { AgentPlan } from '@/types/multi-agent/ceo-agent';

// ── 辅助工厂 ──────────────────────────────────────────────

/** 创建可控的 mock executor */
function createMockExecutor(overrides?: Partial<TaskResult>): WorkerExecutor {
  return {
    execute: vi.fn().mockImplementation(
      async (task: WorkerExecutorContext, _skills: SkillRef[]) => {
        return {
          taskId: task.taskId,
          workerType: 'execution',
          output: { message: 'Task completed successfully' },
          success: true,
          duration: 100,
          skillsUsed: [],
          subTasks: [],
          ...overrides,
        } as TaskResult;
      }
    ),
  };
}

/** 创建带追踪的 mock executor，记录调用顺序 */
function createTracingExecutor(): WorkerExecutor & { callOrder: string[] } {
  const callOrder: string[] = [];
  return {
    callOrder,
    execute: vi.fn().mockImplementation(
      async (task: WorkerExecutorContext) => {
        callOrder.push(task.taskId);
        return {
          taskId: task.taskId,
          workerType: 'execution',
          output: { message: `Done: ${task.taskId}` },
          success: true,
          duration: 50,
          skillsUsed: [],
          subTasks: [],
        } as TaskResult;
      }
    ),
  };
}

/** 创建一个标准 LLM 分解计划 */
function createSampleAgentPlan(): AgentPlan {
  return {
    agents: [
      {
        id: 'agent-context',
        type: 'context',
        name: 'ContextAgent',
        description: 'Analyze project context',
        dependsOn: [],
        priority: 1,
        verificationCriteria: ['project_structure_analyzed'],
      },
      {
        id: 'agent-execution',
        type: 'execution',
        name: 'ExecutionAgent',
        description: 'Execute implementation',
        dependsOn: ['agent-context'],
        priority: 2,
        verificationCriteria: ['task_completed'],
      },
    ],
    strategy: 'pipeline',
    estimatedDuration: 3000,
  };
}

/** 创建一个标准 FlowDefinition（编排模式） */
function createSampleFlowDefinition(mode: FlowDefinition['mode'] = 'sequential'): FlowDefinition {
  return {
    mode,
    agents: [
      {
        id: 'flow-agent-1',
        name: 'Planner',
        agentType: 'planning',
        taskDescription: 'Design the architecture',
        dependencies: [],
      },
      {
        id: 'flow-agent-2',
        name: 'Builder',
        agentType: 'execution',
        taskDescription: 'Implement the feature',
        dependencies: ['flow-agent-1'],
      },
      {
        id: 'flow-agent-3',
        name: 'Reviewer',
        agentType: 'review',
        taskDescription: 'Review the code',
        dependencies: ['flow-agent-2'],
      },
    ],
    connections: [
      { from: 'flow-agent-1', to: 'flow-agent-2' },
      { from: 'flow-agent-2', to: 'flow-agent-3' },
    ],
  };
}

// ════════════════════════════════════════════════════════════
// 1. 独立模式 (Independent Mode)
// ════════════════════════════════════════════════════════════

describe('独立模式 (Independent Mode)', () => {
  let ceo: CEOAgent;

  beforeEach(() => {
    ceo = new CEOAgent({ maxIterations: 3, verificationThreshold: 0.8 });
    useTaskStore.getState().reset();
  });

  it('无编排拓扑时 hasOrchestrationFlow() 返回 false', () => {
    expect(ceo.hasOrchestrationFlow()).toBe(false);
  });

  it('processWithDecomposer 使用 LLMDecomposer 分解需求', async () => {
    const mockPlan = createSampleAgentPlan();
    const mockExecutor = createMockExecutor();

    const decomposer = new LLMDecomposer({
      llmAvailable: true,
      llmCall: vi.fn().mockResolvedValue(JSON.stringify(mockPlan)),
    });
    ceo.setDecomposer(decomposer);

    const report = await ceo.processWithDecomposer(
      'Build a user authentication system',
      mockExecutor
    );

    // 验证报告结构
    expect(report).toBeDefined();
    expect(report.summary).toBeTruthy();
    expect(report.originalRequirement).toBe('Build a user authentication system');
    expect(report.totalIterations).toBeGreaterThanOrEqual(1);
    expect(report.totalDuration).toBeGreaterThanOrEqual(0);
    expect(typeof report.timestamp).toBe('number');
    expect(typeof report.partialCompletion).toBe('boolean');

    // 验证 goals 被创建
    const allGoals = [...report.completedGoals, ...report.missedGoals];
    expect(allGoals.length).toBeGreaterThan(0);

    // 验证 task results
    expect(Array.isArray(report.taskResults)).toBe(true);
    expect(report.taskResults.length).toBeGreaterThan(0);
    for (const result of report.taskResults) {
      expect(result.taskId).toBeTruthy();
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.duration).toBe('number');
    }
  });

  it('LLM 不可用时降级到规则引擎', async () => {
    const mockExecutor = createMockExecutor();

    // LLM 不可用，应降级到规则引擎
    const decomposer = new LLMDecomposer({ llmAvailable: false });
    ceo.setDecomposer(decomposer);

    const report = await ceo.processWithDecomposer(
      '实现一个用户认证模块并测试',
      mockExecutor
    );

    expect(report).toBeDefined();
    expect(report.taskResults.length).toBeGreaterThan(0);

    // DAG agent_group 节点由 WebSocket 事件系统统一创建（不在单元测试中模拟）
    // CEOAgent 不再直接注入 agent_group 节点（避免与 WebSocket 事件节点重复）
    // 验证 ceo-summary 节点存在即可
    const nodes = useTaskStore.getState().nodes;
    expect(nodes.get('ceo-summary')).toBeDefined();
  });

  it('注入 ceo-summary DAG 节点', async () => {
    const mockExecutor = createMockExecutor();
    const decomposer = new LLMDecomposer({ llmAvailable: false });
    ceo.setDecomposer(decomposer);

    await ceo.processWithDecomposer('Build a feature', mockExecutor);

    const summaryNode = useTaskStore.getState().nodes.get('ceo-summary');
    expect(summaryNode).toBeDefined();
    expect(summaryNode?.type).toBe('summary');
    expect(summaryNode?.status).toBe('completed');
    expect(summaryNode?.summaryContent).toBeTruthy();
  });

  it('executor 返回失败结果时包含错误信息', async () => {
    const mockExecutor = createMockExecutor({
      success: false,
      error: 'Permission denied: cannot write to /protected',
    });
    const decomposer = new LLMDecomposer({ llmAvailable: false });
    ceo.setDecomposer(decomposer);

    const report = await ceo.processWithDecomposer('Fix the bug', mockExecutor);

    expect(report).toBeDefined();
    expect(report.taskResults.some(r => !r.success)).toBe(true);
  });

  it('executor 被正确调用且传入任务上下文', async () => {
    const mockExecutor = createMockExecutor();
    const decomposer = new LLMDecomposer({ llmAvailable: false });
    ceo.setDecomposer(decomposer);

    await ceo.processWithDecomposer('Build feature', mockExecutor);

    expect(mockExecutor.execute).toHaveBeenCalled();

    // 验证传入的上下文包含必要字段
    const firstCall = (mockExecutor.execute as ReturnType<typeof vi.fn>).mock.calls[0];
    const taskContext = firstCall[0] as WorkerExecutorContext;
    expect(taskContext.taskId).toBeTruthy();
    expect(taskContext.description).toBeTruthy();
  });

  it('预计算 plan 可跳过内部 decompose 步骤', async () => {
    const mockExecutor = createMockExecutor();
    const precomputedPlan = createSampleAgentPlan();

    const llmCall = vi.fn();
    const decomposer = new LLMDecomposer({
      llmAvailable: true,
      llmCall,
    });
    ceo.setDecomposer(decomposer);

    await ceo.processWithDecomposer('Build auth system', mockExecutor, {
      plan: precomputedPlan,
    });

    // LLM 不应被调用，因为使用了预计算 plan
    expect(llmCall).not.toHaveBeenCalled();

    // 但执行结果应该正常
    const report = await ceo.processWithDecomposer('Build auth system', mockExecutor, {
      plan: precomputedPlan,
    });
    expect(report.taskResults.length).toBeGreaterThan(0);
  });

  it('onTaskStart 和 onTaskComplete 回调被调用', async () => {
    const mockExecutor = createMockExecutor();
    const decomposer = new LLMDecomposer({ llmAvailable: false });
    ceo.setDecomposer(decomposer);

    const onTaskStart = vi.fn();
    const onTaskComplete = vi.fn();

    await ceo.processWithDecomposer('Build system', mockExecutor, {
      onTaskStart,
      onTaskComplete,
    });

    expect(onTaskStart).toHaveBeenCalled();
    expect(onTaskComplete).toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════
// 2. 编排模式 (Orchestration Mode)
// ════════════════════════════════════════════════════════════

describe('编排模式 (Orchestration Mode)', () => {
  let ceo: CEOAgent;

  beforeEach(() => {
    ceo = new CEOAgent({ maxIterations: 3, verificationThreshold: 0.8 });
    useTaskStore.getState().reset();
  });

  it('设置编排拓扑后 hasOrchestrationFlow() 返回 true', () => {
    const flow = createSampleFlowDefinition();
    ceo.setOrchestrationFlow(flow);
    expect(ceo.hasOrchestrationFlow()).toBe(true);
  });

  it('清除编排拓扑后 hasOrchestrationFlow() 返回 false', () => {
    ceo.setOrchestrationFlow(createSampleFlowDefinition());
    ceo.clearOrchestrationFlow();
    expect(ceo.hasOrchestrationFlow()).toBe(false);
  });

  it('编排模式下 processWithDecomposer 走 executeWithOrchestration 路径', async () => {
    const tracingExec = createTracingExecutor();
    const flow = createSampleFlowDefinition('sequential');
    ceo.setOrchestrationFlow(flow);

    const report = await ceo.processWithDecomposer(
      'Build and review a feature',
      tracingExec
    );

    // 所有 agent 类型统一走 executor（不再有内部 context/planning LLM 调用）
    expect(tracingExec.callOrder).toEqual(['flow-agent-1', 'flow-agent-2', 'flow-agent-3']);

    // 验证报告结构
    expect(report).toBeDefined();
    expect(report.summary).toBeTruthy();
    expect(report.originalRequirement).toBe('Build and review a feature');
    expect(report.totalIterations).toBeGreaterThanOrEqual(1);
    // 3 个 agents 都有 taskResults
    expect(report.taskResults.length).toBe(3);
  });

  it('编排模式注入 orchestration source 的 DAG 拓扑节点', async () => {
    const mockExecutor = createMockExecutor();
    const flow = createSampleFlowDefinition('sequential');
    ceo.setOrchestrationFlow(flow);

    await ceo.processWithDecomposer('Build feature', mockExecutor);

    const nodes = useTaskStore.getState().nodes;

    // 验证编排拓扑节点 (source: 'orchestration')
    const orchestrationNodes = Array.from(nodes.values()).filter(
      n => n.source === 'orchestration'
    );
    expect(orchestrationNodes.length).toBe(flow.agents.length);

    for (const agent of flow.agents) {
      const topoNode = nodes.get(`orch-${agent.id}`);
      expect(topoNode).toBeDefined();
      expect(topoNode?.type).toBe('agent_group');
      expect(topoNode?.status).toBe('pending');
      expect(topoNode?.agentName).toBe(agent.name);
      expect(topoNode?.taskDescription).toBe(agent.taskDescription);
    }
  });

  it('编排模式下仅创建 topology 节点，执行节点由 WebSocket 事件系统处理', async () => {
    const mockExecutor = createMockExecutor();
    const flow = createSampleFlowDefinition('sequential');
    ceo.setOrchestrationFlow(flow);

    await ceo.processWithDecomposer('Build feature', mockExecutor);

    const nodes = useTaskStore.getState().nodes;

    // 编排模式创建 orchestration source 的拓扑节点（由 injectOrchestrationNode 负责）
    const orchestrationNodes = Array.from(nodes.values()).filter(
      n => n.source === 'orchestration'
    );
    expect(orchestrationNodes.length).toBe(flow.agents.length);

    for (const agent of flow.agents) {
      const topoNode = nodes.get(`orch-${agent.id}`);
      expect(topoNode).toBeDefined();
      expect(topoNode?.type).toBe('agent_group');
    }

    // execution source 节点由 WebSocket 事件系统（agent_start）创建
    // 不在单元测试中模拟（CEOAgent 不再直接注入）
  });

  it('parallel 模式并行执行所有 agents', async () => {
    const tracingExec = createTracingExecutor();
    const flow = createSampleFlowDefinition('parallel');
    ceo.setOrchestrationFlow(flow);

    const report = await ceo.processWithDecomposer('Build feature', tracingExec);

    // 只有 execution 类型（flow-agent-2）通过 executor 调用
    // planning 和 review 使用内部 agent，不走 executor
    expect(tracingExec.callOrder).toContain('flow-agent-2');

    expect(report).toBeDefined();
    // 3 个 agents 全部有结果（不论是否经过 executor）
    expect(report.taskResults.length).toBe(flow.agents.length);
  });

  it('coordinator 模式先执行 planning 再并行 execution', async () => {
    const tracingExec = createTracingExecutor();
    const flow: FlowDefinition = {
      mode: 'coordinator',
      agents: [
        {
          id: 'coord-planner',
          name: 'Planner',
          agentType: 'planning',
          taskDescription: 'Plan the approach',
          dependencies: [],
        },
        {
          id: 'coord-worker-1',
          name: 'Worker1',
          agentType: 'execution',
          taskDescription: 'Build module A',
          dependencies: ['coord-planner'],
        },
        {
          id: 'coord-worker-2',
          name: 'Worker2',
          agentType: 'execution',
          taskDescription: 'Build module B',
          dependencies: ['coord-planner'],
        },
      ],
    };
    ceo.setOrchestrationFlow(flow);

    const report = await ceo.processWithDecomposer('Build two modules', tracingExec);

    // 所有 agent 类型统一走 executor
    expect(tracingExec.callOrder).toContain('coord-planner');
    expect(tracingExec.callOrder).toContain('coord-worker-1');
    expect(tracingExec.callOrder).toContain('coord-worker-2');
    expect(report.taskResults.length).toBe(3);
  });

  it('reviewer 模式先 execution 再 review', async () => {
    const tracingExec = createTracingExecutor();
    const flow: FlowDefinition = {
      mode: 'reviewer',
      agents: [
        {
          id: 'rev-worker',
          name: 'Builder',
          agentType: 'execution',
          taskDescription: 'Build the feature',
          dependencies: [],
        },
        {
          id: 'rev-reviewer',
          name: 'Reviewer',
          agentType: 'review',
          taskDescription: 'Review the code',
          dependencies: ['rev-worker'],
        },
      ],
    };
    ceo.setOrchestrationFlow(flow);

    const report = await ceo.processWithDecomposer('Build and review', tracingExec);

    // reviewer 模式：execution 先执行，reviewer 最后
    expect(tracingExec.callOrder).toEqual(['rev-worker', 'rev-reviewer']);
    expect(report.taskResults.length).toBe(2);
  });

  it('编排模式也注入 ceo-summary 节点', async () => {
    const mockExecutor = createMockExecutor();
    ceo.setOrchestrationFlow(createSampleFlowDefinition('sequential'));

    await ceo.processWithDecomposer('Build feature', mockExecutor);

    const summaryNode = useTaskStore.getState().nodes.get('ceo-summary');
    expect(summaryNode).toBeDefined();
    expect(summaryNode?.type).toBe('summary');
    expect(summaryNode?.status).toBe('completed');
  });

  it('编排模式 ExecutionReport 包含正确的 taskResults', async () => {
    const mockExecutor = createMockExecutor();
    const flow = createSampleFlowDefinition('sequential');
    ceo.setOrchestrationFlow(flow);

    const report = await ceo.processWithDecomposer('Build feature', mockExecutor);

    expect(report.taskResults.length).toBe(flow.agents.length);
    for (const result of report.taskResults) {
      expect(result.taskId).toBeTruthy();
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.duration).toBe('number');
    }
  });
});

// ════════════════════════════════════════════════════════════
// 3. FlowDefinition 类型测试
// ════════════════════════════════════════════════════════════

describe('FlowDefinition 类型测试', () => {
  it('FlowDefinition 可以用所有必需字段创建', () => {
    const flow: FlowDefinition = {
      mode: 'sequential',
      agents: [
        {
          id: 'agent-1',
          name: 'TestAgent',
          agentType: 'execution',
          taskDescription: 'Do something',
          dependencies: [],
        },
      ],
    };

    expect(flow.mode).toBe('sequential');
    expect(flow.agents.length).toBe(1);
    expect(flow.agents[0].id).toBe('agent-1');
  });

  it('FlowAgent 的 agentType 支持所有 WorkerType 值', () => {
    const agentTypes: FlowAgent['agentType'][] = [
      'context',
      'planning',
      'execution',
      'review',
    ];

    for (const agentType of agentTypes) {
      const agent: FlowAgent = {
        id: `agent-${agentType}`,
        name: `${agentType}Agent`,
        agentType,
        taskDescription: `Do ${agentType} work`,
        dependencies: [],
      };
      expect(agent.agentType).toBe(agentType);
    }
  });

  it('FlowDefinition 支持所有 mode 值', () => {
    const modes: FlowDefinition['mode'][] = [
      'parallel',
      'sequential',
      'pipeline',
      'coordinator',
      'reviewer',
    ];

    for (const mode of modes) {
      const flow: FlowDefinition = {
        mode,
        agents: [],
      };
      expect(flow.mode).toBe(mode);
    }
  });

  it('FlowDefinition connections 是可选字段', () => {
    const flowWithConnections: FlowDefinition = {
      mode: 'sequential',
      agents: [],
      connections: [{ from: 'a', to: 'b' }],
    };
    const flowWithoutConnections: FlowDefinition = {
      mode: 'parallel',
      agents: [],
    };

    expect(flowWithConnections.connections).toHaveLength(1);
    expect(flowWithoutConnections.connections).toBeUndefined();
  });

  it('FlowDefinition JSON 可以 roundtrip（序列化/反序列化）', () => {
    const original: FlowDefinition = {
      mode: 'pipeline',
      agents: [
        {
          id: 'agent-ctx',
          name: 'ContextAgent',
          agentType: 'context',
          taskDescription: 'Analyze codebase',
          dependencies: [],
        },
        {
          id: 'agent-exec',
          name: 'ExecutionAgent',
          agentType: 'execution',
          taskDescription: 'Implement feature',
          dependencies: ['agent-ctx'],
        },
      ],
      connections: [{ from: 'agent-ctx', to: 'agent-exec' }],
    };

    // 序列化到 JSON 字符串（模拟 localStorage 存储）
    const json = JSON.stringify(original);
    expect(typeof json).toBe('string');

    // 反序列化
    const restored: FlowDefinition = JSON.parse(json);
    expect(restored.mode).toBe(original.mode);
    expect(restored.agents.length).toBe(original.agents.length);
    expect(restored.agents[0].id).toBe(original.agents[0].id);
    expect(restored.agents[0].agentType).toBe(original.agents[0].agentType);
    expect(restored.agents[1].dependencies).toEqual(['agent-ctx']);
    expect(restored.connections).toHaveLength(1);
    expect(restored.connections![0].from).toBe('agent-ctx');
  });

  it('FlowDefinition 空 agents 数组是合法的', () => {
    const flow: FlowDefinition = {
      mode: 'sequential',
      agents: [],
    };
    expect(flow.agents).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════
// 4. DAGNode source 字段测试
// ════════════════════════════════════════════════════════════

describe('DAGNode source 字段', () => {
  beforeEach(() => {
    useTaskStore.getState().reset();
  });

  it('source 为 orchestration 的节点可以创建', () => {
    const node: DAGNode = {
      id: 'orch-node-1',
      type: 'agent_group',
      label: 'Planner',
      status: 'pending',
      source: 'orchestration',
      agentName: 'Planner',
    };
    expect(node.source).toBe('orchestration');
  });

  it('source 为 execution 的节点可以创建', () => {
    const node: DAGNode = {
      id: 'exec-node-1',
      type: 'agent_group',
      label: 'Builder',
      status: 'running',
      source: 'execution',
      agentName: 'Builder',
    };
    expect(node.source).toBe('execution');
  });

  it('source 为 llm-decomposition 的节点可以创建', () => {
    const node: DAGNode = {
      id: 'llm-node-1',
      type: 'agent_group',
      label: 'ContextAgent',
      status: 'running',
      source: 'llm-decomposition',
      agentName: 'ContextAgent',
    };
    expect(node.source).toBe('llm-decomposition');
  });

  it('source 是可选字段 — 不设置时为 undefined', () => {
    const node: DAGNode = {
      id: 'no-source-node',
      type: 'agent_group',
      label: 'GenericAgent',
      status: 'idle',
    };
    expect(node.source).toBeUndefined();
  });

  it('编排模式下 DAG 拓扑节点 source 为 orchestration', async () => {
    const mockExecutor = createMockExecutor();
    const ceo = new CEOAgent();
    ceo.setOrchestrationFlow(createSampleFlowDefinition('sequential'));

    await ceo.processWithDecomposer('Build feature', mockExecutor);

    const nodes = useTaskStore.getState().nodes;

    // 编排拓扑节点: source = 'orchestration'（由 injectOrchestrationNode 创建）
    const topoNode = nodes.get('orch-flow-agent-1');
    expect(topoNode).toBeDefined();
    expect(topoNode?.source).toBe('orchestration');

    // 执行节点 (source = 'execution') 由 WebSocket 事件系统（agent_start）创建
    // 不在单元测试中验证（CEOAgent 不再直接注入执行节点）
  });

  it('独立模式下仅创建 ceo-summary 节点', async () => {
    const mockExecutor = createMockExecutor();
    const ceo = new CEOAgent();
    const decomposer = new LLMDecomposer({ llmAvailable: false });
    ceo.setDecomposer(decomposer);

    await ceo.processWithDecomposer('Build feature', mockExecutor);

    const nodes = useTaskStore.getState().nodes;

    // 独立模式下，agent_group 节点由 WebSocket 事件系统创建
    // CEOAgent 仅创建 ceo-summary 节点
    const summaryNode = nodes.get('ceo-summary');
    expect(summaryNode).toBeDefined();
    expect(summaryNode?.type).toBe('summary');
    expect(summaryNode?.summaryContent).toBeTruthy();
  });
});

// ════════════════════════════════════════════════════════════
// 5. 监控面板数据映射测试
// ════════════════════════════════════════════════════════════

describe('监控面板数据映射', () => {
  beforeEach(() => {
    useTaskStore.getState().reset();
  });

  /**
   * mapNodesToMonitorTasks 函数（从 AgentMonitoringPanel 中提取的纯逻辑）
   * 在这里重新实现以测试其映射规则，而不依赖 React 渲染
   */
  function mapNodesToMonitorTasks(nodes: Map<string, DAGNode>) {
    const tasks: Array<{
      id: string;
      name: string;
      status: string;
      source: string;
      agentCount: number;
    }> = [];

    for (const [, node] of nodes) {
      if (node.type !== 'agent_group') continue;

      const source = node.source ?? 'orchestration';
      const status =
        node.status === 'completed' ? 'completed'
        : node.status === 'running' ? 'running'
        : node.status === 'failed' ? 'failed'
        : 'pending';

      tasks.push({
        id: node.id,
        name: node.label,
        status,
        source,
        agentCount: node.childCount ?? 0,
      });
    }

    return tasks;
  }

  it('只过滤 agent_group 类型节点', () => {
    const nodes = new Map<string, DAGNode>([
      ['agent-1', { id: 'agent-1', type: 'agent_group', label: 'Agent A', status: 'running' }],
      ['summary-1', { id: 'summary-1', type: 'summary', label: 'Summary', status: 'completed' }],
      ['tool-1', { id: 'tool-1', type: 'tool', label: 'Tool', status: 'completed' }],
      ['agent-2', { id: 'agent-2', type: 'agent_group', label: 'Agent B', status: 'completed' }],
    ]);

    const tasks = mapNodesToMonitorTasks(nodes);
    expect(tasks.length).toBe(2);
    expect(tasks.map(t => t.id)).toEqual(['agent-1', 'agent-2']);
  });

  it('正确映射节点状态', () => {
    const nodes = new Map<string, DAGNode>([
      ['a1', { id: 'a1', type: 'agent_group', label: 'Pending', status: 'pending' }],
      ['a2', { id: 'a2', type: 'agent_group', label: 'Running', status: 'running' }],
      ['a3', { id: 'a3', type: 'agent_group', label: 'Done', status: 'completed' }],
      ['a4', { id: 'a4', type: 'agent_group', label: 'Failed', status: 'failed' }],
    ]);

    const tasks = mapNodesToMonitorTasks(nodes);
    expect(tasks.find(t => t.id === 'a1')?.status).toBe('pending');
    expect(tasks.find(t => t.id === 'a2')?.status).toBe('running');
    expect(tasks.find(t => t.id === 'a3')?.status).toBe('completed');
    expect(tasks.find(t => t.id === 'a4')?.status).toBe('failed');
  });

  it('source 字段正确读取', () => {
    const nodes = new Map<string, DAGNode>([
      ['orch-1', { id: 'orch-1', type: 'agent_group', label: 'Orch', status: 'pending', source: 'orchestration' }],
      ['exec-1', { id: 'exec-1', type: 'agent_group', label: 'Exec', status: 'running', source: 'execution' }],
      ['llm-1', { id: 'llm-1', type: 'agent_group', label: 'LLM', status: 'running', source: 'llm-decomposition' }],
    ]);

    const tasks = mapNodesToMonitorTasks(nodes);
    expect(tasks.find(t => t.id === 'orch-1')?.source).toBe('orchestration');
    expect(tasks.find(t => t.id === 'exec-1')?.source).toBe('execution');
    expect(tasks.find(t => t.id === 'llm-1')?.source).toBe('llm-decomposition');
  });

  it('无 source 时默认为 orchestration', () => {
    const nodes = new Map<string, DAGNode>([
      ['no-source', { id: 'no-source', type: 'agent_group', label: 'Default', status: 'idle' }],
    ]);

    const tasks = mapNodesToMonitorTasks(nodes);
    expect(tasks[0].source).toBe('orchestration');
  });

  it('基于 source 显示不同标签', () => {
    const sourceLabels: Record<string, string> = {
      'orchestration': '编排预定义',
      'execution': '实时执行',
      'llm-decomposition': 'LLM 分解',
    };

    const nodes = new Map<string, DAGNode>([
      ['n1', { id: 'n1', type: 'agent_group', label: 'A', status: 'pending', source: 'orchestration' }],
      ['n2', { id: 'n2', type: 'agent_group', label: 'B', status: 'running', source: 'execution' }],
      ['n3', { id: 'n3', type: 'agent_group', label: 'C', status: 'running', source: 'llm-decomposition' }],
    ]);

    const tasks = mapNodesToMonitorTasks(nodes);
    for (const task of tasks) {
      expect(sourceLabels[task.source]).toBeTruthy();
    }
  });

  it('空 nodes Map 返回空任务列表', () => {
    const tasks = mapNodesToMonitorTasks(new Map());
    expect(tasks).toEqual([]);
  });
});

// ════════════════════════════════════════════════════════════
// 6. 端到端集成：独立模式 → 编排模式切换
// ════════════════════════════════════════════════════════════

describe('独立模式 ↔ 编排模式切换', () => {
  beforeEach(() => {
    useTaskStore.getState().reset();
  });

  it('从独立模式切换到编排模式后行为正确', async () => {
    const ceo = new CEOAgent({ maxIterations: 2 });
    const mockExecutor = createMockExecutor();

    // Step 1: 独立模式执行
    const decomposer = new LLMDecomposer({ llmAvailable: false });
    ceo.setDecomposer(decomposer);

    expect(ceo.hasOrchestrationFlow()).toBe(false);

    const report1 = await ceo.processWithDecomposer('Feature A', mockExecutor);
    expect(report1).toBeDefined();

    // 独立模式下，DAG 节点由 WebSocket 事件系统创建
    // 单元测试中（无 WebSocket），CEOAgent 仅创建 ceo-summary 节点
    const nodes1 = useTaskStore.getState().nodes;
    expect(nodes1.get('ceo-summary')).toBeDefined();

    // Step 2: 切换到编排模式
    useTaskStore.getState().reset();
    ceo.setOrchestrationFlow(createSampleFlowDefinition('sequential'));

    expect(ceo.hasOrchestrationFlow()).toBe(true);

    const report2 = await ceo.processWithDecomposer('Feature B', mockExecutor);
    expect(report2).toBeDefined();

    // 编排模式下，注入 orchestration source 的拓扑节点
    // execution source 节点由 WebSocket 事件系统处理
    const nodes2 = useTaskStore.getState().nodes;
    const orchNodes = Array.from(nodes2.values()).filter(
      n => n.source === 'orchestration'
    );
    expect(orchNodes.length).toBeGreaterThan(0);
    // ceo-summary 也应存在
    expect(nodes2.get('ceo-summary')).toBeDefined();
  });

  it('清除编排拓扑后回到独立模式', async () => {
    const ceo = new CEOAgent({ maxIterations: 2 });
    const mockExecutor = createMockExecutor();
    const decomposer = new LLMDecomposer({ llmAvailable: false });
    ceo.setDecomposer(decomposer);

    // 先设置编排
    ceo.setOrchestrationFlow(createSampleFlowDefinition());
    expect(ceo.hasOrchestrationFlow()).toBe(true);

    // 清除编排
    ceo.clearOrchestrationFlow();
    expect(ceo.hasOrchestrationFlow()).toBe(false);

    // 回到独立模式 — processWithDecomposer 不走编排路径
    useTaskStore.getState().reset();
    const report = await ceo.processWithDecomposer('Build feature', mockExecutor);
    expect(report).toBeDefined();

    // 独立模式也创建规划拓扑节点（'plan-' 前缀, source='orchestration'）
    // 这是 CEO 分解方案的可视化，与编排模式的区别是不走 executeWithOrchestration 路径
    const nodes = useTaskStore.getState().nodes;
    const orchNodes = Array.from(nodes.values()).filter(
      n => n.source === 'orchestration'
    );
    // 独立模式下应有规划节点，且 id 以 'plan-' 开头
    expect(orchNodes.length).toBeGreaterThan(0);
    for (const n of orchNodes) {
      expect(n.id.startsWith('plan-')).toBe(true);
    }
  });
});
