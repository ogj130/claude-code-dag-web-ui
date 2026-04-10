/**
 * IndexedDB 数据库定义 (Dexie.js)
 */

import Dexie, { type Table } from 'dexie';
import type {
  DBSession,
  DBQuery,
  SessionShard,
  ToolCall,
} from '@/types/storage';

/**
 * CC Web UI 数据库类
 * 使用 Dexie.js 进行 IndexedDB 操作
 */
export class CCDatabase extends Dexie {
  /** Session 表 */
  sessions!: Table<DBSession, string>;
  /** Query 表 */
  queries!: Table<DBQuery, string>;
  /** ToolCall 表 */
  toolCalls!: Table<ToolCall, string>;
  /** SessionShard 表（会话 > 10MB 时分片存储） */
  sessionShards!: Table<SessionShard, string>;

  constructor() {
    super('cc-web-ui');

    this.version(1).stores({
      // sessions 表索引
      // - id: 主键
      // - updatedAt: 用于排序和范围查询
      // - status: 用于筛选
      // - createdAt: 用于排序
      sessions: 'id, updatedAt, status, createdAt, *tags',

      // queries 表索引
      // - id: 主键
      // - sessionId: 用于关联查询
      // - createdAt: 用于排序
      // - status: 用于筛选
      queries: 'id, sessionId, createdAt, status',

      // toolCalls 表索引
      // - id: 主键
      // - queryId: 用于关联查询
      // - sessionId: 用于批量删除
      toolCalls: 'id, queryId, sessionId',

      // sessionShards 表索引
      // - id: 主键（格式：{sessionId}_shard_{index}）
      // - sessionId: 用于查询某会话的所有分片
      // - [sessionId+shardIndex]: 复合索引用于排序
      sessionShards: 'id, sessionId, [sessionId+shardIndex]',
    });

    // Version 2: 添加 accessCount 字段（用于历史召回频率评分）
    this.version(2).stores({
      sessions: 'id, updatedAt, status, createdAt, accessCount, *tags',
      queries: 'id, sessionId, createdAt, status, accessCount',
      toolCalls: 'id, queryId, sessionId',
      sessionShards: 'id, sessionId, [sessionId+shardIndex]',
    }).upgrade(async tx => {
      // 为现有记录添加默认 accessCount = 0
      await tx.table('sessions').toCollection().modify(session => {
        if (session.accessCount === undefined) {
          session.accessCount = 0;
        }
      });
      await tx.table('queries').toCollection().modify(query => {
        if (query.accessCount === undefined) {
          query.accessCount = 0;
        }
      });
    });

    // Version 3: 添加 workspacePath 索引
    this.version(3).stores({
      sessions: 'id, workspacePath, updatedAt, status, createdAt, accessCount, *tags',
      queries: 'id, sessionId, createdAt, status, accessCount',
      toolCalls: 'id, queryId, sessionId',
      sessionShards: 'id, sessionId, [sessionId+shardIndex]',
    });
  }
}

/** 数据库单例 */
export const db = new CCDatabase();

/**
 * 初始化数据库
 * 可以在应用启动时调用以确保数据库就绪
 */
export async function initDatabase(): Promise<void> {
  try {
    await db.open();
    console.info('[DB] IndexedDB initialized successfully');
  } catch (error) {
    console.error('[DB] Failed to initialize IndexedDB:', error);
    throw error;
  }
}

/**
 * 关闭数据库连接
 */
export async function closeDatabase(): Promise<void> {
  db.close();
  console.info('[DB] IndexedDB closed');
}

/**
 * 删除所有数据（谨慎使用）
 */
export async function clearAllData(): Promise<void> {
  await db.transaction('rw', [db.sessions, db.queries, db.toolCalls, db.sessionShards], async () => {
    await db.sessions.clear();
    await db.queries.clear();
    await db.toolCalls.clear();
    await db.sessionShards.clear();
  });
  console.info('[DB] All data cleared');
}
