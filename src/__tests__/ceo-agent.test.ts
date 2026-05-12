/**
 * CEO Agent 单元测试
 *
 * 覆盖：目标分解、任务调度、结果收集、目标验证、迭代循环
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CEOAgent } from '../services/multi-agent/ceo-agent';
import { LLMDecomposer } from '../services/multi-agent/ceo-agent/LLMDecomposer';
import { RecoveryEngine } from '../services/multi-agent/ceo-agent/RecoveryEngine';
import { useTaskStore } from '@/stores/useTaskStore';
import type { WorkerExecutor, WorkerExecutorContext } from '../services/multi-agent/types';
import type { TaskResult } from '@/types/multi-agent/worker-agents';
import type { SkillRef } from '@/types/multi-agent/skill';

describe('CEOAgent', () => {
  let ceo: CEOAgent;

  // Mock executor for testing
  const createMockExecutor = (overrides?: Partial<TaskResult>): WorkerExecutor => ({
    execute: vi.fn().mockImplementation(async (_task: WorkerExecutorContext, _skills: SkillRef[]) => {
      return {
        taskId: _task.taskId,
        workerType: 'base',
        output: { message: 'Task completed successfully' },
        success: true,
        duration: 100,
        skillsUsed: [],
        subTasks: [],
        ...overrides,
      } as TaskResult;
    }),
  });

  beforeEach(() => {
    ceo = new CEOAgent({ maxIterations: 3, verificationThreshold: 0.8 });
    useTaskStore.getState().reset();
  });

  // ── 构造函数 ─────────────────────────────────────────

  describe('constructor', () => {
    it('使用默认配置创建实例', () => {
      const defaultCeo = new CEOAgent();
      expect(defaultCeo).toBeDefined();
    });

    it('使用自定义配置创建实例', () => {
      const customCeo = new CEOAgent({
        maxIterations: 5,
        verificationThreshold: 0.9,
      });
      expect(customCeo).toBeDefined();
    });
  });

  // ── process ───────────────────────────────────────────

  describe('process', () => {
    it('处理简单需求并返回执行报告', async () => {
      const mockExecutor = createMockExecutor();
      const report = await ceo.process('Build a user auth system', mockExecutor);

      expect(report).toBeDefined();
      expect(report.summary).toBeTruthy();
      expect(report.iterations).toBeDefined();
      expect(Array.isArray(report.iterations)).toBe(true);
      expect(report.totalDuration).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(report.completedGoals)).toBe(true);
      expect(Array.isArray(report.missedGoals)).toBe(true);
      expect(Array.isArray(report.taskResults)).toBe(true);
      expect(Array.isArray(report.skillsUsed)).toBe(true);
    });

    it('需求包含认证关键词时正常处理', async () => {
      const mockExecutor = createMockExecutor();
      const report = await ceo.process('Build auth system', mockExecutor);

      expect(report.originalRequirement).toBe('Build auth system');
    });

    it('需求包含 API 关键词时正常处理', async () => {
      const mockExecutor = createMockExecutor();
      const report = await ceo.process('Create API endpoint', mockExecutor);

      expect(report).toBeDefined();
    });

    it('包含测试关键词时添加测试验证标准', async () => {
      const mockExecutor = createMockExecutor();
      const report = await ceo.process('Build and test user module', mockExecutor);

      // 测试关键词会添加 tests_pass 验证标准
      const allGoals = [...report.completedGoals, ...report.missedGoals];
      const hasTestCriteria = allGoals.some((g) =>
        g.verificationCriteria.includes('tests_pass')
      );
      expect(hasTestCriteria).toBe(true);
    });

    it('包含错误处理关键词时正常处理', async () => {
      const mockExecutor = createMockExecutor();
      const report = await ceo.process('Build service with error handling', mockExecutor);

      // 错误处理关键词会添加默认验证标准
      const allGoals = [...report.completedGoals, ...report.missedGoals];
      // 每个目标至少有默认的 task_completed 标准
      const hasDefaultCriteria = allGoals.every((g) =>
        g.verificationCriteria.includes('task_completed')
      );
      expect(hasDefaultCriteria).toBe(true);
    });

    it('executor 被正确调用', async () => {
      const mockExecutor = createMockExecutor();
      await ceo.process('Build system', mockExecutor);

      expect(mockExecutor.execute).toHaveBeenCalled();
    });

    it('executor 返回失败结果时处理正确', async () => {
      const mockExecutor = createMockExecutor({ success: false, error: 'Task failed' });
      const report = await ceo.process('Build system', mockExecutor);

      expect(report).toBeDefined();
      expect(report.taskResults.some(r => !r.success)).toBe(true);
    });
  });

  // ── 目标分解 ─────────────────────────────────────────

  describe('goal decomposition', () => {
    it('分解需求为多个子目标', async () => {
      const mockExecutor = createMockExecutor();
      const report = await ceo.process('Build user management system', mockExecutor);

      const totalGoals = report.completedGoals.length + report.missedGoals.length;
      expect(totalGoals).toBeGreaterThan(0);
    });

    it('目标包含验证标准', async () => {
      const mockExecutor = createMockExecutor();
      const report = await ceo.process('Build authentication system', mockExecutor);

      // 至少有一个目标有验证标准
      const allGoals = [...report.completedGoals, ...report.missedGoals];
      const hasCriteria = allGoals.some((g) => g.verificationCriteria.length > 0);

      expect(hasCriteria).toBe(true);
    });

    it('隐含目标有正确的验证标准', async () => {
      const mockExecutor = createMockExecutor();
      const report = await ceo.process('Build and test feature', mockExecutor);

      const allGoals = [...report.completedGoals, ...report.missedGoals];
      const testGoal = allGoals.find((g) => g.description.includes('测试'));

      if (testGoal) {
        expect(testGoal.verificationCriteria.length).toBeGreaterThan(0);
      }
    });
  });

  // ── 迭代循环 ─────────────────────────────────────────

  describe('iteration loop', () => {
    it('默认最多迭代 3 次', async () => {
      const mockExecutor = createMockExecutor();
      const report = await ceo.process('Build complex system', mockExecutor);

      expect(report.totalIterations).toBeLessThanOrEqual(3);
    });

    it('自定义最大迭代次数', async () => {
      const customCeo = new CEOAgent({ maxIterations: 1 });
      const mockExecutor = createMockExecutor();
      const report = await customCeo.process('Simple task', mockExecutor);

      expect(report.totalIterations).toBeLessThanOrEqual(1);
    });

    it('迭代次数计入报告', async () => {
      const mockExecutor = createMockExecutor();
      const report = await ceo.process('Build system', mockExecutor);

      expect(typeof report.totalIterations).toBe('number');
      expect(report.totalIterations).toBeGreaterThan(0);
    });

    it('iterations 数组长度与 totalIterations 一致', async () => {
      const mockExecutor = createMockExecutor();
      const report = await ceo.process('Build system', mockExecutor);

      expect(report.iterations.length).toBe(report.totalIterations);
    });
  });

  // ── 目标验证 ─────────────────────────────────────────

  describe('goal verification', () => {
    it('返回 completedGoals 和 missedGoals', async () => {
      const mockExecutor = createMockExecutor();
      const report = await ceo.process('Build feature', mockExecutor);

      expect(Array.isArray(report.completedGoals)).toBe(true);
      expect(Array.isArray(report.missedGoals)).toBe(true);
    });

    it('completedGoals 中的目标 verified 为 true', async () => {
      const mockExecutor = createMockExecutor();
      const report = await ceo.process('Build simple feature', mockExecutor);

      for (const goal of report.completedGoals) {
        expect(goal.verified).toBe(true);
      }
    });

    it('missedGoals 中的目标 verified 为 false', async () => {
      const mockExecutor = createMockExecutor();
      const report = await ceo.process('Build feature', mockExecutor);

      for (const goal of report.missedGoals) {
        expect(goal.verified).toBe(false);
      }
    });
  });

  // ── 执行报告 ─────────────────────────────────────────

  describe('ExecutionReport', () => {
    it('包含 summary 字段', async () => {
      const mockExecutor = createMockExecutor();
      const report = await ceo.process('Build system', mockExecutor);

      expect(report.summary).toBeTruthy();
      expect(typeof report.summary).toBe('string');
      expect(report.summary.length).toBeGreaterThan(0);
    });

    it('包含 originalRequirement 字段', async () => {
      const mockExecutor = createMockExecutor();
      const report = await ceo.process('Build system', mockExecutor);

      expect(report.originalRequirement).toBe('Build system');
    });

    it('包含 totalDuration 字段', async () => {
      const mockExecutor = createMockExecutor();
      const report = await ceo.process('Build system', mockExecutor);

      expect(typeof report.totalDuration).toBe('number');
      expect(report.totalDuration).toBeGreaterThanOrEqual(0);
    });

    it('包含 partialCompletion 字段', async () => {
      const mockExecutor = createMockExecutor();
      const report = await ceo.process('Build system', mockExecutor);

      expect(typeof report.partialCompletion).toBe('boolean');
    });

    it('包含 timestamp 字段', async () => {
      const mockExecutor = createMockExecutor();
      const report = await ceo.process('Build system', mockExecutor);

      expect(typeof report.timestamp).toBe('number');
      expect(report.timestamp).toBeGreaterThan(0);
    });

    it('包含 skillsUsed 列表', async () => {
      const mockExecutor = createMockExecutor();
      const report = await ceo.process('Build system', mockExecutor);

      expect(Array.isArray(report.skillsUsed)).toBe(true);
    });

    it('包含 taskResults 列表', async () => {
      const mockExecutor = createMockExecutor();
      const report = await ceo.process('Build system', mockExecutor);

      expect(Array.isArray(report.taskResults)).toBe(true);
    });

    it('TaskResult 包含必要字段', async () => {
      const mockExecutor = createMockExecutor();
      const report = await ceo.process('Build system', mockExecutor);

      for (const result of report.taskResults) {
        expect(result.taskId).toBeTruthy();
        expect(result.workerType).toBeTruthy();
        expect(typeof result.success).toBe('boolean');
        expect(typeof result.duration).toBe('number');
        expect(Array.isArray(result.skillsUsed)).toBe(true);
        expect(Array.isArray(result.subTasks)).toBe(true);
      }
    });
  });

  // ── 回调函数 ─────────────────────────────────────────

  describe('callbacks', () => {
    it('onTaskStart 回调被调用', async () => {
      const mockExecutor = createMockExecutor();
      const onTaskStart = vi.fn();
      const onTaskComplete = vi.fn();

      await ceo.process('Build system', mockExecutor, {
        onTaskStart,
        onTaskComplete,
      });

      // 回调应该被调用（至少对于启动的任务）
      expect(onTaskStart).toHaveBeenCalled();
    });

    it('onTaskComplete 回调被调用', async () => {
      const mockExecutor = createMockExecutor();
      const onTaskComplete = vi.fn();

      await ceo.process('Build system', mockExecutor, {
        onTaskComplete,
      });

      // 回调应该被调用（至少对于完成的任务）
      expect(onTaskComplete).toHaveBeenCalled();
    });
  });

  // ── 边界情况 ─────────────────────────────────────────

  describe('edge cases', () => {
    it('处理空需求', async () => {
      const mockExecutor = createMockExecutor();
      const report = await ceo.process('', mockExecutor);

      expect(report).toBeDefined();
      // 空需求会被 split 处理，但 filter 会过滤掉空字符串，结果是 0 个 goal
      // 但循环仍会执行一次迭代（因为 while 条件先检查 iteration < maxIterations）
      // 所以 totalIterations 至少为 1
      expect(report.totalIterations).toBeGreaterThanOrEqual(1);
    });

    it('处理极短需求', async () => {
      const mockExecutor = createMockExecutor();
      const report = await ceo.process('test', mockExecutor);

      expect(report).toBeDefined();
    });

    it('处理超长需求', async () => {
      const mockExecutor = createMockExecutor();
      const longRequirement = 'Build a ' + 'very '.repeat(100) + 'complex system';
      const report = await ceo.process(longRequirement, mockExecutor);

      expect(report).toBeDefined();
    });

    it('处理包含特殊字符的需求', async () => {
      const mockExecutor = createMockExecutor();
      const report = await ceo.process('Build system with @#$%^&*()', mockExecutor);

      expect(report).toBeDefined();
    });

    it('处理重复调用不互相干扰', async () => {
      const mockExecutor = createMockExecutor();
      const report1 = await ceo.process('Feature A', mockExecutor);
      const report2 = await ceo.process('Feature B', mockExecutor);

      expect(report1.totalIterations).toBeGreaterThan(0);
      expect(report2.totalIterations).toBeGreaterThan(0);
      // 两个报告应该是独立的
      expect(report1.originalRequirement).not.toBe(report2.originalRequirement);
    });
  });

  // ── 配置测试 ─────────────────────────────────────────

  describe('processWithDecomposer regressions', () => {
    it('执行完成后注入 ceo-summary DAG 节点', async () => {
      const mockExecutor = createMockExecutor();
      const decomposer = new LLMDecomposer({ llmAvailable: false });
      ceo.setDecomposer(decomposer);

      await ceo.processWithDecomposer('分析并实现一个功能', mockExecutor);

      const summaryNode = useTaskStore.getState().nodes.get('ceo-summary');
      expect(summaryNode).toBeDefined();
      expect(summaryNode?.type).toBe('summary');
      expect(summaryNode?.summaryContent).toBeTruthy();
      expect(summaryNode?.status).toBe('completed');
    });

    it('pipeline 模式下按依赖顺序执行 goal', async () => {
      const startOrder: string[] = [];
      const mockExecutor: WorkerExecutor = {
        execute: vi.fn().mockImplementation(async (task: WorkerExecutorContext) => {
          return {
            taskId: task.taskId,
            workerType: 'execution',
            output: { ok: true, taskId: task.taskId },
            success: true,
            duration: 10,
            skillsUsed: [],
            subTasks: [],
          } as TaskResult;
        }),
      };

      const decomposer = new LLMDecomposer({
        llmAvailable: true,
        llmCall: vi.fn().mockResolvedValue(JSON.stringify({
          agents: [
            {
              id: 'agent-context',
              type: 'context',
              name: 'ContextAgent',
              description: '分析上下文',
              dependsOn: [],
              priority: 1,
              verificationCriteria: ['project_structure_analyzed'],
            },
            {
              id: 'agent-execution',
              type: 'execution',
              name: 'ExecutionAgent',
              description: '执行实现',
              dependsOn: ['agent-context'],
              priority: 2,
              verificationCriteria: ['task_completed'],
            },
          ],
          strategy: 'pipeline',
          estimatedDuration: 3000,
        })),
      });
      ceo.setDecomposer(decomposer);

      await ceo.processWithDecomposer('实现一个流水线任务', mockExecutor, {
        onTaskStart: (taskId) => startOrder.push(taskId),
      });

      expect(startOrder).toEqual(['agent-context', 'agent-execution']);
    });
  });

  // ── 闭环功能回归 ─────────────────────────────────

  describe('skill-recovery-evolution closed-loop', () => {
    it('process() 委托到 processWithDecomposer() 并生成 summary 节点', async () => {
      const mockExecutor = createMockExecutor();
      const report = await ceo.process('Build system', mockExecutor);
      const summaryNode = useTaskStore.getState().nodes.get('ceo-summary');
      expect(summaryNode).toBeDefined();
      expect(summaryNode?.type).toBe('summary');
      expect(report).toBeDefined();
    });

    it('RecoveryEngine 在委托路径中处理失败任务', async () => {
      const mockExecutor = createMockExecutor({ success: false, error: 'Operation timed out after 30s' });
      const report = await ceo.process('Build system', mockExecutor);
      expect(report.summary).toBeTruthy();
      expect(report.taskResults.length).toBeGreaterThan(0);
    });

    it('ProblemDetector 集成不中断正常执行', async () => {
      const mockExecutor = createMockExecutor();
      const report = await ceo.processWithDecomposer(
        'Build a complex enterprise system with auth and data persistence',
        mockExecutor,
      );
      expect(report).toBeDefined();
      expect(report.summary).toBeTruthy();
    });
  });
});

// ── RecoveryEngine 单元诊断（合并自 ceo-agent-enhancement.test.ts）────

describe('RecoveryEngine', () => {
  const engine = new RecoveryEngine();

  describe('diagnose', () => {
    it('诊断 timeout 错误', () => {
      expect(engine.diagnose('ETIMEDOUT: connection timeout', 'execution')).toBe('timeout');
      expect(engine.diagnose('timeout after 30000ms', 'context')).toBe('timeout');
    });

    it('诊断 permission 错误', () => {
      expect(engine.diagnose('EACCES: permission denied', 'execution')).toBe('permission');
      expect(engine.diagnose('Permission denied: cannot write', 'planning')).toBe('permission');
    });

    it('诊断 syntax_error', () => {
      expect(engine.diagnose('SyntaxError: Unexpected token', 'execution')).toBe('syntax_error');
      expect(engine.diagnose('TypeError: undefined is not a function', 'execution')).toBe('syntax_error');
    });

    it('诊断 tool_error', () => {
      expect(engine.diagnose('command not found: git', 'execution')).toBe('tool_error');
      expect(engine.diagnose('tool execution failed', 'execution')).toBe('tool_error');
    });

    it('未知错误返回 unknown', () => {
      expect(engine.diagnose('something weird happened', 'execution')).toBe('unknown');
    });
  });

  describe('recover', () => {
    it('timeout → split 为子任务', () => {
      const action = engine.recover('timeout', {
        id: 'g1', description: '复杂任务', verified: false, verificationCriteria: [],
      }, { agents: [], strategy: 'parallel', estimatedDuration: 0 });
      expect(action.type).toBe('split');
    });

    it('permission → 换 ReviewAgent 重试', () => {
      const action = engine.recover('permission', {
        id: 'g1', description: '写文件', verified: false, verificationCriteria: [],
      }, { agents: [], strategy: 'parallel', estimatedDuration: 0 });
      expect(action.type).toBe('retry');
      if (action.type === 'retry') {
        expect(action.newAgentType).toBe('review');
      }
    });

    it('unknown → 标记 fail', () => {
      const action = engine.recover('unknown', {
        id: 'g1', description: '坏掉了', verified: false, verificationCriteria: [],
      }, { agents: [], strategy: 'parallel', estimatedDuration: 0 });
      expect(action.type).toBe('fail');
    });
  });
});

// ── LLMDecomposer 规则引擎降级测试（合并自 ceo-agent-enhancement.test.ts）────

describe('LLMDecomposer (规则引擎降级)', () => {
  const decomposer = new LLMDecomposer();

  it('规则引擎: 分析+设计+实现类需求 → pipeline 策略', () => {
    const plan = decomposer.decomposeWithRules('设计并实现一个用户认证系统，支持JWT');
    expect(plan.agents.length).toBeGreaterThanOrEqual(2);
    expect(plan.strategy).toBe('pipeline');
    const types = plan.agents.map(a => a.type);
    expect(types).toContain('planning');
    expect(types).toContain('execution');
  });

  it('规则引擎: 简单修复需求 → context+execution，跳过 planning', () => {
    const plan = decomposer.decomposeWithRules('修复登录页面的按钮样式');
    expect(plan.agents.some(a => a.type === 'execution')).toBe(true);
    expect(plan.agents.every(a => a.type !== 'planning')).toBe(true);
  });

  it('规则引擎: 纯分析需求 → context only', () => {
    const plan = decomposer.decomposeWithRules('分析当前项目的代码结构和技术债务');
    expect(plan.agents.length).toBeGreaterThan(0);
    expect(plan.agents[0].type).toBe('context');
  });

  it('规则引擎: 多关键词命中 → 计算加权得分排序', () => {
    const plan = decomposer.decomposeWithRules('分析并设计并实现并测试一个完整的REST API');
    const types = plan.agents.map(a => a.type);
    expect(types.indexOf('context')).toBeLessThan(types.indexOf('execution'));
  });

  it('规则引擎: 未知类型需求 → 至少返回 context + execution', () => {
    const plan = decomposer.decomposeWithRules('帮我看一下');
    expect(plan.agents.length).toBeGreaterThan(0);
  });

  it('decomposeWithRules 返回的 AgentPlan 结构合法', () => {
    const plan = decomposer.decomposeWithRules('设计一个数据库架构');
    for (const agent of plan.agents) {
      expect(agent.id).toBeTruthy();
      expect(agent.type).toBeTruthy();
      expect(agent.name).toBeTruthy();
      expect(agent.description).toBeTruthy();
      expect(Array.isArray(agent.dependsOn)).toBe(true);
      expect(typeof agent.priority).toBe('number');
      expect(Array.isArray(agent.verificationCriteria)).toBe(true);
    }
  });

  it('LLM 不可用标志 → 自动降级到规则引擎', async () => {
    const decomposerOffline = new LLMDecomposer({ llmAvailable: false });
    const plan = await decomposerOffline.decompose('设计认证系统');
    expect(plan).toBeDefined();
    expect(plan.agents.length).toBeGreaterThan(0);
  });
});

// ── CEOAgent 混合分解独有测试（合并自 ceo-agent-enhancement.test.ts）────

describe('CEOAgent with hybrid decomposition', () => {
  it('使用规则引擎分解需求', async () => {
    const decomposer = new LLMDecomposer({ llmAvailable: false });
    const plan = decomposer.decomposeWithRules('设计并实现用户认证系统');
    expect(plan.agents.length).toBeGreaterThanOrEqual(2);
  });

  it('processWithDecomposer 使用回调更新进度', async () => {
    const ceo = new CEOAgent({ maxIterations: 2 });
    const decomposer = new LLMDecomposer({ llmAvailable: false });
    ceo.setDecomposer(decomposer);
    const onTaskStart = vi.fn();
    const onTaskComplete = vi.fn();

    // 使用主文件中定义的 createMockExecutor 模式的 mock
    const mockExecutor: WorkerExecutor = {
      execute: vi.fn().mockImplementation(async (_task: WorkerExecutorContext, _skills: SkillRef[]) => ({
        taskId: _task.taskId,
        workerType: 'execution',
        output: { message: 'done' },
        success: true,
        duration: 100,
        skillsUsed: [],
        subTasks: [],
      } as TaskResult)),
    };

    const report = await ceo.processWithDecomposer('实现登录功能', mockExecutor, {
      onTaskStart,
      onTaskComplete,
    });

    expect(report).toBeDefined();
    expect(onTaskStart).toHaveBeenCalled();
    expect(onTaskComplete).toHaveBeenCalled();
  });
});
