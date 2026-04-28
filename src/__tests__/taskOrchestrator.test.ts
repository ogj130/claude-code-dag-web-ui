/**
 * taskOrchestrator 测试
 *
 * 覆盖：DAG 拓扑排序、循环检测、Checkpoint 创建/恢复、进度跟踪
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createDag,
  addTask,
  getTaskNode,
  topologicalSort,
  hasCycle,
  createCheckpoint,
  restoreCheckpoint,
  getCheckpoint,
  clearCheckpoint,
  updateProgress,
  getProgress,
  runDag,
  serializeDag,
  deserializeDag,
  persistDag,
  restoreDag,
  resetTaskOrchestrator,
  onDagUpdate,
  type DagGraph,
  type TaskNode,
} from '../services/taskOrchestrator';

describe('taskOrchestrator', () => {
  beforeEach(() => {
    resetTaskOrchestrator();
  });

  // ── DAG 创建 ─────────────────────────────────────────────

  describe('createDag', () => {
    it('创建空 DAG', () => {
      const dag = createDag('Test DAG');
      expect(dag.id).toBeTruthy();
      expect(dag.name).toBe('Test DAG');
      expect(dag.status).toBe('idle');
      expect(dag.nodes.size).toBe(0);
    });

    it('向 DAG 添加任务节点', () => {
      const dag = createDag('Test');
      const node = addTask(dag, { id: 't1', name: 'Task 1' });

      expect(node.id).toBe('t1');
      expect(node.name).toBe('Task 1');
      expect(node.dependencies).toEqual([]);
      expect(node.status).toBe('pending');
      expect(node.progress).toBe(0);
      expect(node.checkpoint).toBeNull();
      expect(dag.nodes.size).toBe(1);
    });

    it('添加带依赖的任务', () => {
      const dag = createDag('Test');
      addTask(dag, { id: 't1', name: 'Task 1' });
      const t2 = addTask(dag, { id: 't2', name: 'Task 2', dependencies: ['t1'] });

      expect(t2.dependencies).toEqual(['t1']);
    });

    it('getTaskNode 返回节点', () => {
      const dag = createDag('Test');
      addTask(dag, { id: 't1', name: 'Task 1' });

      expect(getTaskNode(dag, 't1')).not.toBeNull();
      expect(getTaskNode(dag, 'nonexistent')).toBeNull();
    });
  });

  // ── 拓扑排序 ─────────────────────────────────────────────

  describe('topologicalSort', () => {
    it('无依赖的 DAG 排序正确', () => {
      const dag = createDag('Test');
      addTask(dag, { id: 'a', name: 'A' });
      addTask(dag, { id: 'b', name: 'B' });
      addTask(dag, { id: 'c', name: 'C' });

      const result = topologicalSort(dag);
      expect(result.hasCycle).toBe(false);
      expect(result.sorted).toHaveLength(3);
      expect(result.sorted).toContain('a');
      expect(result.sorted).toContain('b');
      expect(result.sorted).toContain('c');
    });

    it('线性依赖排序正确', () => {
      const dag = createDag('Test');
      addTask(dag, { id: 'a', name: 'A' });
      addTask(dag, { id: 'b', name: 'B', dependencies: ['a'] });
      addTask(dag, { id: 'c', name: 'C', dependencies: ['b'] });

      const result = topologicalSort(dag);
      expect(result.hasCycle).toBe(false);
      expect(result.sorted).toEqual(['a', 'b', 'c']);
    });

    it('DAG 依赖排序正确', () => {
      // a → b → d
      // a → c → d
      const dag = createDag('Test');
      addTask(dag, { id: 'a', name: 'A' });
      addTask(dag, { id: 'b', name: 'B', dependencies: ['a'] });
      addTask(dag, { id: 'c', name: 'C', dependencies: ['a'] });
      addTask(dag, { id: 'd', name: 'D', dependencies: ['b', 'c'] });

      const result = topologicalSort(dag);
      expect(result.hasCycle).toBe(false);
      expect(result.sorted).toHaveLength(4);

      // a 必须在 b, c 之前
      const idxA = result.sorted.indexOf('a');
      const idxB = result.sorted.indexOf('b');
      const idxC = result.sorted.indexOf('c');
      const idxD = result.sorted.indexOf('d');
      expect(idxA).toBeLessThan(idxB);
      expect(idxA).toBeLessThan(idxC);
      expect(idxB).toBeLessThan(idxD);
      expect(idxC).toBeLessThan(idxD);
    });

    it('引用不存在的依赖抛出错误', () => {
      const dag = createDag('Test');
      addTask(dag, { id: 'a', name: 'A', dependencies: ['nonexistent'] });

      expect(() => topologicalSort(dag)).toThrow('non-existent task');
    });

    it('空 DAG 返回空数组', () => {
      const dag = createDag('Test');
      const result = topologicalSort(dag);
      expect(result.sorted).toEqual([]);
      expect(result.hasCycle).toBe(false);
    });
  });

  // ── 循环检测 ─────────────────────────────────────────────

  describe('cycle detection', () => {
    it('直接循环 A → B → A 检测到', () => {
      const dag = createDag('Test');
      addTask(dag, { id: 'a', name: 'A', dependencies: ['b'] });
      addTask(dag, { id: 'b', name: 'B', dependencies: ['a'] });

      const result = topologicalSort(dag);
      expect(result.hasCycle).toBe(true);
      expect(result.cycleNodes).toBeDefined();
      expect(result.cycleNodes!.sort()).toEqual(['a', 'b']);
    });

    it('间接循环 A → B → C → A 检测到', () => {
      const dag = createDag('Test');
      addTask(dag, { id: 'a', name: 'A', dependencies: ['c'] });
      addTask(dag, { id: 'b', name: 'B', dependencies: ['a'] });
      addTask(dag, { id: 'c', name: 'C', dependencies: ['b'] });

      const result = topologicalSort(dag);
      expect(result.hasCycle).toBe(true);
      expect(result.cycleNodes!.sort()).toEqual(['a', 'b', 'c']);
    });

    it('自环检测到', () => {
      const dag = createDag('Test');
      addTask(dag, { id: 'a', name: 'A', dependencies: ['a'] });

      const result = topologicalSort(dag);
      expect(result.hasCycle).toBe(true);
    });

    it('hasCycle 辅助函数', () => {
      const dag = createDag('Test');
      addTask(dag, { id: 'a', name: 'A', dependencies: ['b'] });
      addTask(dag, { id: 'b', name: 'B', dependencies: ['a'] });

      expect(hasCycle(dag)).toBe(true);
    });

    it('无循环时 hasCycle 返回 false', () => {
      const dag = createDag('Test');
      addTask(dag, { id: 'a', name: 'A' });
      addTask(dag, { id: 'b', name: 'B', dependencies: ['a'] });

      expect(hasCycle(dag)).toBe(false);
    });

    it('部分节点循环也检测到', () => {
      const dag = createDag('Test');
      addTask(dag, { id: 'a', name: 'A' }); // 无循环
      addTask(dag, { id: 'b', name: 'B', dependencies: ['a'] });
      addTask(dag, { id: 'c', name: 'C', dependencies: ['d'] }); // 有循环
      addTask(dag, { id: 'd', name: 'D', dependencies: ['c'] });

      const result = topologicalSort(dag);
      expect(result.hasCycle).toBe(true);
    });
  });

  // ── Checkpoint 管理 ──────────────────────────────────────

  describe('checkpoint', () => {
    it('创建 checkpoint', () => {
      const dag = createDag('Test');
      addTask(dag, { id: 't1', name: 'Task 1' });

      const cp = createCheckpoint(
        dag,
        't1',
        { step: 3, context: 'hello' },
        'partial output'
      );

      expect(cp.timestamp).toBeGreaterThan(0);
      expect(cp.agentContext).toEqual({ step: 3, context: 'hello' });
      expect(cp.outputSnapshot).toBe('partial output');

      const node = getTaskNode(dag, 't1')!;
      expect(node.checkpoint).toBe(cp);
    });

    it('restore checkpoint 返回上下文', () => {
      const dag = createDag('Test');
      addTask(dag, { id: 't1', name: 'Task 1' });

      createCheckpoint(dag, 't1', { step: 3 }, 'output');
      const ctx = restoreCheckpoint(dag, 't1');

      expect(ctx).toEqual({ step: 3 });
      expect(getTaskNode(dag, 't1')!.status).toBe('ready');
    });

    it('restore 无 checkpoint 的任务返回 null', () => {
      const dag = createDag('Test');
      addTask(dag, { id: 't1', name: 'Task 1' });

      const ctx = restoreCheckpoint(dag, 't1');
      expect(ctx).toBeNull();
    });

    it('getCheckpoint 获取 checkpoint', () => {
      const dag = createDag('Test');
      addTask(dag, { id: 't1', name: 'Task 1' });
      createCheckpoint(dag, 't1', { data: 123 }, 'snap');

      const cp = getCheckpoint(dag, 't1');
      expect(cp).not.toBeNull();
      expect(cp!.agentContext).toEqual({ data: 123 });
    });

    it('clearCheckpoint 清除 checkpoint', () => {
      const dag = createDag('Test');
      addTask(dag, { id: 't1', name: 'Task 1' });
      createCheckpoint(dag, 't1', { data: 1 }, 'snap');

      clearCheckpoint(dag, 't1');
      expect(getCheckpoint(dag, 't1')).toBeNull();
    });

    it('不存在的任务抛出错误', () => {
      const dag = createDag('Test');
      expect(() => createCheckpoint(dag, 'nonexistent', {}, '')).toThrow(
        'not found'
      );
      expect(() => restoreCheckpoint(dag, 'nonexistent')).toThrow('not found');
      expect(() => getCheckpoint(dag, 'nonexistent')).toThrow('not found');
      expect(() => clearCheckpoint(dag, 'nonexistent')).toThrow('not found');
    });
  });

  // ── 进度跟踪 ─────────────────────────────────────────────

  describe('progress tracking', () => {
    it('updateProgress 更新节点进度', () => {
      const dag = createDag('Test');
      addTask(dag, { id: 't1', name: 'Task 1' });

      updateProgress(dag, 't1', 50);
      expect(getTaskNode(dag, 't1')!.progress).toBe(50);
    });

    it('进度值限制在 0-100', () => {
      const dag = createDag('Test');
      addTask(dag, { id: 't1', name: 'Task 1' });

      updateProgress(dag, 't1', -10);
      expect(getTaskNode(dag, 't1')!.progress).toBe(0);

      updateProgress(dag, 't1', 150);
      expect(getTaskNode(dag, 't1')!.progress).toBe(100);
    });

    it('空 DAG 返回零进度', () => {
      const dag = createDag('Test');
      const progress = getProgress(dag);

      expect(progress.total).toBe(0);
      expect(progress.completed).toBe(0);
      expect(progress.percentComplete).toBe(0);
      expect(progress.estimatedTimeRemainingMs).toBeNull();
    });

    it('正确计算整体进度', () => {
      const dag = createDag('Test');
      addTask(dag, { id: 't1', name: 'Task 1' });
      addTask(dag, { id: 't2', name: 'Task 2' });
      addTask(dag, { id: 't3', name: 'Task 3' });
      addTask(dag, { id: 't4', name: 'Task 4' });

      // 模拟部分完成
      const t1 = getTaskNode(dag, 't1')!;
      t1.status = 'completed';
      t1.startedAt = Date.now() - 1000;
      t1.completedAt = Date.now();

      const t2 = getTaskNode(dag, 't2')!;
      t2.status = 'running';
      t2.progress = 60;

      const progress = getProgress(dag);
      expect(progress.total).toBe(4);
      expect(progress.completed).toBe(1);
      expect(progress.running).toBe(1);
      expect(progress.pending).toBe(2);
      expect(progress.percentComplete).toBe(25);
    });

    it('ETA 估算基于已完成任务平均耗时', () => {
      const dag = createDag('Test');
      addTask(dag, { id: 't1', name: 'Task 1' });
      addTask(dag, { id: 't2', name: 'Task 2' });
      addTask(dag, { id: 't3', name: 'Task 3' });

      // t1 已完成，耗时 2000ms
      const t1 = getTaskNode(dag, 't1')!;
      t1.status = 'completed';
      t1.startedAt = Date.now() - 2000;
      t1.completedAt = Date.now();

      const progress = getProgress(dag);
      expect(progress.estimatedTimeRemainingMs).not.toBeNull();
      // 剩余 2 个任务，每个约 2000ms → ETA ≈ 4000ms
      expect(progress.estimatedTimeRemainingMs!).toBeGreaterThan(0);
    });
  });

  // ── DAG 执行 ─────────────────────────────────────────────

  describe('runDag', () => {
    it('按拓扑序执行所有任务', async () => {
      const dag = createDag('Test');
      addTask(dag, { id: 'a', name: 'A' });
      addTask(dag, { id: 'b', name: 'B', dependencies: ['a'] });
      addTask(dag, { id: 'c', name: 'C', dependencies: ['b'] });

      const executionOrder: string[] = [];
      const executor = async (node: TaskNode) => {
        executionOrder.push(node.id);
        return `output-${node.id}`;
      };

      await runDag(dag, executor);

      expect(executionOrder).toEqual(['a', 'b', 'c']);
      expect(dag.status).toBe('completed');
    });

    it('并行执行无依赖的任务', async () => {
      const dag = createDag('Test');
      addTask(dag, { id: 'a', name: 'A' });
      addTask(dag, { id: 'b', name: 'B' });

      const startTimes: Array<{ id: string; time: number }> = [];
      const executor = async (node: TaskNode) => {
        startTimes.push({ id: node.id, time: Date.now() });
        await new Promise((r) => setTimeout(r, 50));
        return `output-${node.id}`;
      };

      await runDag(dag, executor);

      // a 和 b 应该几乎同时开始
      expect(startTimes).toHaveLength(2);
      expect(Math.abs(startTimes[0].time - startTimes[1].time)).toBeLessThan(20);
    });

    it('失败节点跳过下游依赖', async () => {
      const dag = createDag('Test');
      addTask(dag, { id: 'a', name: 'A' });
      addTask(dag, { id: 'b', name: 'B', dependencies: ['a'] });
      addTask(dag, { id: 'c', name: 'C', dependencies: ['b'] });

      const executor = async (node: TaskNode) => {
        if (node.id === 'b') throw new Error('B failed');
        return `output-${node.id}`;
      };

      await runDag(dag, executor);

      expect(dag.status).toBe('failed');
      expect(getTaskNode(dag, 'a')!.status).toBe('completed');
      expect(getTaskNode(dag, 'b')!.status).toBe('failed');
      expect(getTaskNode(dag, 'c')!.status).toBe('skipped');
    });

    it('循环依赖抛出错误', async () => {
      const dag = createDag('Test');
      addTask(dag, { id: 'a', name: 'A', dependencies: ['b'] });
      addTask(dag, { id: 'b', name: 'B', dependencies: ['a'] });

      await expect(runDag(dag, async () => 'x')).rejects.toThrow('cycle');
    });

    it('依赖输出正确传递', async () => {
      const dag = createDag('Test');
      addTask(dag, { id: 'a', name: 'A' });
      addTask(dag, { id: 'b', name: 'B', dependencies: ['a'] });

      const receivedOutputs: Map<string, string> = new Map();
      const executor = async (
        node: TaskNode,
        depsOutputs: Map<string, string>
      ) => {
        receivedOutputs.set(node.id, JSON.stringify([...depsOutputs]));
        return `result-of-${node.id}`;
      };

      await runDag(dag, executor);

      // a 没有依赖
      expect(receivedOutputs.get('a')).toBe('[]');
      // b 收到了 a 的输出
      const bDeps = JSON.parse(receivedOutputs.get('b')!) as Array<[string, string]>;
      expect(bDeps).toEqual([['a', 'result-of-a']]);
    });

    it('自动为完成的任务创建 checkpoint', async () => {
      const dag = createDag('Test');
      addTask(dag, { id: 'a', name: 'A' });

      await runDag(dag, async () => 'my output');

      const node = getTaskNode(dag, 'a')!;
      expect(node.checkpoint).not.toBeNull();
      expect(node.checkpoint!.outputSnapshot).toBe('my output');
    });
  });

  // ── DAG 监听器 ───────────────────────────────────────────

  describe('listeners', () => {
    it('DAG 更新通知监听器', () => {
      const dag = createDag('Test');
      const updates: number[] = [];

      const unsubscribe = onDagUpdate((d) => {
        if (d.id === dag.id) updates.push(d.nodes.size);
      });

      addTask(dag, { id: 't1', name: 'Task 1' });
      createCheckpoint(dag, 't1', {}, 'x');

      expect(updates.length).toBeGreaterThanOrEqual(1);
      unsubscribe();
    });

    it('取消订阅后不再通知', () => {
      const dag = createDag('Test');
      addTask(dag, { id: 't1', name: 'Task 1' });
      let count = 0;

      const unsubscribe = onDagUpdate(() => {
        count++;
      });

      // createCheckpoint 会触发通知
      createCheckpoint(dag, 't1', {}, 'snap');
      expect(count).toBeGreaterThan(0);

      unsubscribe();
      const countAfter = count;
      createCheckpoint(dag, 't1', {}, 'snap2');
      expect(count).toBe(countAfter);
    });
  });

  // ── 序列化 / 持久化 ─────────────────────────────────────

  describe('serialization', () => {
    it('serializeDag 输出可 JSON 序列化', () => {
      const dag = createDag('Test');
      addTask(dag, { id: 't1', name: 'Task 1' });
      addTask(dag, { id: 't2', name: 'Task 2', dependencies: ['t1'] });
      createCheckpoint(dag, 't1', { key: 'val' }, 'output');

      const serialized = serializeDag(dag);
      const json = JSON.stringify(serialized);
      const parsed = JSON.parse(json);

      expect(parsed.id).toBe(dag.id);
      expect(parsed.nodes).toHaveLength(2);
      expect(parsed.nodes[0].checkpoint).not.toBeNull();
    });

    it('deserializeDag 恢复 DAG', () => {
      const dag = createDag('Test');
      addTask(dag, { id: 't1', name: 'Task 1' });
      addTask(dag, { id: 't2', name: 'Task 2', dependencies: ['t1'] });

      const serialized = serializeDag(dag);
      const restored = deserializeDag(serialized);

      expect(restored.id).toBe(dag.id);
      expect(restored.name).toBe('Test');
      expect(restored.nodes.size).toBe(2);
      expect(getTaskNode(restored, 't2')!.dependencies).toEqual(['t1']);
    });

    it('persistDag + restoreDag 完整流程', () => {
      // 使用 mock localStorage
      const store: Record<string, string> = {};
      vi.stubGlobal('localStorage', {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => { store[k] = v; },
        removeItem: (k: string) => { delete store[k]; },
        clear: () => { Object.keys(store).forEach(k => delete store[k]); },
      });

      const dag = createDag('Persist Test');
      addTask(dag, { id: 't1', name: 'Task 1' });

      persistDag(dag, 'test-key');
      const restored = restoreDag('test-key');

      expect(restored).not.toBeNull();
      expect(restored!.name).toBe('Persist Test');
      expect(restored!.nodes.size).toBe(1);

      vi.unstubAllGlobals();
    });

    it('restoreDag 无数据返回 null', () => {
      const store: Record<string, string> = {};
      vi.stubGlobal('localStorage', {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => { store[k] = v; },
        removeItem: (k: string) => { delete store[k]; },
        clear: () => { Object.keys(store).forEach(k => delete store[k]); },
      });

      expect(restoreDag('nonexistent')).toBeNull();
      vi.unstubAllGlobals();
    });
  });
});
