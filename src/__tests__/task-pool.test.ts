import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TaskPool, getTaskPool, resetTaskPool } from '../services/multi-agent/task-pool/TaskPool.js';
import { CircularDependencyError, TaskNotFoundError } from '../types/multi-agent/task-pool.js';

describe('TaskPool', () => {
  let pool: TaskPool;

  beforeEach(() => {
    resetTaskPool();
    pool = getTaskPool();
  });

  afterEach(() => {
    pool = null as any;
  });

  describe('addTask', () => {
    it('creates a task with generated id', () => {
      const id = pool.addTask({ type: 'test', description: 'Test task' });
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
    });

    it('creates task with all fields', () => {
      const id = pool.addTask({
        type: 'feature',
        description: 'Build login feature',
        priority: 10,
      });

      const task = pool.getTask(id);
      expect(task).toBeDefined();
      expect(task!.type).toBe('feature');
      expect(task!.description).toBe('Build login feature');
      expect(task!.priority).toBe(10);
      expect(task!.status).toBe('pending');
      expect(task!.createdAt).toBeDefined();
    });

    it('creates task with dependencies', () => {
      const depId = pool.addTask({ type: 'base', description: 'Dependency' });
      const id = pool.addTask({
        type: 'feature',
        description: 'Feature',
        dependencies: [depId],
      });

      const task = pool.getTask(id);
      expect(task!.dependencies).toContain(depId);
    });

    it('creates task with parent', () => {
      const parentId = pool.addTask({ type: 'parent', description: 'Parent' });
      const childId = pool.addTask({
        type: 'child',
        description: 'Child',
        parentId,
      });

      const child = pool.getTask(childId);
      expect(child!.parentId).toBe(parentId);
    });
  });

  describe('updateTask', () => {
    it('updates task fields', () => {
      const id = pool.addTask({ type: 'test', description: 'Test' });
      pool.updateTask(id, { status: 'running', assignedTo: 'worker-1' });

      const task = pool.getTask(id);
      expect(task!.status).toBe('running');
      expect(task!.assignedTo).toBe('worker-1');
    });

    it('throws TaskNotFoundError for unknown id', () => {
      expect(() => pool.updateTask('unknown', { status: 'running' })).toThrow(TaskNotFoundError);
    });
  });

  describe('updateStatus', () => {
    it('updates status correctly', () => {
      const id = pool.addTask({ type: 'test', description: 'Test' });
      pool.updateStatus(id, 'running');
      expect(pool.getTask(id)!.status).toBe('running');

      pool.updateStatus(id, 'completed');
      expect(pool.getTask(id)!.status).toBe('completed');
    });
  });

  describe('getReadyTasks', () => {
    it('returns tasks with completed dependencies', () => {
      const dep1 = pool.addTask({ type: 'task', description: 'Dep 1' });
      const dep2 = pool.addTask({ type: 'task', description: 'Dep 2' });
      const ready = pool.addTask({
        type: 'task',
        description: 'Ready task',
        dependencies: [dep1, dep2],
      });
      const notReady = pool.addTask({
        type: 'task',
        description: 'Not ready',
        dependencies: [dep1],
      });

      // Neither should be ready yet
      expect(pool.getReadyTasks()).toHaveLength(2); // dep1, dep2, notReady

      // Complete dep1 and dep2
      pool.updateStatus(dep1, 'completed');
      pool.updateStatus(dep2, 'completed');

      // Now ready should be ready
      const readyTasks = pool.getReadyTasks();
      const readyIds = readyTasks.map(t => t.id);
      expect(readyIds).toContain(ready);
      expect(readyIds).toContain(notReady);
    });

    it('excludes non-pending tasks', () => {
      const id = pool.addTask({ type: 'task', description: 'Running' });
      pool.updateStatus(id, 'running');
      expect(pool.getReadyTasks().find(t => t.id === id)).toBeUndefined();
    });
  });

  describe('getTaskTree', () => {
    it('builds task tree with children', () => {
      const parentId = pool.addTask({ type: 'parent', description: 'Parent' });
      const child1 = pool.addTask({ type: 'child', description: 'Child 1', parentId });
      const child2 = pool.addTask({ type: 'child', description: 'Child 2', parentId });
      const grandchild = pool.addTask({ type: 'grandchild', description: 'Grandchild', parentId: child1 });

      const tree = pool.getTaskTree(parentId);
      expect(tree).toHaveLength(1);
      expect(tree[0].task.id).toBe(parentId);
      expect(tree[0].children).toHaveLength(2);
    });
  });

  describe('removeTask', () => {
    it('removes task by id', () => {
      const id = pool.addTask({ type: 'test', description: 'To remove' });
      pool.removeTask(id);
      expect(pool.getTask(id)).toBeUndefined();
    });

    it('removes task from dependency lists', () => {
      const toRemove = pool.addTask({ type: 'test', description: 'To remove' });
      const dependent = pool.addTask({
        type: 'test',
        description: 'Dependent',
        dependencies: [toRemove],
      });

      pool.removeTask(toRemove);
      expect(pool.getTask(dependent)!.dependencies).not.toContain(toRemove);
    });
  });

  describe('circular dependency detection', () => {
    it('throws when circular dependency would be created', () => {
      const task1 = pool.addTask({ type: 'task', description: 'Task 1' });
      const task2 = pool.addTask({ type: 'task', description: 'Task 2', dependencies: [task1] });

      expect(() => {
        pool.updateTask(task1, { dependencies: [task2] });
      }).toThrow(CircularDependencyError);
    });
  });

  describe('tracking', () => {
    it('tracks tool calls', () => {
      const id = pool.addTask({ type: 'task', description: 'Test' });
      pool.trackToolCall(id);
      pool.trackToolCall(id);
      expect(pool.getTask(id)!.toolCallCount).toBe(2);
    });

    it('tracks retries', () => {
      const id = pool.addTask({ type: 'task', description: 'Test' });
      pool.trackRetry(id);
      expect(pool.getTask(id)!.retryCount).toBe(1);
    });

    it('tracks reflections', () => {
      const id = pool.addTask({ type: 'task', description: 'Test' });
      pool.trackReflection(id);
      expect(pool.getTask(id)!.reflections).toBe(1);
    });
  });

  describe('getTasksByStatus', () => {
    it('filters by status', () => {
      pool.addTask({ type: 'task', description: 'Pending' });
      const running = pool.addTask({ type: 'task', description: 'Running' });
      pool.updateStatus(running, 'running');

      const pending = pool.getTasksByStatus('pending');
      const runningTasks = pool.getTasksByStatus('running');

      expect(pending).toHaveLength(1);
      expect(runningTasks).toHaveLength(1);
      expect(runningTasks[0].id).toBe(running);
    });
  });
});
