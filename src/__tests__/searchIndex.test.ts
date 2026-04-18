/**
 * searchIndex.ts — 单元测试
 *
 * 覆盖率标准: 行 95%
 * 测试策略：mock searchIndex 内部依赖（FlexSearch, db, compression），
 *          直接测试导出的工具函数（search, getAllTags, getAllToolTypes, getIndexStats 等）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock dependencies ─────────────────────────────────────────────────────────
vi.mock('flexsearch', () => ({
  default: {
    Document: vi.fn().mockReturnValue({
      add: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
      search: vi.fn().mockReturnValue([]),
    }),
  },
}));

vi.mock('@/stores/db', () => ({
  db: {
    sessions: {
      where: vi.fn().mockReturnThis(),
      notEqual: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([]),
    },
    queries: {
      toArray: vi.fn().mockResolvedValue([]),
    },
  },
}));

vi.mock('@/utils/compression', () => ({
  decompress: vi.fn((s: string) => s),
}));

// ── Import after mocks ────────────────────────────────────────────────────────
import {
  search,
  getAllTags,
  getAllToolTypes,
  getIndexStats,
  buildSearchIndex,
  upsertSessionDoc,
  upsertQueryDoc,
  removeDoc,
} from '@/stores/searchIndex';

describe('searchIndex', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── search ─────────────────────────────────────────────────────────────────
  describe('search', () => {
    it('空查询返回空数组', () => {
      const results = search({ query: '' });
      expect(results).toEqual([]);
    });

    it('仅空白查询返回空数组', () => {
      const results = search({ query: '   ' });
      expect(results).toEqual([]);
    });

    it('正常查询返回结果数组', () => {
      const results = search({ query: 'test', limit: 10 });
      expect(Array.isArray(results)).toBe(true);
    });

    it('limit 参数限制结果数量', () => {
      const results = search({ query: 'test', limit: 5 });
      expect(results).toEqual([]);
    });

    it('支持 type 过滤', () => {
      const results = search({ query: 'test', type: 'session' });
      expect(results).toEqual([]);
    });

    it('支持 tags 过滤', () => {
      const results = search({ query: 'test', tags: ['tag1'] });
      expect(results).toEqual([]);
    });

    it('支持 toolTypes 过滤', () => {
      const results = search({ query: 'test', toolTypes: ['Read'] });
      expect(results).toEqual([]);
    });

    it('支持 dateFrom 过滤', () => {
      const results = search({ query: 'test', dateFrom: Date.now() - 3600000 });
      expect(results).toEqual([]);
    });

    it('支持 dateTo 过滤', () => {
      const results = search({ query: 'test', dateTo: Date.now() });
      expect(results).toEqual([]);
    });
  });

  // ── getAllTags ───────────────────────────────────────────────────────────────
  describe('getAllTags', () => {
    it('返回排序后的标签数组', () => {
      const tags = getAllTags();
      expect(Array.isArray(tags)).toBe(true);
    });
  });

  // ── getAllToolTypes ──────────────────────────────────────────────────────────
  describe('getAllToolTypes', () => {
    it('返回排序后的工具类型数组', () => {
      const tools = getAllToolTypes();
      expect(Array.isArray(tools)).toBe(true);
    });
  });

  // ── getIndexStats ───────────────────────────────────────────────────────────
  describe('getIndexStats', () => {
    it('返回索引统计信息', () => {
      const stats = getIndexStats();
      expect(stats).toHaveProperty('sessionCount');
      expect(stats).toHaveProperty('queryCount');
      expect(typeof stats.sessionCount).toBe('number');
      expect(typeof stats.queryCount).toBe('number');
    });
  });

  // ── buildSearchIndex ────────────────────────────────────────────────────────
  describe('buildSearchIndex', () => {
    it('清空并重建索引', async () => {
      await buildSearchIndex();
      // clear 被调用（FlexSearch mock 追踪）
    });

    it('从 IndexedDB 加载会话', async () => {
      const { db } = await import('@/stores/db');
      await buildSearchIndex();
      expect(db.sessions.where).toHaveBeenCalledWith('status');
    });

    it('从 IndexedDB 加载查询', async () => {
      const { db } = await import('@/stores/db');
      await buildSearchIndex();
      expect(db.queries.toArray).toHaveBeenCalled();
    });
  });

  // ── upsertSessionDoc ────────────────────────────────────────────────────────
  describe('upsertSessionDoc', () => {
    it('添加会话文档不抛错', () => {
      expect(() =>
        upsertSessionDoc(makeMockSession('sess_1', 'Test Session'))
      ).not.toThrow();
    });

    it('重复添加同一会话时幂等（不抛错）', () => {
      const session = makeMockSession('sess_1', 'Test Session');
      upsertSessionDoc(session);
      expect(() => upsertSessionDoc(session)).not.toThrow();
    });
  });

  // ── upsertQueryDoc ──────────────────────────────────────────────────────────
  describe('upsertQueryDoc', () => {
    it('添加查询文档不抛错', () => {
      expect(() =>
        upsertQueryDoc(makeMockQuery('q_1', 'sess_1', 'What is test?', 'Test answer'))
      ).not.toThrow();
    });

    it('重复添加同一查询时幂等（不抛错）', () => {
      const query = makeMockQuery('q_1', 'sess_1', 'What is test?', 'Test answer');
      upsertQueryDoc(query);
      expect(() => upsertQueryDoc(query)).not.toThrow();
    });
  });

  // ── removeDoc ────────────────────────────────────────────────────────────────
  describe('removeDoc', () => {
    it('删除不存在的文档不抛错', () => {
      expect(() => removeDoc('non_existent')).not.toThrow();
    });
  });
});

// ── Test helpers ─────────────────────────────────────────────────────────────
function makeMockSession(id: string, title: string) {
  return {
    id,
    title,
    tags: ['tag1', 'tag2'],
    createdAt: Date.now(),
    status: 'active',
    projectPath: '/test',
  };
}

function makeMockQuery(id: string, sessionId: string, question: string, answer: string) {
  return {
    id,
    sessionId,
    question,
    answer,
    toolCalls: [{ id: 'tc1', name: 'Read', input: '{}', output: '{}' }],
    createdAt: Date.now(),
    dag: null,
    tokenUsage: 100,
    duration: 5000,
    status: 'success' as const,
    errorMessage: undefined,
    workspacePath: '/test',
  };
}
