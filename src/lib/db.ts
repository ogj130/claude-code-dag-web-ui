/**
 * IndexedDB 存储层 — 基于 Dexie.js
 * 提供 sessions、queries 表的 CRUD 操作
 */
import Dexie, { type Table } from 'dexie';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SessionRecord {
  id: string;               // 主键：session_{timestamp}_{random}
  name: string;            // 会话名称
  projectPath: string;     // 项目路径
  createdAt: number;       // 创建时间戳（ms）
  updatedAt: number;        // 最后更新时间戳（ms）
  isActive: boolean;        // 是否为当前活跃会话
  // 摘要字段（方便列表展示）
  queryCount: number;      // 问答次数
  tokenCount: number;      // Token 消耗总量
  // 扩展字段（JSON 序列化）
  metadata?: string;        // JSON.stringify({ ... }) 后存储
}

export interface QueryRecord {
  id: string;              // 主键：query_{timestamp}_{random}
  sessionId: string;       // 关联的会话 ID
  query: string;           // 用户问题
  summary?: string;        // 总结文本
  analysis?: string;       // 分析过程（Markdown）
  timestamp: number;       // 提问时间
  tokenCount: number;      // 本次 Token 消耗
  toolCount: number;       // 工具调用次数
  projectPath?: string;    // 工作路径（用于按路径过滤统计）
  // 扩展字段（JSON 序列化）
  metadata?: string;        // JSON.stringify({ ... }) 后存储
}

// ---------------------------------------------------------------------------
// Database Definition
// ---------------------------------------------------------------------------

class CCDatabase extends Dexie {
  sessions!: Table<SessionRecord, string>;
  queries!: Table<QueryRecord, string>;

  constructor() {
    super('CCWebDB');

    this.version(2).stores({
      // & 表示主键（复合索引需在 Schema 中声明）
      sessions: '&id, updatedAt, createdAt, projectPath',
      // 字段必须在 Schema 中声明才会被 Dexie 持久化
      // projectPath 用于按工作路径过滤统计
      queries: '&id, sessionId, timestamp, tokenCount, query, summary, projectPath',
    });
  }
}

export const db = new CCDatabase();

// ---------------------------------------------------------------------------
// Session CRUD
// ---------------------------------------------------------------------------

/** 创建新会话（立即写入 IndexedDB） */
export async function createSession(record: SessionRecord): Promise<string> {
  await db.sessions.add(record);
  return record.id;
}

/** 按 ID 读取会话 */
export async function getSession(id: string): Promise<SessionRecord | undefined> {
  return db.sessions.get(id);
}

/** 按 ID 更新会话 */
export async function updateSession(
  id: string,
  updates: Partial<Omit<SessionRecord, 'id'>>
): Promise<void> {
  await db.sessions.update(id, { ...updates, updatedAt: Date.now() });
}

/** 删除会话（同时删除关联的 queries） */
export async function deleteSession(id: string): Promise<void> {
  await db.transaction('rw', [db.sessions, db.queries], async () => {
    await db.queries.where('sessionId').equals(id).delete();
    await db.sessions.delete(id);
  });
}

/**
 * 分页查询最近会话（按 updatedAt 降序）
 * @param limit 最大返回数量
 * @param offset 跳过数量
 */
export async function listRecentSessions(
  limit: number = 20,
  offset: number = 0
): Promise<SessionRecord[]> {
  return db.sessions
    .orderBy('updatedAt')
    .reverse()
    .offset(offset)
    .limit(limit)
    .toArray();
}

/** 获取所有会话 ID（用于快速检查） */
export async function getAllSessionIds(): Promise<string[]> {
  return db.sessions.orderBy('createdAt').primaryKeys();
}

// ---------------------------------------------------------------------------
// Query CRUD
// ---------------------------------------------------------------------------

/** 创建问答记录 */
export async function createQuery(record: QueryRecord): Promise<string> {
  await db.queries.add(record);
  return record.id;
}

/** 按 ID 读取问答记录 */
export async function getQuery(id: string): Promise<QueryRecord | undefined> {
  return db.queries.get(id);
}

/** 按 ID 更新问答记录 */
export async function updateQuery(
  id: string,
  updates: Partial<Omit<QueryRecord, 'id'>>
): Promise<void> {
  await db.queries.update(id, updates);
}

/** 删除问答记录 */
export async function deleteQuery(id: string): Promise<void> {
  await db.queries.delete(id);
}

/**
 * 查询指定会话的所有问答（按 timestamp 升序）
 * @param sessionId 会话 ID
 */
export async function listQueriesBySession(
  sessionId: string
): Promise<QueryRecord[]> {
  return db.queries
    .where('sessionId')
    .equals(sessionId)
    .sortBy('timestamp');
}

// ---------------------------------------------------------------------------
// Storage Metrics & Cleanup
// ---------------------------------------------------------------------------

/** 估算当前存储使用量（字节） */
export async function estimateStorageUsage(): Promise<number> {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    return (estimate.usage ?? 0);
  }
  // 降级：通过 IndexedDB 对象库估算
  const allSessions = await db.sessions.toArray();
  const allQueries = await db.queries.toArray();
  // 粗略估算：JSON 序列化后的大小
  return (
    new Blob([JSON.stringify(allSessions)]).size +
    new Blob([JSON.stringify(allQueries)]).size
  );
}

/** 获取存储容量上限（字节） */
export async function getStorageQuota(): Promise<number> {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    return (estimate.quota ?? 0);
  }
  return 0;
}

/** 存储空间是否接近满（> 80%） */
export async function isStorageNearlyFull(): Promise<boolean> {
  const [usage, quota] = await Promise.all([
    estimateStorageUsage(),
    getStorageQuota(),
  ]);
  if (quota === 0) return false;
  return usage / quota > 0.8;
}

/**
 * 触发清理：删除最旧的 N 条会话及其关联数据
 * @param count 删除数量
 * @returns 实际删除的会话 ID 列表
 */
export async function evictOldestSessions(count: number): Promise<string[]> {
  const oldest = await db.sessions
    .orderBy('updatedAt')
    .limit(count)
    .toArray();

  const ids = oldest.map(s => s.id);

  await db.transaction('rw', [db.sessions, db.queries], async () => {
    for (const id of ids) {
      await db.queries.where('sessionId').equals(id).delete();
      await db.sessions.delete(id);
    }
  });

  return ids;
}
