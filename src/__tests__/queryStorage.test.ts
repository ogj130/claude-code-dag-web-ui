/**
 * queryStorage.ts — 单元测试
 *
 * 覆盖率标准: 行 95%
 * 测试策略：mock IndexedDB (lib/db) 和 vectorStorage，验证 CRUD 函数
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock lib/db (inline factory to avoid hoisting) ────────────────────────────
vi.mock('@/lib/db', () => ({
  db: {
    queries: {
      add: vi.fn().mockResolvedValue('q_new_id'),
      get: vi.fn(),
      update: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      where: vi.fn().mockReturnThis(),
      equals: vi.fn().mockReturnThis(),
      count: vi.fn().mockResolvedValue(0),
      toArray: vi.fn().mockResolvedValue([]),
      reverse: vi.fn().mockReturnThis(),
      sortBy: vi.fn().mockResolvedValue([]),
      bulkAdd: vi.fn().mockResolvedValue(undefined),
    },
    sessions: {
      get: vi.fn().mockResolvedValue({ id: 's1', projectPath: '/test', name: 'Test' }),
    },
  },
}));

// ── Mock stats db (stores/db) ─────────────────────────────────────────────────
vi.mock('@/stores/db', () => ({
  db: {
    queries: {
      add: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
    },
  },
}));

// ── Mock sessionStorage ────────────────────────────────────────────────────────
vi.mock('@/stores/sessionStorage', () => ({
  updateSession: vi.fn().mockResolvedValue(undefined),
}));

// ── Mock vectorStorage (auto-indexing) ───────────────────────────────────────
vi.mock('@/stores/vectorStorage', () => ({
  indexQueryChunk: vi.fn().mockResolvedValue('vc_1'),
  indexAnswerChunks: vi.fn().mockResolvedValue(['vc_2']),
}));

// ── Import after mocks ────────────────────────────────────────────────────────
import {
  createQuery,
  getQuery,
  updateQuery,
  updateQueryTokenUsage,
  deleteQuery,
  getQueriesBySession,
  getLatestQuery,
  deleteQueriesBySession,
  getQueriesByStatus,
  searchQueries,
  getErrorQueries,
  getQueryStats,
  batchCreateQueries,
} from '@/stores/queryStorage';

// ── Dexie chain helper (module scope for use in individual tests) ──────────────
function makeQueryChain(overrides: Partial<ReturnType<typeof makeQueryChain>> = {}) {
  const chain = {
    where: vi.fn().mockReturnThis(),
    equals: vi.fn().mockReturnThis(),
    reverse: vi.fn().mockReturnThis(),
    sortBy: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(undefined),
    count: vi.fn().mockResolvedValue(0),
    toArray: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
  return chain;
}

describe('queryStorage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Re-setup default resolved values
    const { db } = await import('@/lib/db');
    db.queries.get.mockResolvedValue(undefined);
    db.sessions.get.mockResolvedValue({ id: 's1', projectPath: '/test', name: 'Test' });
    db.queries.toArray.mockResolvedValue([]);
    db.queries.count.mockResolvedValue(0);
    db.queries.sortBy.mockResolvedValue([]);
    db.queries.where.mockImplementation(() => makeQueryChain());
  });

  // ── createQuery ─────────────────────────────────────────────────────────────
  describe('createQuery', () => {
    it('创建 Query 记录并存入 IndexedDB', async () => {
      const { db } = await import('@/lib/db');
      const record = await createQuery({
        sessionId: 's1',
        question: 'What is test?',
        answer: 'Test answer',
        tokenUsage: 100,
        status: 'success',
      });
      expect(db.queries.add).toHaveBeenCalled();
      expect(record).toHaveProperty('id');
      expect(record.sessionId).toBe('s1');
    });

    it('toolCalls 为空时 toolCount 为 0', async () => {
      const record = await createQuery({
        sessionId: 's1',
        question: 'What is test?',
        answer: 'Test answer',
        tokenUsage: 100,
        status: 'success',
      });
      expect(record.toolCount).toBe(0);
    });

    it('包含 toolCalls 时 toolCount 正确', async () => {
      const record = await createQuery({
        sessionId: 's1',
        question: 'What is test?',
        answer: 'Test answer',
        tokenUsage: 100,
        status: 'success',
        toolCalls: [
          { id: 'tc1', name: 'Read', input: '{}', output: '{}' },
          { id: 'tc2', name: 'Write', input: '{}', output: '{}' },
        ],
      });
      expect(record.toolCount).toBe(2);
    });

    it('有 dag 时将其序列化存入 metadata', async () => {
      const dag = { nodes: [], edges: [] };
      const record = await createQuery({
        sessionId: 's1',
        question: 'Test',
        answer: 'Answer',
        tokenUsage: 100,
        status: 'success',
        dag,
      });
      expect(record.metadata).toBeDefined();
    });
  });

  // ── getQuery ────────────────────────────────────────────────────────────────
  describe('getQuery', () => {
    it('返回 Query 记录', async () => {
      const { db } = await import('@/lib/db');
      db.queries.get.mockResolvedValue({ id: 'q1', sessionId: 's1', query: 'test', summary: 'ans' });
      const result = await getQuery('q1');
      expect(result).toEqual({ id: 'q1', sessionId: 's1', query: 'test', summary: 'ans' });
    });

    it('不存在时返回 undefined', async () => {
      const { db } = await import('@/lib/db');
      db.queries.get.mockResolvedValue(undefined);
      const result = await getQuery('non_existent');
      expect(result).toBeUndefined();
    });
  });

  // ── updateQuery ─────────────────────────────────────────────────────────────
  describe('updateQuery', () => {
    it('更新 Query 的 summary', async () => {
      const { db } = await import('@/lib/db');
      db.queries.get.mockResolvedValue({ id: 'q1', summary: 'new' });
      await updateQuery('q1', { summary: 'new summary' });
      expect(db.queries.update).toHaveBeenCalledWith('q1', { summary: 'new summary' });
    });

    it('更新 Query 的 metadata', async () => {
      const { db } = await import('@/lib/db');
      db.queries.get.mockResolvedValue({ id: 'q1' });
      await updateQuery('q1', { metadata: '{"key":"value"}' });
      expect(db.queries.update).toHaveBeenCalledWith('q1', { metadata: '{"key":"value"}' });
    });
  });

  // ── updateQueryTokenUsage ──────────────────────────────────────────────────
  describe('updateQueryTokenUsage', () => {
    it('更新 stats DB 中的 tokenUsage', async () => {
      await updateQueryTokenUsage('q1', 500);
      const { db: statsDb } = await import('@/stores/db');
      expect(statsDb.queries.update).toHaveBeenCalledWith('q1', { tokenUsage: 500 });
    });
  });

  // ── deleteQuery ─────────────────────────────────────────────────────────────
  describe('deleteQuery', () => {
    it('从 IndexedDB 删除 Query', async () => {
      const { db } = await import('@/lib/db');
      await deleteQuery('q1');
      expect(db.queries.delete).toHaveBeenCalledWith('q1');
    });
  });

  // ── getQueriesBySession ──────────────────────────────────────────────────────
  describe('getQueriesBySession', () => {
    it('返回分页结果', async () => {
      const results = await getQueriesBySession('s1', { page: 1, pageSize: 10 });
      expect(results).toHaveProperty('items');
      expect(results).toHaveProperty('total');
      expect(results).toHaveProperty('page');
      expect(results).toHaveProperty('pageSize');
      expect(results).toHaveProperty('totalPages');
      expect(results).toHaveProperty('hasMore');
    });

    it('分页 offset 计算正确', async () => {
      const results = await getQueriesBySession('s1', { page: 3, pageSize: 10 });
      expect(results.page).toBe(3);
    });
  });

  // ── getLatestQuery ──────────────────────────────────────────────────────────
  describe('getLatestQuery', () => {
    it('返回最新 Query', async () => {
      const { db } = await import('@/lib/db');
      // Override the reverse().sortBy() chain
      db.queries.where.mockImplementation(() => {
        const chain = makeQueryChain();
        chain.equals = vi.fn().mockReturnValue({
          reverse: vi.fn().mockReturnValue({
            sortBy: vi.fn().mockResolvedValue([
              { id: 'q3', timestamp: 300 },
              { id: 'q1', timestamp: 100 },
            ]),
          }),
        });
        return chain;
      });
      const result = await getLatestQuery('s1');
      expect(result).toEqual({ id: 'q3', timestamp: 300 });
    });

    it('无记录时返回 undefined', async () => {
      const { db } = await import('@/lib/db');
      db.queries.sortBy.mockResolvedValue([]);
      const result = await getLatestQuery('s1');
      expect(result).toBeUndefined();
    });
  });

  // ── deleteQueriesBySession ──────────────────────────────────────────────────
  describe('deleteQueriesBySession', () => {
    it('删除会话所有 Query 并返回数量', async () => {
      const { db } = await import('@/lib/db');
      // Override the where chain's toArray to return test data
      db.queries.where.mockImplementation(() => {
        const chain = makeQueryChain();
        chain.equals = vi.fn().mockReturnValue({
          ...chain,
          toArray: vi.fn().mockResolvedValue([{ id: 'q1' }, { id: 'q2' }]),
          delete: vi.fn().mockResolvedValue(undefined),
        });
        return chain;
      });
      const count = await deleteQueriesBySession('s1');
      expect(count).toBe(2);
    });

    it('无 Query 时返回 0', async () => {
      const { db } = await import('@/lib/db');
      db.queries.toArray.mockResolvedValue([]);
      const count = await deleteQueriesBySession('s1');
      expect(count).toBe(0);
    });
  });

  // ── getQueriesByStatus ──────────────────────────────────────────────────────
  describe('getQueriesByStatus', () => {
    it('按 status 过滤并分页', async () => {
      const { db } = await import('@/lib/db');
      db.queries.toArray.mockResolvedValue([
        { id: 'q1', metadata: JSON.stringify({ status: 'success' }) },
      ]);
      const results = await getQueriesByStatus('success');
      expect(results).toHaveProperty('items');
    });

    it('metadata 解析失败时不崩溃', async () => {
      const { db } = await import('@/lib/db');
      db.queries.toArray.mockResolvedValue([
        { id: 'q1', metadata: 'invalid-json' },
      ]);
      const results = await getQueriesByStatus('success');
      expect(results.items).toHaveLength(0);
    });
  });

  // ── searchQueries ────────────────────────────────────────────────────────────
  describe('searchQueries', () => {
    it('按关键词过滤查询', async () => {
      const { db } = await import('@/lib/db');
      db.queries.toArray.mockResolvedValue([
        { id: 'q1', query: 'What is React?', summary: 'A library' },
      ]);
      const results = await searchQueries('React');
      expect(results.items.some((q) => q.query.includes('React'))).toBe(true);
    });

    it('不区分大小写', async () => {
      const { db } = await import('@/lib/db');
      db.queries.toArray.mockResolvedValue([
        { id: 'q1', query: 'WHAT IS TEST', summary: '' },
      ]);
      const results = await searchQueries('what');
      expect(results.items).toHaveLength(1);
    });
  });

  // ── getErrorQueries ─────────────────────────────────────────────────────────
  describe('getErrorQueries', () => {
    it('委托给 getQueriesByStatus', async () => {
      const { db } = await import('@/lib/db');
      db.queries.toArray.mockResolvedValue([]);
      const results = await getErrorQueries();
      expect(results).toHaveProperty('items');
    });
  });

  // ── getQueryStats ────────────────────────────────────────────────────────────
  describe('getQueryStats', () => {
    it('返回统计信息', async () => {
      const { db } = await import('@/lib/db');
      db.queries.toArray.mockResolvedValue([
        { id: 'q1', tokenCount: 100, metadata: JSON.stringify({ status: 'success', duration: 5000 }) },
        { id: 'q2', tokenCount: 200, metadata: JSON.stringify({ status: 'error' }) },
      ]);
      const stats = await getQueryStats();
      expect(stats.total).toBe(2);
      expect(stats.success).toBe(1);
      expect(stats.error).toBe(1);
      expect(stats.totalTokenUsage).toBe(300);
    });

    it('指定 sessionId 时仅统计该会话', async () => {
      const stats = await getQueryStats('s1');
      expect(stats).toHaveProperty('total');
    });

    it('无记录时 avgDuration 为 0', async () => {
      const { db } = await import('@/lib/db');
      db.queries.toArray.mockResolvedValue([]);
      const stats = await getQueryStats();
      expect(stats.avgDuration).toBe(0);
    });
  });

  // ── batchCreateQueries ─────────────────────────────────────────────────────
  describe('batchCreateQueries', () => {
    it('批量创建 Query 记录', async () => {
      const { db } = await import('@/lib/db');
      const inputs = [
        { sessionId: 's1', question: 'Q1', answer: 'A1', tokenUsage: 100, status: 'success' as const },
        { sessionId: 's1', question: 'Q2', answer: 'A2', tokenUsage: 200, status: 'success' as const },
      ];
      const records = await batchCreateQueries(inputs);
      expect(db.queries.bulkAdd).toHaveBeenCalled();
      expect(records).toHaveLength(2);
      expect(records[0]).toHaveProperty('id');
    });
  });
});
