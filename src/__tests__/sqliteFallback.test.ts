/**
 * sqliteFallback.test.ts — SQLite 降级存储 (IndexedDB/Dexie) CRUD 测试
 *
 * 覆盖 4 个 store 的增删查操作：
 * - episodes (情景记忆)
 * - patterns (语义记忆)
 * - skills (Skill 管理)
 * - hooks (Hook 配置)
 *
 * 使用 fake-indexeddb 模拟 IndexedDB 环境。
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { fallbackStore } from '@/services/sqliteFallback';
import Dexie from 'dexie';

// 清理 IndexedDB 数据（每个测试前重置）
async function clearAllTables() {
  const dbs = await Dexie.getDatabaseNames();
  for (const name of dbs) {
    const db = new Dexie(name);
    await db.delete();
  }
}

describe('sqliteFallback — 降级存储 CRUD', () => {
  beforeEach(async () => {
    await clearAllTables();
  });

  // ── episodes (情景记忆) ─────────────────────────────────
  describe('episodes', () => {
    const WORKSPACE = 'ws-test-001';

    it('create — 创建情景记忆并返回 UUID', async () => {
      const id = await fallbackStore.episodes.create({
        workspaceId: WORKSPACE,
        type: 'bug_fix',
        content: '修复了登录页面的 500 错误',
        tags: ['bug', 'login'],
      });
      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
      // UUID v4 格式
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('list — 列出工作区的情景记忆', async () => {
      await fallbackStore.episodes.create({
        workspaceId: WORKSPACE,
        type: 'bug_fix',
        content: '记录 1',
        tags: [],
      });
      await fallbackStore.episodes.create({
        workspaceId: WORKSPACE,
        type: 'feature_impl',
        content: '记录 2',
        tags: [],
      });

      const list = await fallbackStore.episodes.list(WORKSPACE);
      expect(list.length).toBe(2);
      // 按时间戳降序
      expect(list[0].timestamp).toBeGreaterThanOrEqual(list[1].timestamp);
    });

    it('list — 不同工作区隔离', async () => {
      await fallbackStore.episodes.create({
        workspaceId: WORKSPACE,
        type: 'bug_fix',
        content: '工作区 A',
        tags: [],
      });
      await fallbackStore.episodes.create({
        workspaceId: 'ws-other',
        type: 'bug_fix',
        content: '工作区 B',
        tags: [],
      });

      const list = await fallbackStore.episodes.list(WORKSPACE);
      expect(list.length).toBe(1);
      expect(list[0].content).toBe('工作区 A');
    });

    it('search — 按内容搜索', async () => {
      await fallbackStore.episodes.create({
        workspaceId: WORKSPACE,
        type: 'bug_fix',
        content: '修复了登录页面的 500 错误',
        tags: [],
      });
      await fallbackStore.episodes.create({
        workspaceId: WORKSPACE,
        type: 'feature_impl',
        content: '新增用户注册功能',
        tags: [],
      });

      const results = await fallbackStore.episodes.search('登录', WORKSPACE);
      expect(results.length).toBe(1);
      expect(results[0].content).toContain('登录');
    });

    it('softDelete — 软删除后不在 list 中', async () => {
      const id = await fallbackStore.episodes.create({
        workspaceId: WORKSPACE,
        type: 'bug_fix',
        content: '将被删除',
        tags: [],
      });

      await fallbackStore.episodes.softDelete(id);
      const list = await fallbackStore.episodes.list(WORKSPACE);
      expect(list.length).toBe(0);
    });

    it('softDelete — 软删除后不在 search 中', async () => {
      const id = await fallbackStore.episodes.create({
        workspaceId: WORKSPACE,
        type: 'bug_fix',
        content: '可搜索的内容',
        tags: [],
      });

      await fallbackStore.episodes.softDelete(id);
      const results = await fallbackStore.episodes.search('可搜索', WORKSPACE);
      expect(results.length).toBe(0);
    });

    it('create — 自动生成 confidence 和 isDeleted', async () => {
      const id = await fallbackStore.episodes.create({
        workspaceId: WORKSPACE,
        type: 'bug_fix',
        content: '测试默认值',
        tags: [],
      });

      const list = await fallbackStore.episodes.list(WORKSPACE);
      const ep = list.find((e) => e.id === id);
      expect(ep).toBeTruthy();
      expect(ep!.confidence).toBe(1.0);
      expect(ep!.isDeleted).toBe(0);
      expect(ep!.timestamp).toBeGreaterThan(0);
    });

    it('list — limit 参数限制结果数量', async () => {
      for (let i = 0; i < 5; i++) {
        await fallbackStore.episodes.create({
          workspaceId: WORKSPACE,
          type: 'bug_fix',
          content: `记录 ${i}`,
          tags: [],
        });
      }

      const list = await fallbackStore.episodes.list(WORKSPACE, 3);
      expect(list.length).toBe(3);
    });
  });

  // ── patterns (语义记忆) ─────────────────────────────────
  describe('patterns', () => {
    it('create — 创建模式并返回 UUID', async () => {
      const id = await fallbackStore.patterns.create({
        domain: 'react',
        pattern: 'useEffect cleanup',
        description: 'useEffect 返回清理函数防止内存泄漏',
        confidence: 0.9,
      });
      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
    });

    it('list — 列出所有模式', async () => {
      await fallbackStore.patterns.create({
        domain: 'react',
        pattern: 'pattern-1',
        description: 'desc-1',
        confidence: 0.8,
      });
      await fallbackStore.patterns.create({
        domain: 'node',
        pattern: 'pattern-2',
        description: 'desc-2',
        confidence: 0.9,
      });

      const list = await fallbackStore.patterns.list();
      expect(list.length).toBe(2);
    });

    it('list — 按 domain 过滤', async () => {
      await fallbackStore.patterns.create({
        domain: 'react',
        pattern: 'react-pattern',
        description: 'React 模式',
        confidence: 0.8,
      });
      await fallbackStore.patterns.create({
        domain: 'node',
        pattern: 'node-pattern',
        description: 'Node 模式',
        confidence: 0.9,
      });

      const list = await fallbackStore.patterns.list('react');
      expect(list.length).toBe(1);
      expect(list[0].domain).toBe('react');
    });
  });

  // ── skills (Skill 管理) ──────────────────────────────────
  describe('skills', () => {
    it('create — 创建 Skill 并返回 UUID', async () => {
      const id = await fallbackStore.skills.create({
        name: 'TDD Helper',
        description: '辅助 TDD 开发',
        content: 'step 1: write test',
        source: 'manual',
        status: 'active',
      });
      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
    });

    it('create — 自动生成 usageCount = 0', async () => {
      await fallbackStore.skills.create({
        name: 'Test Skill',
        description: 'test',
        content: 'content',
        source: 'manual',
        status: 'active',
      });

      const list = await fallbackStore.skills.list('active');
      expect(list.length).toBe(1);
      expect(list[0].usageCount).toBe(0);
    });

    it('list — 按 status 过滤', async () => {
      await fallbackStore.skills.create({
        name: 'Active Skill',
        description: 'test',
        content: 'content',
        source: 'manual',
        status: 'active',
      });
      await fallbackStore.skills.create({
        name: 'Archived Skill',
        description: 'test',
        content: 'content',
        source: 'manual',
        status: 'archived',
      });

      const active = await fallbackStore.skills.list('active');
      expect(active.length).toBe(1);
      expect(active[0].name).toBe('Active Skill');

      const archived = await fallbackStore.skills.list('archived');
      expect(archived.length).toBe(1);
      expect(archived[0].name).toBe('Archived Skill');
    });
  });

  // ── hooks (Hook 配置) ────────────────────────────────────
  describe('hooks', () => {
    it('create — 创建 Hook 并返回 UUID', async () => {
      const id = await fallbackStore.hooks.create({
        name: 'Error Detector',
        triggerType: 'error_detected',
        conditions: '{"severity": "high"}',
        actions: '[{"type": "notify"}]',
        enabled: 1,
      });
      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
    });

    it('list — 列出所有 Hooks', async () => {
      await fallbackStore.hooks.create({
        name: 'Hook 1',
        triggerType: 'error_detected',
        conditions: '{}',
        actions: '[]',
        enabled: 1,
      });
      await fallbackStore.hooks.create({
        name: 'Hook 2',
        triggerType: 'task_complete',
        conditions: '{}',
        actions: '[]',
        enabled: 0,
      });

      const list = await fallbackStore.hooks.list();
      expect(list.length).toBe(2);
    });

    it('list — 按 enabled 过滤', async () => {
      await fallbackStore.hooks.create({
        name: 'Enabled Hook',
        triggerType: 'error_detected',
        conditions: '{}',
        actions: '[]',
        enabled: 1,
      });
      await fallbackStore.hooks.create({
        name: 'Disabled Hook',
        triggerType: 'task_complete',
        conditions: '{}',
        actions: '[]',
        enabled: 0,
      });

      const enabled = await fallbackStore.hooks.list(true);
      expect(enabled.length).toBe(1);
      expect(enabled[0].name).toBe('Enabled Hook');

      const disabled = await fallbackStore.hooks.list(false);
      expect(disabled.length).toBe(1);
      expect(disabled[0].name).toBe('Disabled Hook');
    });
  });
});
