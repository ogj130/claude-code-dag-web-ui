/**
 * skillStore 测试
 *
 * 覆盖：CRUD、版本管理、使用统计、推荐引擎
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  create,
  getById,
  list,
  update,
  remove,
  recordUsage,
  getUsageStats,
  getVersions,
  rollback,
  diff,
  recommend,
  resetSkillStore,
} from '../services/skillStore';

describe('skillStore', () => {
  beforeEach(() => {
    resetSkillStore();
  });

  // ── CRUD ─────────────────────────────────────────────────

  describe('CRUD', () => {
    it('创建并获取 Skill', async () => {
      const skill = await create({ name: 'Test Skill', content: 'do something' });
      expect(skill.id).toBeTruthy();
      expect(skill.name).toBe('Test Skill');
      expect(skill.version).toBe(1);

      const fetched = await getById(skill.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.name).toBe('Test Skill');
    });

    it('列表过滤', async () => {
      await create({ name: 'A', content: '', tags: ['react'] });
      await create({ name: 'B', content: '', tags: ['vue'] });
      await create({ name: 'C', content: '', tags: ['react'] });

      const all = await list();
      expect(all).toHaveLength(3);

      const reactOnly = await list({ tag: 'react' });
      expect(reactOnly).toHaveLength(2);
    });

    it('软删除', async () => {
      const skill = await create({ name: 'To Delete', content: '' });
      const result = await remove(skill.id);
      expect(result).toBe(true);

      const fetched = await getById(skill.id);
      expect(fetched!.status).toBe('deprecated');
    });

    it('不存在的 Skill 返回 null', async () => {
      expect(await getById('nonexistent')).toBeNull();
    });
  });

  // ── 版本管理 ─────────────────────────────────────────────

  describe('版本管理', () => {
    it('更新内容创建新版本', async () => {
      const skill = await create({ name: 'V Skill', content: 'v1 content' });
      await update(skill.id, { content: 'v2 content' }, 'Added feature');

      const versions = await getVersions(skill.id);
      expect(versions).toHaveLength(2);
      expect(versions[1].version).toBe(2);
      expect(versions[1].changeNote).toBe('Added feature');
    });

    it('非内容更新不创建版本', async () => {
      const skill = await create({ name: 'V Skill', content: 'content' });
      await update(skill.id, { name: 'Updated Name' });

      const versions = await getVersions(skill.id);
      expect(versions).toHaveLength(1);
    });

    it('回滚到指定版本', async () => {
      const skill = await create({ name: 'R Skill', content: 'v1' });
      await update(skill.id, { content: 'v2' });
      await update(skill.id, { content: 'v3' });

      const rolled = await rollback(skill.id, 1);
      expect(rolled!.content).toBe('v1');
      expect(rolled!.version).toBe(4); // 新版本号
    });

    it('对比两个版本', async () => {
      const skill = await create({ name: 'D Skill', content: 'v1' });
      await update(skill.id, { content: 'v2' });

      const result = await diff(skill.id, 1, 2);
      expect(result.a!.content).toBe('v1');
      expect(result.b!.content).toBe('v2');
    });
  });

  // ── 使用统计 ─────────────────────────────────────────────

  describe('使用统计', () => {
    it('记录成功使用', async () => {
      const skill = await create({ name: 'S', content: '' });
      await recordUsage(skill.id, { success: true, tokens: 500 });

      const stats = await getUsageStats(skill.id);
      expect(stats!.totalCalls).toBe(1);
      expect(stats!.successCount).toBe(1);
      expect(stats!.totalTokens).toBe(500);
      expect(stats!.successRate).toBe(1);
    });

    it('记录失败使用', async () => {
      const skill = await create({ name: 'S', content: '' });
      await recordUsage(skill.id, { success: false, tokens: 100 });

      const stats = await getUsageStats(skill.id);
      expect(stats!.failureCount).toBe(1);
      expect(stats!.successRate).toBe(0);
    });

    it('累计统计', async () => {
      const skill = await create({ name: 'S', content: '' });
      await recordUsage(skill.id, { success: true, tokens: 500 });
      await recordUsage(skill.id, { success: false, tokens: 300 });
      await recordUsage(skill.id, { success: true, tokens: 200 });

      const stats = await getUsageStats(skill.id);
      expect(stats!.totalCalls).toBe(3);
      expect(stats!.successCount).toBe(2);
      expect(stats!.totalTokens).toBe(1000);
      expect(Math.round(stats!.successRate * 100)).toBe(67);
    });
  });

  // ── 推荐引擎 ─────────────────────────────────────────────

  describe('recommend', () => {
    it('无上下文时按使用频率排序', async () => {
      const s1 = await create({ name: 'Popular', content: '' });
      const s2 = await create({ name: 'Less', content: '' });

      await recordUsage(s1.id, { success: true, tokens: 100 });
      await recordUsage(s1.id, { success: true, tokens: 100 });

      const results = await recommend({});
      expect(results[0].name).toBe('Popular');
    });

    it('标签匹配优先', async () => {
      await create({ name: 'React Helper', content: '', tags: ['react'] });
      await create({ name: 'Vue Helper', content: '', tags: ['vue'] });

      const results = await recommend({ tags: ['react'] });
      expect(results[0].name).toBe('React Helper');
    });

    it('描述关键词匹配', async () => {
      await create({ name: 'Git Commit', content: '', description: 'auto commit changes' });
      await create({ name: 'Test Runner', content: '', description: 'run unit tests' });

      const results = await recommend({ description: 'commit changes' });
      expect(results[0].name).toBe('Git Commit');
    });

    it('限制返回数量', async () => {
      for (let i = 0; i < 10; i++) {
        await create({ name: `Skill ${i}`, content: '' });
      }

      const results = await recommend({ limit: 3 });
      expect(results).toHaveLength(3);
    });
  });
});
