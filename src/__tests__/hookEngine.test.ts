/**
 * hookEngine 测试
 *
 * 覆盖：CRUD、条件评估、事件触发、日志记录、调试模式
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  register,
  getById,
  list,
  update,
  remove,
  emit,
  getLogs,
  resetHookEngine,
} from '../services/hookEngine';

describe('hookEngine', () => {
  beforeEach(() => {
    resetHookEngine();
  });

  // ── CRUD ─────────────────────────────────────────────────

  describe('CRUD', () => {
    it('注册并获取 Hook', () => {
      const hook = register({
        name: 'Test Hook',
        trigger: 'task_complete',
        actions: [{ type: 'notify', params: { message: 'Done' } }],
      });

      expect(hook.id).toBeTruthy();
      expect(hook.enabled).toBe(true);

      const fetched = getById(hook.id);
      expect(fetched!.name).toBe('Test Hook');
    });

    it('列表过滤', () => {
      register({ name: 'A', trigger: 'task_complete', actions: [] });
      register({ name: 'B', trigger: 'error_detected', actions: [] });
      register({ name: 'C', trigger: 'task_complete', actions: [] });

      expect(list()).toHaveLength(3);
      expect(list({ trigger: 'task_complete' })).toHaveLength(2);
    });

    it('更新 Hook', () => {
      const hook = register({ name: 'Old', trigger: 'task_complete', actions: [] });
      const updated = update(hook.id, { name: 'New', enabled: false });

      expect(updated!.name).toBe('New');
      expect(updated!.enabled).toBe(false);
    });

    it('删除 Hook', () => {
      const hook = register({ name: 'D', trigger: 'task_complete', actions: [] });
      expect(remove(hook.id)).toBe(true);
      expect(getById(hook.id)).toBeNull();
    });
  });

  // ── 条件评估 ─────────────────────────────────────────────

  describe('条件评估', () => {
    it('无条件时总是触发', async () => {
      register({
        name: 'No Condition',
        trigger: 'task_complete',
        conditions: [],
        actions: [{ type: 'notify', params: { message: 'hi' } }],
      });

      const logs = await emit('task_complete', {});
      expect(logs).toHaveLength(1);
      expect(logs[0].status).toBe('success');
    });

    it('eq 条件匹配', async () => {
      register({
        name: 'Eq Test',
        trigger: 'task_complete',
        conditions: [{ field: 'type', operator: 'eq', value: 'bug_fix' }],
        actions: [{ type: 'notify', params: {} }],
      });

      const success = await emit('task_complete', { type: 'bug_fix' });
      expect(success[0].status).toBe('success');

      resetHookEngine();
      register({
        name: 'Eq Test 2',
        trigger: 'task_complete',
        conditions: [{ field: 'type', operator: 'eq', value: 'bug_fix' }],
        actions: [{ type: 'notify', params: {} }],
      });
      const skipped = await emit('task_complete', { type: 'feature' });
      expect(skipped[0].status).toBe('skipped');
    });

    it('contains 条件匹配', async () => {
      register({
        name: 'Contains Test',
        trigger: 'file_change',
        conditions: [{ field: 'path', operator: 'contains', value: 'src/' }],
        actions: [{ type: 'notify', params: {} }],
      });

      const logs = await emit('file_change', { path: 'src/app.ts' });
      expect(logs[0].status).toBe('success');
    });

    it('gt 条件匹配', async () => {
      register({
        name: 'Gt Test',
        trigger: 'task_complete',
        conditions: [{ field: 'duration', operator: 'gt', value: 5000 }],
        actions: [{ type: 'notify', params: {} }],
      });

      const success = await emit('task_complete', { duration: 10000 });
      expect(success[0].status).toBe('success');

      const skipped = await emit('task_complete', { duration: 1000 });
      expect(skipped[0].status).toBe('skipped');
    });
  });

  // ── 事件触发 ─────────────────────────────────────────────

  describe('emit', () => {
    it('只触发匹配的 trigger', async () => {
      register({ name: 'TC', trigger: 'task_complete', actions: [{ type: 'notify', params: {} }] });
      register({ name: 'ED', trigger: 'error_detected', actions: [{ type: 'notify', params: {} }] });

      const logs = await emit('task_complete', {});
      expect(logs).toHaveLength(1);
      expect(logs[0].hookName).toBe('TC');
    });

    it('执行多个动作', async () => {
      register({
        name: 'Multi Action',
        trigger: 'task_complete',
        actions: [
          { type: 'notify', params: { message: 'hi' } },
          { type: 'record_episode', params: { content: 'test' } },
        ],
      });

      const logs = await emit('task_complete', {});
      expect(logs[0].status).toBe('success');
    });

    it('更新执行计数', async () => {
      const hook = register({
        name: 'Counter',
        trigger: 'task_complete',
        actions: [{ type: 'notify', params: {} }],
      });

      await emit('task_complete', {});
      await emit('task_complete', {});

      expect(getById(hook.id)!.executionCount).toBe(2);
    });
  });

  // ── 日志 ─────────────────────────────────────────────────

  describe('日志', () => {
    it('记录执行日志', async () => {
      register({ name: 'Logger', trigger: 'task_complete', actions: [{ type: 'notify', params: {} }] });
      await emit('task_complete', {});

      const logs = getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].hookName).toBe('Logger');
    });

    it('按状态过滤', async () => {
      register({ name: 'A', trigger: 'task_complete', conditions: [{ field: 'x', operator: 'eq', value: 1 }], actions: [{ type: 'notify', params: {} }] });

      await emit('task_complete', { x: 1 }); // success
      await emit('task_complete', { x: 2 }); // skipped

      expect(getLogs({ status: 'success' })).toHaveLength(1);
      expect(getLogs({ status: 'skipped' })).toHaveLength(1);
    });

    it('调试模式记录详情', async () => {
      register({ name: 'Debug', trigger: 'task_complete', actions: [{ type: 'notify', params: { message: 'test' } }] });
      const logs = await emit('task_complete', {}, true);

      expect(logs[0].details).toBeTruthy();
    });
  });
});
