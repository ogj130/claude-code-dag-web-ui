/**
 * db.test.ts — 测试 src/lib/db.ts
 *
 * fake-indexeddb/auto 已通过 vitest.config.ts setupFiles 全局配置，无需再次导入。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import Dexie from 'dexie';
import {
  db,
  createSession,
  getSession,
  updateSession,
  deleteSession,
  listRecentSessions,
  getAllSessionIds,
  createQuery,
  getQuery,
  updateQuery,
  deleteQuery,
  listQueriesBySession,
  estimateStorageUsage,
  getStorageQuota,
  isStorageNearlyFull,
  evictOldestSessions,
  type SessionRecord,
  type QueryRecord,
} from '@/lib/db';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSession(overrides: Partial<SessionRecord> = {}): SessionRecord {
  const now = Date.now();
  return {
    id: `session_${now}_${Math.random().toString(36).substring(2, 8)}`,
    name: 'Test Session',
    projectPath: '/tmp/test-project',
    createdAt: now,
    updatedAt: now,
    isActive: true,
    queryCount: 0,
    tokenCount: 0,
    ...overrides,
  };
}

function makeQuery(sessionId: string, overrides: Partial<QueryRecord> = {}): QueryRecord {
  const now = Date.now();
  return {
    id: `query_${now}_${Math.random().toString(36).substring(2, 8)}`,
    sessionId,
    query: 'What is TypeScript?',
    summary: 'TypeScript is a typed superset of JavaScript.',
    timestamp: now,
    tokenCount: 100,
    toolCount: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// CCWebDB 实例导出
// ---------------------------------------------------------------------------

describe('CCWebDB instance exports', () => {
  it('db is a Dexie instance', () => {
    expect(db).toBeInstanceOf(Dexie);
  });

  it('db has sessions and queries tables', () => {
    expect(db.sessions).toBeDefined();
    expect(db.queries).toBeDefined();
  });

  it('all CRUD functions are exported as functions', () => {
    expect(typeof createSession).toBe('function');
    expect(typeof getSession).toBe('function');
    expect(typeof updateSession).toBe('function');
    expect(typeof deleteSession).toBe('function');
    expect(typeof listRecentSessions).toBe('function');
    expect(typeof getAllSessionIds).toBe('function');
    expect(typeof createQuery).toBe('function');
    expect(typeof getQuery).toBe('function');
    expect(typeof updateQuery).toBe('function');
    expect(typeof deleteQuery).toBe('function');
    expect(typeof listQueriesBySession).toBe('function');
    expect(typeof estimateStorageUsage).toBe('function');
    expect(typeof getStorageQuota).toBe('function');
    expect(typeof isStorageNearlyFull).toBe('function');
    expect(typeof evictOldestSessions).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// sessions 表 CRUD
// ---------------------------------------------------------------------------

describe('sessions table', () => {
  beforeEach(async () => {
    await db.sessions.clear();
  });

  // ── createSession ──────────────────────────────────────────────────────────

  it('createSession 写入后 getSession 能查到', async () => {
    const session = makeSession({ id: 'sess_test_1' });
    const id = await createSession(session);

    const found = await getSession(id);

    expect(found).not.toBeUndefined();
    expect(found!.id).toBe(id);
    expect(found!.name).toBe('Test Session');
    expect(found!.projectPath).toBe('/tmp/test-project');
  });

  it('createSession 返回记录的 id', async () => {
    const session = makeSession({ id: 'sess_test_2' });
    const id = await createSession(session);
    expect(id).toBe('sess_test_2');
  });

  // ── getSession ─────────────────────────────────────────────────────────────

  it('getSession 不存在的 id 返回 undefined', async () => {
    const found = await getSession('non_existent_session_id');
    expect(found).toBeUndefined();
  });

  // ── updateSession ─────────────────────────────────────────────────────────

  it('updateSession 能更新字段', async () => {
    const oldTimestamp = Date.now() - 10000; // 确保明显早于 updateSession 的调用时间
    const session = makeSession({ id: 'sess_update_1', name: 'Old Name', updatedAt: oldTimestamp });
    await createSession(session);

    await updateSession('sess_update_1', { name: 'New Name' });

    const found = await getSession('sess_update_1');
    expect(found!.name).toBe('New Name');
    expect(found!.updatedAt).toBeGreaterThan(oldTimestamp);
  });

  it('updateSession 更新不存在的记录不抛错', async () => {
    await expect(
      updateSession('non_existent_session', { name: 'Ghost' })
    ).resolves.not.toThrow();
  });

  // ── deleteSession ─────────────────────────────────────────────────────────

  it('deleteSession 删除后 getSession 返回 undefined', async () => {
    const session = makeSession({ id: 'sess_delete_1' });
    await createSession(session);

    await deleteSession('sess_delete_1');

    const found = await getSession('sess_delete_1');
    expect(found).toBeUndefined();
  });

  it('deleteSession 同时删除关联的 queries', async () => {
    const session = makeSession({ id: 'sess_delete_queries_1' });
    await createSession(session);
    await createQuery(makeQuery('sess_delete_queries_1', { id: 'q_del_1' }));
    await createQuery(makeQuery('sess_delete_queries_1', { id: 'q_del_2' }));

    await deleteSession('sess_delete_queries_1');

    const queries = await db.queries.where('sessionId').equals('sess_delete_queries_1').toArray();
    expect(queries).toHaveLength(0);
  });

  // ── listRecentSessions ────────────────────────────────────────────────────

  it('listRecentSessions 按 updatedAt 降序返回', async () => {
    const s1 = makeSession({ id: 'sess_recent_1', updatedAt: 1000 });
    const s2 = makeSession({ id: 'sess_recent_2', updatedAt: 2000 });
    const s3 = makeSession({ id: 'sess_recent_3', updatedAt: 3000 });
    await createSession(s1);
    await createSession(s2);
    await createSession(s3);

    const results = await listRecentSessions();

    expect(results[0].id).toBe('sess_recent_3');
    expect(results[1].id).toBe('sess_recent_2');
    expect(results[2].id).toBe('sess_recent_1');
  });

  it('listRecentSessions 支持 limit', async () => {
    for (let i = 0; i < 5; i++) {
      await createSession(makeSession({ id: `sess_limit_${i}`, updatedAt: i * 1000 }));
    }

    const results = await listRecentSessions(3);

    expect(results).toHaveLength(3);
  });

  it('listRecentSessions 支持 offset', async () => {
    for (let i = 0; i < 5; i++) {
      await createSession(makeSession({ id: `sess_offset_${i}`, updatedAt: i * 1000 }));
    }

    const results = await listRecentSessions(10, 2);

    expect(results).toHaveLength(3);
    expect(results[0].id).toBe('sess_offset_2');
  });

  // ── getAllSessionIds ──────────────────────────────────────────────────────

  it('getAllSessionIds 返回所有会话的 id', async () => {
    await createSession(makeSession({ id: 'sess_ids_1' }));
    await createSession(makeSession({ id: 'sess_ids_2' }));

    const ids = await getAllSessionIds();

    expect(ids).toContain('sess_ids_1');
    expect(ids).toContain('sess_ids_2');
  });

  it('getAllSessionIds 空表返回空数组', async () => {
    const ids = await getAllSessionIds();
    expect(ids).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// queries 表 CRUD
// ---------------------------------------------------------------------------

describe('queries table', () => {
  beforeEach(async () => {
    await db.queries.clear();
  });

  // ── createQuery ───────────────────────────────────────────────────────────

  it('createQuery 写入后 getQuery 能查到', async () => {
    await createSession(makeSession({ id: 'sess_q_1' }));
    const query = makeQuery('sess_q_1', { id: 'q_test_1' });
    const id = await createQuery(query);

    const found = await getQuery(id);

    expect(found).not.toBeUndefined();
    expect(found!.id).toBe(id);
    expect(found!.query).toBe('What is TypeScript?');
  });

  it('createQuery 返回记录的 id', async () => {
    await createSession(makeSession({ id: 'sess_q_2' }));
    const query = makeQuery('sess_q_2', { id: 'q_test_2' });
    const id = await createQuery(query);
    expect(id).toBe('q_test_2');
  });

  // ── getQuery ──────────────────────────────────────────────────────────────

  it('getQuery 不存在的 id 返回 undefined', async () => {
    const found = await getQuery('non_existent_query_id');
    expect(found).toBeUndefined();
  });

  // ── updateQuery ───────────────────────────────────────────────────────────

  it('updateQuery 能更新字段', async () => {
    await createSession(makeSession({ id: 'sess_uq_1' }));
    await createQuery(makeQuery('sess_uq_1', { id: 'q_update_1', summary: 'Old Summary' }));

    await updateQuery('q_update_1', { summary: 'New Summary' });

    const found = await getQuery('q_update_1');
    expect(found!.summary).toBe('New Summary');
  });

  it('updateQuery 更新不存在的记录不抛错', async () => {
    await expect(
      updateQuery('non_existent_query', { summary: 'Ghost' })
    ).resolves.not.toThrow();
  });

  // ── deleteQuery ───────────────────────────────────────────────────────────

  it('deleteQuery 删除后 getQuery 返回 undefined', async () => {
    await createSession(makeSession({ id: 'sess_dq_1' }));
    await createQuery(makeQuery('sess_dq_1', { id: 'q_delete_1' }));

    await deleteQuery('q_delete_1');

    const found = await getQuery('q_delete_1');
    expect(found).toBeUndefined();
  });

  // ── listQueriesBySession ──────────────────────────────────────────────────

  it('listQueriesBySession 返回该会话的所有记录（按 timestamp 升序）', async () => {
    const sessionId = 'sess_list_q_1';
    await createSession(makeSession({ id: sessionId }));
    await createQuery(makeQuery(sessionId, { id: 'lq_1', timestamp: 1000 }));
    await createQuery(makeQuery(sessionId, { id: 'lq_2', timestamp: 2000 }));
    await createQuery(makeQuery(sessionId, { id: 'lq_3', timestamp: 3000 }));

    const results = await listQueriesBySession(sessionId);

    expect(results).toHaveLength(3);
    expect(results[0].id).toBe('lq_1');
    expect(results[1].id).toBe('lq_2');
    expect(results[2].id).toBe('lq_3');
  });

  it('listQueriesBySession 不存在的会话返回空数组', async () => {
    const results = await listQueriesBySession('non_existent_session_for_queries');
    expect(results).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// qaHistory 表（db.ts 中无此表，验证不存在）
// ---------------------------------------------------------------------------

describe('qaHistory table', () => {
  it('sessions 表不包含 qaHistory 属性（qaHistory 在 stores/db.ts 中）', () => {
    // src/lib/db.ts 的 CCDatabase 只有 sessions 和 queries 两个表
    expect((db as unknown as Record<string, unknown>).qaHistory).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// fileChanges 表（db.ts 中无此表，验证不存在）
// ---------------------------------------------------------------------------

describe('fileChanges table', () => {
  it('sessions 表不包含 fileChanges 属性（fileChanges 在 stores/db.ts 中）', () => {
    // src/lib/db.ts 的 CCDatabase 只有 sessions 和 queries 两个表
    expect((db as unknown as Record<string, unknown>).fileChanges).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 存储管理函数
// ---------------------------------------------------------------------------

describe('storage management functions', () => {
  beforeEach(async () => {
    await db.sessions.clear();
    await db.queries.clear();
  });

  afterEach(() => {
    // 清理全局 mock，避免污染其他测试
    Object.defineProperty(navigator, 'storage', {
      value: undefined,
      writable: true,
      configurable: true,
    });
  });

  // ── estimateStorageUsage ───────────────────────────────────────────────────

  it('estimateStorageUsage navigator.storage 可用时使用 estimate API', async () => {
    Object.defineProperty(navigator, 'storage', {
      value: { estimate: async () => ({ usage: 2048, quota: 10240 }) },
      writable: true,
      configurable: true,
    });

    const usage = await estimateStorageUsage();
    expect(usage).toBe(2048);
  });

  it('estimateStorageUsage estimate.usage 为 null/undefined 时返回 0', async () => {
    Object.defineProperty(navigator, 'storage', {
      value: { estimate: async () => ({ usage: null as number | null, quota: 10240 }) },
      writable: true,
      configurable: true,
    });

    const usage = await estimateStorageUsage();
    expect(usage).toBe(0);
  });

  it('estimateStorageUsage fallback: 无 navigator.storage 时使用 Blob 估算', async () => {
    Object.defineProperty(navigator, 'storage', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    await createSession(makeSession({ id: 'sess_fallback_1' }));

    const usage = await estimateStorageUsage();
    expect(usage).toBeGreaterThan(0);
  });

  // ── getStorageQuota ───────────────────────────────────────────────────────

  it('getStorageQuota navigator.storage 可用时返回 quota', async () => {
    Object.defineProperty(navigator, 'storage', {
      value: { estimate: async () => ({ usage: 1000, quota: 5000 }) },
      writable: true,
      configurable: true,
    });

    const quota = await getStorageQuota();
    expect(quota).toBe(5000);
  });

  it('getStorageQuota estimate.quota 为 null/undefined 时返回 0', async () => {
    Object.defineProperty(navigator, 'storage', {
      value: { estimate: async () => ({ usage: 1000, quota: null as number | null }) },
      writable: true,
      configurable: true,
    });

    const quota = await getStorageQuota();
    expect(quota).toBe(0);
  });

  it('getStorageQuota 无 navigator.storage 时返回 0', async () => {
    Object.defineProperty(navigator, 'storage', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const quota = await getStorageQuota();
    expect(quota).toBe(0);
  });

  // ── isStorageNearlyFull ───────────────────────────────────────────────────

  it('isStorageNearlyFull quota=0 时提前返回 false', async () => {
    Object.defineProperty(navigator, 'storage', {
      value: { estimate: async () => ({ usage: 9999, quota: 0 }) },
      writable: true,
      configurable: true,
    });

    const result = await isStorageNearlyFull();
    expect(result).toBe(false);
  });

  it('isStorageNearlyFull 超过 80% 阈值时返回 true', async () => {
    Object.defineProperty(navigator, 'storage', {
      value: { estimate: async () => ({ usage: 9000, quota: 10000 }) },
      writable: true,
      configurable: true,
    });

    const result = await isStorageNearlyFull();
    expect(result).toBe(true);
  });

  it('isStorageNearlyFull 未超过 80% 阈值时返回 false', async () => {
    Object.defineProperty(navigator, 'storage', {
      value: { estimate: async () => ({ usage: 5000, quota: 10000 }) },
      writable: true,
      configurable: true,
    });

    const result = await isStorageNearlyFull();
    expect(result).toBe(false);
  });

  it('isStorageNearlyFull 无 navigator.storage 时返回 false', async () => {
    Object.defineProperty(navigator, 'storage', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const result = await isStorageNearlyFull();
    expect(result).toBe(false);
  });

  // ── evictOldestSessions ───────────────────────────────────────────────────

  it('evictOldestSessions 删除最旧的 N 条会话', async () => {
    const s1 = makeSession({ id: 'sess_evict_1', updatedAt: 1000 });
    const s2 = makeSession({ id: 'sess_evict_2', updatedAt: 2000 });
    const s3 = makeSession({ id: 'sess_evict_3', updatedAt: 3000 });
    await createSession(s1);
    await createSession(s2);
    await createSession(s3);

    const deleted = await evictOldestSessions(2);

    expect(deleted).toContain('sess_evict_1');
    expect(deleted).toContain('sess_evict_2');
    expect(deleted).not.toContain('sess_evict_3');

    const remaining = await listRecentSessions();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('sess_evict_3');
  });

  it('evictOldestSessions 删除时同时清理关联 queries', async () => {
    const sessionId = 'sess_evict_q_1';
    await createSession(makeSession({ id: sessionId, updatedAt: 1000 }));
    await createQuery(makeQuery(sessionId, { id: 'evict_q_1' }));

    await evictOldestSessions(1);

    const queries = await db.queries.where('sessionId').equals(sessionId).toArray();
    expect(queries).toHaveLength(0);
  });

  it('evictOldestSessions count=0 不删除任何会话', async () => {
    await createSession(makeSession({ id: 'sess_evict_zero' }));
    const deleted = await evictOldestSessions(0);
    expect(deleted).toEqual([]);
    const remaining = await listRecentSessions();
    expect(remaining).toHaveLength(1);
  });

  it('evictOldestSessions count 超过总数时只删除存在的会话', async () => {
    await createSession(makeSession({ id: 'sess_evict_many_1' }));
    await createSession(makeSession({ id: 'sess_evict_many_2' }));

    const deleted = await evictOldestSessions(100);

    expect(deleted).toHaveLength(2);
    const remaining = await listRecentSessions();
    expect(remaining).toHaveLength(0);
  });
});
