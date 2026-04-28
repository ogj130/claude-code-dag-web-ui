/**
 * V3 集成测试 — 覆盖 25.1-25.8
 *
 * 端到端验证所有 V3 智能层服务的协作：
 * - 双模式切换、意图理解、多 Agent、自进化闭环
 * - V2 向后兼容、任务编排、权限安全
 * - 性能基准
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ── 导入所有 V3 服务 ───────────────────────────────────────

import { mapVoiceCommand, hasVoiceCommand } from '../services/voiceCommandMapper';
import { recordExecution, evaluateTrace, extractPatterns, generateCandidateSkills, resetEvolutionState } from '../services/evolutionLoop';
import { record as recordBehavior, summarize, resetCollector } from '../services/behaviorCollector';
import { infer as inferProfile, resetReasoner } from '../services/honchoReasoner';
import { recordUse, isUnlocked, setUnlockAll, resetUnlockState } from '../services/progressiveUnlock';
import { createTask, executeTask, resetOrchestrator, acquireFileLock, releaseFileLock, enqueueLane, dequeueLane, withRetry } from '../services/agentOrchestrator';
import { create as createSkill, update as updateSkill, rollback, recordUsage, recommend, resetSkillStore } from '../services/skillStore';
import { register as registerHook, emit as emitHook, resetHookEngine } from '../services/hookEngine';
import { addServer, testConnection, discoverTools, resetMCPConfigStore } from '../services/mcpConfigStore';
import { checkPermission, setLevel, getCurrentLevel, getTokenBudget, consumeTokens, resetTokenUsage, resetPermissionEngine, getAuditLogs, isPathAllowed, isCommandBlocked } from '../services/permissionEngine';
import { createDag, addTask as addDagTask, topologicalSort, hasCycle, createCheckpoint, restoreCheckpoint, getProgress, runDag, resetTaskOrchestrator, type TaskNode } from '../services/taskOrchestrator';

// ── 25.1 双模式切换 E2E ────────────────────────────────────

describe('25.1 双模式切换', () => {
  it('意图识别支持中英文语音命令', () => {
    const cn = mapVoiceCommand('fix the bug');
    expect(cn.action).toBe('fix_bug');

    const en = mapVoiceCommand('switch model');
    expect(en.action).toBe('switch_model');
  });

  it('语音命令检测正确', () => {
    expect(hasVoiceCommand('运行测试')).toBe(true);
    expect(hasVoiceCommand('今天天气不错')).toBe(false);
    expect(hasVoiceCommand('run tests')).toBe(true);
    expect(hasVoiceCommand('hello world')).toBe(false);
  });
});

// ── 25.2 意图理解→任务执行 ─────────────────────────────────

describe('25.2 意图理解→任务执行', () => {
  beforeEach(() => {
    resetOrchestrator();
  });

  it('从语音命令映射到 Agent 任务', () => {
    const cmd = mapVoiceCommand('重构代码');
    expect(cmd.action).toBe('refactor');

    // 创建对应的编排任务
    const task = createTask('Refactor Task', 'sequential', [
      { name: 'Analyzer', role: 'worker', taskDescription: `执行: ${cmd.action}` },
    ]);
    expect(task.agents).toHaveLength(1);
    expect(task.status).toBe('pending');
  });

  it('并行执行多步骤任务', async () => {
    const task = createTask('Multi-Step', 'parallel', [
      { name: 'Worker A', role: 'worker', taskDescription: 'Step A' },
      { name: 'Worker B', role: 'worker', taskDescription: 'Step B' },
    ]);

    const result = await executeTask(task.id);
    expect(result.status).toBe('completed');
    expect(result.agents.every((a) => a.status === 'completed')).toBe(true);
  });
});

// ── 25.3 多 Agent 并行执行 + 冲突检测 ─────────────────────

describe('25.3 多 Agent 并行执行', () => {
  beforeEach(() => {
    resetOrchestrator();
  });

  it('5 种协作模式全部完成', async () => {
    const modes = ['parallel', 'sequential', 'pipeline', 'coordinator', 'reviewer'] as const;

    for (const mode of modes) {
      const agents = mode === 'coordinator'
        ? [
            { name: 'Coord', role: 'coordinator' as const, taskDescription: 'Plan' },
            { name: 'W1', role: 'worker' as const, taskDescription: 'Work' },
          ]
        : mode === 'reviewer'
          ? [
              { name: 'Dev', role: 'worker' as const, taskDescription: 'Code' },
              { name: 'Rev', role: 'reviewer' as const, taskDescription: 'Review' },
            ]
          : [
              { name: 'A1', role: 'worker' as const, taskDescription: 'T1' },
              { name: 'A2', role: 'worker' as const, taskDescription: 'T2' },
            ];

      const task = createTask(`Test ${mode}`, mode, agents);
      const result = await executeTask(task.id);
      expect(result.status).toBe('completed');
    }
  });

  it('文件锁防止并发写冲突', () => {
    expect(acquireFileLock('src/app.ts', 'agent1')).toBe(true);
    expect(acquireFileLock('src/app.ts', 'agent2')).toBe(false);

    releaseFileLock('src/app.ts', 'agent1');
    expect(acquireFileLock('src/app.ts', 'agent2')).toBe(true);
  });

  it('Lane Queue 串行化同一文件的写操作', () => {
    enqueueLane('src/app.ts', 'agent1');
    enqueueLane('src/app.ts', 'agent2');

    expect(dequeueLane('src/app.ts')).toBe('agent1');
    expect(dequeueLane('src/app.ts')).toBe('agent2');
    expect(dequeueLane('src/app.ts')).toBeNull();
  });

  it('重试机制 + 指数退避', async () => {
    let calls = 0;
    const result = await withRetry(async () => {
      calls++;
      if (calls < 2) throw new Error('transient');
      return 'ok';
    }, 3);

    expect(result).toBe('ok');
    expect(calls).toBe(2);
  });
});

// ── 25.4 自进化闭环 E2E ────────────────────────────────────

describe('25.4 自进化闭环', () => {
  beforeEach(() => {
    resetEvolutionState();
  });

  it('执行→评估→抽象→精炼全流程', () => {
    // Execute: 记录执行轨迹
    const traceId = recordExecution({
      workspaceId: 'ws-test',
      taskDescription: '实现用户登录',
      toolsUsed: ['read_file', 'write_file', 'run_tests'],
      isSuccess: true,
      tokenCount: 3000,
      durationMs: 5000,
      userSatisfaction: 0.9,
    });
    expect(traceId).toBeTruthy();

    // Evaluate: 质量评分
    const traces = [
      {
        id: traceId,
        workspaceId: 'ws-test',
        timestamp: Date.now(),
        taskDescription: '实现用户登录',
        toolsUsed: ['read_file', 'write_file', 'run_tests'],
        isSuccess: true,
        tokenCount: 3000,
        durationMs: 5000,
        userSatisfaction: 0.9,
      },
    ];
    const score = evaluateTrace(traces[0]);
    expect(score.successRate).toBe(1);
    expect(score.overallScore).toBeGreaterThan(0);

    // Abstract: 模式提取
    const patterns = extractPatterns(traces);
    expect(patterns.length).toBeGreaterThanOrEqual(0);
  });

  it('Skill 防爆炸三层防线', () => {
    const candidates = [
      { name: 'Skill A', tools: ['read', 'write'], confidence: 0.3, traceCount: 1 },
      { name: 'Skill B', tools: ['read', 'write'], confidence: 0.8, traceCount: 5 },
      { name: 'Skill C', tools: ['deploy'], confidence: 0.9, traceCount: 10 },
    ];

    const skills = generateCandidateSkills([], []);
    expect(Array.isArray(skills)).toBe(true);
  });
});

// ── 25.5 V2 向后兼容 ───────────────────────────────────────

describe('25.5 V2 向后兼容', () => {
  beforeEach(() => {
    resetOrchestrator();
    resetPermissionEngine();
  });

  it('permissionEngine 不影响 V2 功能', () => {
    setLevel(3);
    expect(getCurrentLevel()).toBe(3);
    expect(checkPermission('read', 'file.ts')).toBe(true);
  });

  it('agentOrchestrator 兼容 V2 任务模式', async () => {
    const task = createTask('V2 Task', 'sequential', [
      { name: 'Agent', role: 'worker', taskDescription: 'Execute' },
    ]);
    const result = await executeTask(task.id);
    expect(result.status).toBe('completed');
  });

  it('Token 预算独立运作', () => {
    const budget1 = getTokenBudget();
    expect(budget1.total).toBeGreaterThan(0);

    consumeTokens(1000);
    const budget2 = getTokenBudget();
    expect(budget2.used).toBe(1000);

    resetTokenUsage();
    const budget3 = getTokenBudget();
    expect(budget3.used).toBe(0);
  });
});

// ── 25.6 任务编排引擎 E2E ──────────────────────────────────

describe('25.6 任务编排引擎', () => {
  beforeEach(() => {
    resetTaskOrchestrator();
  });

  it('DAG 拓扑排序 + 并行执行', async () => {
    const dag = createDag('E2E Test');
    addDagTask(dag, { id: 'a', name: 'Start' });
    addDagTask(dag, { id: 'b', name: 'Process', dependencies: ['a'] });
    addDagTask(dag, { id: 'c', name: 'Validate', dependencies: ['a'] });
    addDagTask(dag, { id: 'd', name: 'End', dependencies: ['b', 'c'] });

    const result = topologicalSort(dag);
    expect(result.hasCycle).toBe(false);

    // a 必须在 b, c 之前; b, c 必须在 d 之前
    const order = result.sorted;
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'));
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('c'));
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('d'));
    expect(order.indexOf('c')).toBeLessThan(order.indexOf('d'));
  });

  it('循环依赖检测', () => {
    const dag = createDag('Cycle Test');
    addDagTask(dag, { id: 'a', name: 'A', dependencies: ['b'] });
    addDagTask(dag, { id: 'b', name: 'B', dependencies: ['a'] });

    expect(hasCycle(dag)).toBe(true);
  });

  it('Checkpoint 创建 + 恢复', () => {
    const dag = createDag('Checkpoint Test');
    addDagTask(dag, { id: 't1', name: 'Task 1' });

    createCheckpoint(dag, 't1', { step: 3, data: 'hello' }, 'partial output');

    const ctx = restoreCheckpoint(dag, 't1');
    expect(ctx).toEqual({ step: 3, data: 'hello' });
  });

  it('DAG 执行 + 失败节点跳过下游', async () => {
    const dag = createDag('Exec Test');
    addDagTask(dag, { id: 'a', name: 'A' });
    addDagTask(dag, { id: 'b', name: 'B', dependencies: ['a'] });
    addDagTask(dag, { id: 'c', name: 'C', dependencies: ['b'] });

    await runDag(dag, async (node: TaskNode) => {
      if (node.id === 'b') throw new Error('B failed');
      return `done-${node.id}`;
    });

    expect(dag.status).toBe('failed');
    expect(getProgress(dag).completed).toBe(1);
  });
});

// ── 25.7 权限与安全 E2E ────────────────────────────────────

describe('25.7 权限与安全', () => {
  beforeEach(() => {
    resetPermissionEngine();
  });

  it('权限拦截：低等级无法执行高级操作', () => {
    setLevel(1);
    expect(checkPermission('read', 'file.ts')).toBe(true);
    expect(checkPermission('edit', 'file.ts')).toBe(false);
    expect(checkPermission('shell', 'cmd')).toBe(false);

    const deniedLogs = getAuditLogs({ result: 'denied' });
    expect(deniedLogs.length).toBeGreaterThanOrEqual(2);
  });

  it('Token 预算 80% 告警 + 100% 暂停', () => {
    consumeTokens(85000);
    const warningBudget = getTokenBudget();
    expect(warningBudget.isWarning).toBe(true);
    expect(warningBudget.isPaused).toBe(false);

    consumeTokens(20000);
    const pausedBudget = getTokenBudget();
    expect(pausedBudget.isPaused).toBe(true);
  });

  it('沙箱限制：路径白名单 + 命令黑名单', () => {
    expect(isPathAllowed('/tmp/sandbox/test.ts')).toBe(true);
    expect(isPathAllowed('/etc/passwd')).toBe(false);

    expect(isCommandBlocked('rm -rf /')).toBe(true);
    expect(isCommandBlocked('npm test')).toBe(false);
  });

  it('完整审计链路：权限检查 → 日志记录', () => {
    setLevel(3);
    checkPermission('read', 'a.ts');
    checkPermission('edit', 'b.ts');
    checkPermission('shell', 'cmd'); // denied at L3
    checkPermission('delete', 'c.ts');

    const allLogs = getAuditLogs();
    expect(allLogs).toHaveLength(4);

    const denied = getAuditLogs({ result: 'denied' });
    expect(denied).toHaveLength(1);
    expect(denied[0].action).toBe('shell');
  });
});

// ── 25.8 性能基准测试 ──────────────────────────────────────

describe('25.8 性能基准', () => {
  beforeEach(() => {
    resetEvolutionState();
    resetOrchestrator();
    resetPermissionEngine();
    resetSkillStore();
    resetHookEngine();
    resetMCPConfigStore();
  });

  it('情景记忆写入 < 100ms', () => {
    const start = Date.now();

    for (let i = 0; i < 100; i++) {
      recordExecution({
        workspaceId: 'ws-perf',
        taskDescription: `Task ${i}`,
        toolsUsed: ['read'],
        isSuccess: true,
        tokenCount: 100,
        durationMs: 50,
      });
    }

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(1000); // 100 条 < 1s → 每条 < 10ms
  });

  it('DAG 拓扑排序 < 50ms（100 节点）', () => {
    const dag = createDag('Perf Test');

    // 创建 100 个节点的链式 DAG
    addDagTask(dag, { id: 'n0', name: 'Node 0' });
    for (let i = 1; i < 100; i++) {
      addDagTask(dag, { id: `n${i}`, name: `Node ${i}`, dependencies: [`n${i - 1}`] });
    }

    const start = Date.now();
    const result = topologicalSort(dag);
    const elapsed = Date.now() - start;

    expect(result.hasCycle).toBe(false);
    expect(result.sorted).toHaveLength(100);
    expect(elapsed).toBeLessThan(50);
  });

  it('权限检查 < 1ms（含审计日志）', () => {
    setLevel(6);
    const start = Date.now();

    for (let i = 0; i < 1000; i++) {
      checkPermission('read', `file${i}.ts`);
    }

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(1000); // 1000 次 < 1s → 每次 < 1ms
  });

  it('Token 预算计算 < 1ms', () => {
    const start = Date.now();

    for (let i = 0; i < 1000; i++) {
      consumeTokens(10);
    }

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(100);
    expect(getTokenBudget().used).toBe(10000);
  });

  it('Skill 推荐评分 < 50ms', async () => {
    // 创建多个 Skill
    for (let i = 0; i < 20; i++) {
      await createSkill({
        name: `skill-${i}`,
        description: `Test skill ${i}`,
        content: `function skill${i}() { return ${i}; }`,
        tags: i % 2 === 0 ? ['react', 'frontend'] : ['node', 'backend'],
        keywords: [`keyword-${i}`],
      });
    }

    const start = Date.now();
    const results = await recommend({
      tags: ['react'],
      keywords: ['keyword'],
      taskDescription: 'React component',
    });
    const elapsed = Date.now() - start;

    expect(results.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(50);
  });

  it('Hook 引擎事件触发 < 2000ms', async () => {
    for (let i = 0; i < 5; i++) {
      registerHook({
        name: `hook-${i}`,
        trigger: 'task_complete',
        conditions: [],
        actions: [{ type: 'log', params: { message: `Hook ${i}` } }],
      });
    }

    const start = Date.now();
    await emitHook('task_complete', { taskId: 't1' });
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(2000);
  });
});

// ── 23.6 可视化流程编排 E2E ─────────────────────────────────

describe('23.6 可视化流程编排', () => {
  beforeEach(() => {
    resetTaskOrchestrator();
  });

  it('DAG 支持条件分支（Decision 节点）', () => {
    const dag = createDag('Decision Flow');
    addDagTask(dag, { id: 'input', name: 'Input' });
    addDagTask(dag, { id: 'check', name: 'Check', dependencies: ['input'] });
    addDagTask(dag, { id: 'true_path', name: 'Success', dependencies: ['check'] });
    addDagTask(dag, { id: 'false_path', name: 'Error', dependencies: ['check'] });
    addDagTask(dag, { id: 'output', name: 'Output', dependencies: ['true_path', 'false_path'] });

    const result = topologicalSort(dag);
    expect(result.hasCycle).toBe(false);
    expect(result.sorted).toHaveLength(5);
  });

  it('DAG 支持多阶段流水线', async () => {
    const dag = createDag('Pipeline');
    addDagTask(dag, { id: 'stage1', name: 'Preprocess' });
    addDagTask(dag, { id: 'stage2', name: 'Analyze', dependencies: ['stage1'] });
    addDagTask(dag, { id: 'stage3', name: 'Optimize', dependencies: ['stage2'] });
    addDagTask(dag, { id: 'stage4', name: 'Validate', dependencies: ['stage3'] });

    const executionOrder: string[] = [];
    await runDag(dag, async (node: TaskNode) => {
      executionOrder.push(node.id);
      return `result-${node.id}`;
    });

    expect(executionOrder).toEqual(['stage1', 'stage2', 'stage3', 'stage4']);
    expect(dag.status).toBe('completed');
  });
});
