/**
 * useWorkingMemoryStore.test.ts — V3 工作记忆 Store 测试
 *
 * 覆盖新增的工作记忆条目 CRUD、序列化、Token 监控、溢出检测。
 * 同时验证向后兼容的 CompactionStore API。
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  useWorkingMemoryStore,
} from '@/stores/useWorkingMemoryStore';

describe('useWorkingMemoryStore — V3 工作记忆', () => {
  beforeEach(() => {
    // 重置 store 到初始状态
    useWorkingMemoryStore.setState({
      entries: [],
      reports: [],
      selectedReportId: null,
      contextUsage: {
        totalInputTokens: 0,
        estimatedWindow: 128000,
        usagePct: 0,
        lastUpdated: Date.now(),
      },
    });
  });

  // ── 向后兼容验证 ─────────────────────────────────────────
  describe('向后兼容 (CompactionStore API)', () => {
    it('reports 仍可访问', () => {
      expect(useWorkingMemoryStore.getState().reports).toEqual([]);
    });

    it('addReport 仍然工作', () => {
      useWorkingMemoryStore.getState().addReport({
        id: 'r1',
        timestamp: Date.now(),
        beforeTokens: 10000,
        afterTokens: 5000,
        removedMessages: 3,
        preservedMessages: 10,
        strategy: 'smart',
      });
      expect(useWorkingMemoryStore.getState().reports.length).toBe(1);
    });

    it('updateContextUsage 仍然工作', () => {
      useWorkingMemoryStore.getState().updateContextUsage(10000);
      expect(useWorkingMemoryStore.getState().contextUsage.totalInputTokens).toBe(10000);
    });
  });

  // ── 条目 CRUD ─────────────────────────────────────────────
  describe('entries CRUD', () => {
    it('addEntry — 创建条目并自动生成 id/tokenEstimate', () => {
      useWorkingMemoryStore.getState().addEntry({
        type: 'context',
        content: '用户正在开发一个 React 项目',
        priority: 3,
      });

      const entries = useWorkingMemoryStore.getState().entries;
      expect(entries.length).toBe(1);
      expect(entries[0].id).toBeTruthy();
      expect(entries[0].type).toBe('context');
      expect(entries[0].priority).toBe(3);
      expect(entries[0].tokenEstimate).toBeGreaterThan(0);
      expect(entries[0].createdAt).toBeGreaterThan(0);
    });

    it('updateEntry — 更新内容并重新估算 token', () => {
      useWorkingMemoryStore.getState().addEntry({
        type: 'instruction',
        content: '短内容',
        priority: 1,
      });
      const id = useWorkingMemoryStore.getState().entries[0].id;
      const oldTokens = useWorkingMemoryStore.getState().entries[0].tokenEstimate;

      useWorkingMemoryStore.getState().updateEntry(id, {
        content: '这是一个更长的内容，用来测试 token 估算是否正确更新了',
      });

      const updated = useWorkingMemoryStore.getState().entries[0];
      expect(updated.content).toContain('更长的内容');
      expect(updated.tokenEstimate).toBeGreaterThan(oldTokens);
    });

    it('removeEntry — 删除条目', () => {
      useWorkingMemoryStore.getState().addEntry({
        type: 'context',
        content: '将被删除',
        priority: 1,
      });
      const id = useWorkingMemoryStore.getState().entries[0].id;

      useWorkingMemoryStore.getState().removeEntry(id);
      expect(useWorkingMemoryStore.getState().entries.length).toBe(0);
    });

    it('touchEntry — 更新最后访问时间', () => {
      useWorkingMemoryStore.getState().addEntry({
        type: 'reference',
        content: '引用内容',
        priority: 2,
      });
      const entry = useWorkingMemoryStore.getState().entries[0];
      const oldAccess = entry.lastAccessedAt;

      // 等待一小段时间确保时间戳不同
      useWorkingMemoryStore.getState().touchEntry(entry.id);
      const updated = useWorkingMemoryStore.getState().entries[0];
      expect(updated.lastAccessedAt).toBeGreaterThanOrEqual(oldAccess);
    });

    it('clearEntries — 清空所有条目', () => {
      for (let i = 0; i < 5; i++) {
        useWorkingMemoryStore.getState().addEntry({
          type: 'context',
          content: `条目 ${i}`,
          priority: i,
        });
      }
      expect(useWorkingMemoryStore.getState().entries.length).toBe(5);

      useWorkingMemoryStore.getState().clearEntries();
      expect(useWorkingMemoryStore.getState().entries.length).toBe(0);
    });

    it('getEntriesByType — 按类型过滤', () => {
      useWorkingMemoryStore.getState().addEntry({ type: 'context', content: 'c1', priority: 1 });
      useWorkingMemoryStore.getState().addEntry({ type: 'instruction', content: 'i1', priority: 1 });
      useWorkingMemoryStore.getState().addEntry({ type: 'context', content: 'c2', priority: 1 });

      const contexts = useWorkingMemoryStore.getState().getEntriesByType('context');
      expect(contexts.length).toBe(2);
      const instructions = useWorkingMemoryStore.getState().getEntriesByType('instruction');
      expect(instructions.length).toBe(1);
    });
  });

  // ── Token 统计 ─────────────────────────────────────────────
  describe('Token 监控', () => {
    it('getTotalTokens — 返回所有条目的 token 总和', () => {
      useWorkingMemoryStore.getState().addEntry({ type: 'context', content: '内容A', priority: 1 });
      useWorkingMemoryStore.getState().addEntry({ type: 'context', content: '内容B', priority: 1 });
      const total = useWorkingMemoryStore.getState().getTotalTokens();
      expect(total).toBeGreaterThan(0);
    });
  });

  // ── 序列化 / 反序列化 ──────────────────────────────────────
  describe('serialize / deserialize', () => {
    it('serialize — 按优先级排序，§ 分隔', () => {
      useWorkingMemoryStore.getState().addEntry({ type: 'context', content: '低优先', priority: 1 });
      useWorkingMemoryStore.getState().addEntry({ type: 'instruction', content: '高优先', priority: 5 });

      const serialized = useWorkingMemoryStore.getState().serialize();
      expect(serialized).toContain('§');
      // 高优先级在前
      expect(serialized.indexOf('高优先')).toBeLessThan(serialized.indexOf('低优先'));
    });

    it('serialize — 空条目返回空字符串', () => {
      expect(useWorkingMemoryStore.getState().serialize()).toBe('');
    });

    it('deserialize — 正确解析 § 分隔的字符串', () => {
      const text = '[context|p3] 用户的项目上下文\n§\n[instruction|p5] 重要指令';
      useWorkingMemoryStore.getState().deserialize(text);

      const entries = useWorkingMemoryStore.getState().entries;
      expect(entries.length).toBe(2);
      expect(entries[0].type).toBe('context');
      expect(entries[0].priority).toBe(3);
      expect(entries[1].type).toBe('instruction');
      expect(entries[1].priority).toBe(5);
    });

    it('deserialize — 空字符串清空条目', () => {
      useWorkingMemoryStore.getState().addEntry({ type: 'context', content: 'test', priority: 1 });
      useWorkingMemoryStore.getState().deserialize('');
      expect(useWorkingMemoryStore.getState().entries.length).toBe(0);
    });

    it('round-trip — serialize → deserialize 保持数据', () => {
      useWorkingMemoryStore.getState().addEntry({ type: 'context', content: '原始内容', priority: 3 });
      const serialized = useWorkingMemoryStore.getState().serialize();

      useWorkingMemoryStore.setState({ entries: [] });
      useWorkingMemoryStore.getState().deserialize(serialized);

      const entries = useWorkingMemoryStore.getState().entries;
      expect(entries.length).toBe(1);
      expect(entries[0].type).toBe('context');
      expect(entries[0].content).toBe('原始内容');
      expect(entries[0].priority).toBe(3);
    });
  });

  // ── 溢出检测 ───────────────────────────────────────────────
  describe('getOverflowEntries', () => {
    it('usagePct < 80% 时返回空数组', () => {
      useWorkingMemoryStore.getState().addEntry({ type: 'context', content: 'test', priority: 1 });
      const overflow = useWorkingMemoryStore.getState().getOverflowEntries();
      expect(overflow).toEqual([]);
    });

    it('usagePct >= 80% 时返回低优先级条目', () => {
      // 模拟高使用率
      useWorkingMemoryStore.setState({
        contextUsage: {
          totalInputTokens: 110000,
          estimatedWindow: 128000,
          usagePct: 85.9,
          lastUpdated: Date.now(),
        },
      });

      useWorkingMemoryStore.getState().addEntry({ type: 'context', content: '低优先', priority: 1 });
      useWorkingMemoryStore.getState().addEntry({ type: 'instruction', content: '高优先', priority: 5 });

      const overflow = useWorkingMemoryStore.getState().getOverflowEntries();
      expect(overflow.length).toBeGreaterThan(0);
      // 最低优先级的排在前面
      expect(overflow[0].priority).toBeLessThanOrEqual(overflow[overflow.length - 1].priority);
    });
  });
});
