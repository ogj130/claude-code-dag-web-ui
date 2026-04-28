/**
 * agentOrchestrator 集成测试
 *
 * 覆盖：5 种协作模式、文件锁、Lane Queue、重试机制
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTask,
  executeTask,
  getTask,
  getAllTasks,
  acquireFileLock,
  releaseFileLock,
  getFileLockStatus,
  enqueueLane,
  dequeueLane,
  withRetry,
  resetOrchestrator,
  type CollaborationMode,
} from '../services/agentOrchestrator';

describe('agentOrchestrator', () => {
  beforeEach(() => {
    resetOrchestrator();
  });

  // ── 任务创建 ─────────────────────────────────────────────

  describe('createTask', () => {
    it('创建任务并分配 Agent', () => {
      const task = createTask('Test Task', 'parallel', [
        { name: 'Worker 1', role: 'worker', taskDescription: 'Do something' },
        { name: 'Worker 2', role: 'worker', taskDescription: 'Do else' },
      ]);

      expect(task.id).toBeTruthy();
      expect(task.agents).toHaveLength(2);
      expect(task.status).toBe('pending');
      expect(task.mode).toBe('parallel');
    });

    it('getTask 返回创建的任务', () => {
      const task = createTask('T', 'sequential', [
        { name: 'A', role: 'worker', taskDescription: '' },
      ]);

      expect(getTask(task.id)).not.toBeNull();
    });

    it('getAllTasks 返回所有任务', () => {
      createTask('T1', 'parallel', [{ name: 'A', role: 'worker', taskDescription: '' }]);
      createTask('T2', 'sequential', [{ name: 'B', role: 'worker', taskDescription: '' }]);

      expect(getAllTasks()).toHaveLength(2);
    });
  });

  // ── 协作模式 ─────────────────────────────────────────────

  describe('executeTask', () => {
    const modes: CollaborationMode[] = ['parallel', 'sequential', 'pipeline', 'coordinator', 'reviewer'];

    modes.forEach((mode) => {
      it(`${mode} 模式执行完成`, async () => {
        const agents = mode === 'coordinator'
          ? [
              { name: 'Coordinator', role: 'coordinator' as const, taskDescription: 'Plan' },
              { name: 'Worker A', role: 'worker' as const, taskDescription: 'Task A' },
              { name: 'Worker B', role: 'worker' as const, taskDescription: 'Task B' },
            ]
          : mode === 'reviewer'
            ? [
                { name: 'Worker', role: 'worker' as const, taskDescription: 'Code' },
                { name: 'Reviewer', role: 'reviewer' as const, taskDescription: 'Review' },
              ]
            : [
                { name: 'Agent 1', role: 'worker' as const, taskDescription: 'Step 1' },
                { name: 'Agent 2', role: 'worker' as const, taskDescription: 'Step 2' },
              ];

        const task = createTask(`Test ${mode}`, mode, agents);
        const result = await executeTask(task.id);

        expect(result.status).toBe('completed');
        expect(result.totalTokens).toBeGreaterThan(0);
        expect(result.agents.every((a) => a.status === 'completed')).toBe(true);
      });
    });

    it('pipeline 模式传递输出', async () => {
      const task = createTask('Pipeline Test', 'pipeline', [
        { name: 'Step 1', role: 'worker', taskDescription: 'Generate' },
        { name: 'Step 2', role: 'worker', taskDescription: 'Process' },
      ]);

      const result = await executeTask(task.id);
      expect(result.status).toBe('completed');

      // Step 2 应该收到 Step 1 的输出
      const step2 = result.agents[1];
      expect(step2.result).toContain('input:');
    });
  });

  // ── 文件锁 ───────────────────────────────────────────────

  describe('file locks', () => {
    it('获取和释放文件锁', () => {
      expect(acquireFileLock('src/app.ts', 'agent1')).toBe(true);
      expect(acquireFileLock('src/app.ts', 'agent2')).toBe(false);
      expect(getFileLockStatus()).toHaveLength(1);

      releaseFileLock('src/app.ts', 'agent1');
      expect(acquireFileLock('src/app.ts', 'agent2')).toBe(true);
    });

    it('同一 Agent 可重复获取', () => {
      expect(acquireFileLock('src/app.ts', 'agent1')).toBe(true);
      expect(acquireFileLock('src/app.ts', 'agent1')).toBe(true);
    });

    it('释放非持有的锁无效果', () => {
      acquireFileLock('src/app.ts', 'agent1');
      releaseFileLock('src/app.ts', 'agent2'); // 无效释放
      expect(getFileLockStatus()).toHaveLength(1);
    });
  });

  // ── Lane Queue ───────────────────────────────────────────

  describe('lane queue', () => {
    it('入队和出队', () => {
      enqueueLane('src/app.ts', 'agent1');
      enqueueLane('src/app.ts', 'agent2');

      expect(dequeueLane('src/app.ts')).toBe('agent1');
      expect(dequeueLane('src/app.ts')).toBe('agent2');
      expect(dequeueLane('src/app.ts')).toBeNull();
    });

    it('空队列出队返回 null', () => {
      expect(dequeueLane('empty')).toBeNull();
    });
  });

  // ── 重试机制 ─────────────────────────────────────────────

  describe('withRetry', () => {
    it('成功时不重试', async () => {
      let calls = 0;
      const result = await withRetry(async () => {
        calls++;
        return 'ok';
      });
      expect(result).toBe('ok');
      expect(calls).toBe(1);
    });

    it('失败后重试直到成功', async () => {
      let calls = 0;
      const result = await withRetry(async () => {
        calls++;
        if (calls < 3) throw new Error('fail');
        return 'ok';
      }, 3);
      expect(result).toBe('ok');
      expect(calls).toBe(3);
    });

    it('超过重试次数抛出错误', async () => {
      await expect(
        withRetry(async () => {
          throw new Error('always fail');
        }, 1)
      ).rejects.toThrow('always fail');
    });
  });
});
