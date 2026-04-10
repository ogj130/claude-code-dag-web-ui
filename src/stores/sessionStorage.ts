/**
 * Session CRUD 操作
 */

import { db } from './db';
import type {
  DBSession,
  CreateSessionInput,
  UpdateSessionInput,
  PaginatedResult,
  PaginationParams,
} from '@/types/storage';

/** 默认分页参数 */
const DEFAULT_PAGINATION: PaginationParams = {
  page: 1,
  pageSize: 20,
};

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 创建新 Session
 * @param input 创建参数
 * @returns 创建的 Session
 */
export async function createSession(input: CreateSessionInput): Promise<DBSession> {
  const now = Date.now();
  const session: DBSession = {
    id: generateId(),
    title: input.title,
    createdAt: now,
    updatedAt: now,
    queryCount: 0,
    tokenUsage: 0,
    tags: input.tags ?? [],
    summary: '',
    status: 'active',
  };

  await db.sessions.add(session);
  console.info('[SessionStorage] Created session:', session.id);
  return session;
}

/**
 * 获取 Session
 * @param id Session ID
 * @returns Session 或 undefined
 */
export async function getSession(id: string): Promise<DBSession | undefined> {
  return db.sessions.get(id);
}

/**
 * 更新 Session
 * @param id Session ID
 * @param input 更新参数
 * @returns 更新后的 Session
 */
export async function updateSession(
  id: string,
  input: UpdateSessionInput
): Promise<DBSession | undefined> {
  const updates: Partial<DBSession> = {
    updatedAt: Date.now(),
  };

  if (input.title !== undefined) {
    updates.title = input.title;
  }
  if (input.tags !== undefined) {
    updates.tags = input.tags;
  }
  if (input.summary !== undefined) {
    updates.summary = input.summary;
  }
  if (input.status !== undefined) {
    updates.status = input.status;
  }
  if (input.isSharded !== undefined) {
    updates.isSharded = input.isSharded;
  }
  if (input.shardCount !== undefined) {
    updates.shardCount = input.shardCount;
  }
  if (input.tokenUsageIncrement !== undefined) {
    const session = await db.sessions.get(id);
    if (session) {
      updates.tokenUsage = session.tokenUsage + input.tokenUsageIncrement;
    }
  }
  if (input.queryCountIncrement !== undefined) {
    const session = await db.sessions.get(id);
    if (session) {
      updates.queryCount = session.queryCount + input.queryCountIncrement;
    }
  }

  await db.sessions.update(id, updates);
  console.info('[SessionStorage] Updated session:', id);
  return db.sessions.get(id);
}

/**
 * 删除 Session（软删除，标记为 deleted 状态）
 * @param id Session ID
 */
export async function deleteSession(id: string): Promise<void> {
  await db.sessions.update(id, {
    status: 'deleted',
    updatedAt: Date.now(),
  });
  console.info('[SessionStorage] Soft deleted session:', id);
}

/**
 * 永久删除 Session（同时删除关联的 queries）
 * @param id Session ID
 */
export async function permanentlyDeleteSession(id: string): Promise<void> {
  await db.transaction('rw', [db.sessions, db.queries], async () => {
    // 先删除关联的 queries
    await db.queries.where('sessionId').equals(id).delete();
    // 再删除 session
    await db.sessions.delete(id);
  });
  console.info('[SessionStorage] Permanently deleted session:', id);
}

/**
 * 获取 Session 列表（分页，按 updatedAt 降序）
 * @param pagination 分页参数
 * @param includeDeleted 是否包含已删除的（默认不包含）
 * @returns 分页结果
 */
export async function getSessionList(
  pagination: PaginationParams = DEFAULT_PAGINATION,
  includeDeleted = false
): Promise<PaginatedResult<DBSession>> {
  const { page, pageSize } = pagination;
  const offset = (page - 1) * pageSize;

  // 获取总数
  const total = includeDeleted
    ? await db.sessions.count()
    : await db.sessions.where('status').notEqual('deleted').count();

  // 获取分页数据（按 updatedAt 降序）
  const items = await db.sessions
    .orderBy('updatedAt')
    .reverse()
    .offset(offset)
    .limit(pageSize)
    .toArray();

  const totalPages = Math.ceil(total / pageSize);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages,
    hasMore: page < totalPages,
  };
}

/**
 * 获取最近的 N 条 Session
 * @param limit 数量限制
 * @returns Session 列表
 */
export async function getRecentSessions(limit = 20): Promise<DBSession[]> {
  return db.sessions
    .where('status')
    .equals('active')
    .reverse()
    .sortBy('updatedAt')
    .then(items => items.slice(0, limit));
}

/**
 * 根据标签筛选 Session
 * @param tags 标签列表
 * @param pagination 分页参数
 * @returns 分页结果
 */
export async function getSessionsByTags(
  tags: string[],
  pagination: PaginationParams = DEFAULT_PAGINATION
): Promise<PaginatedResult<DBSession>> {
  const { page, pageSize } = pagination;
  const offset = (page - 1) * pageSize;

  // 使用复合索引查询
  const allItems = await db.sessions
    .where('status')
    .equals('active')
    .reverse()
    .sortBy('updatedAt');

  // 过滤包含指定标签的 session
  const filteredItems = allItems.filter(session =>
    tags.some(tag => session.tags.includes(tag))
  );

  const total = filteredItems.length;
  const items = filteredItems.slice(offset, offset + pageSize);
  const totalPages = Math.ceil(total / pageSize);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages,
    hasMore: page < totalPages,
  };
}

/**
 * 归档 Session
 * @param id Session ID
 */
export async function archiveSession(id: string): Promise<void> {
  await db.sessions.update(id, {
    status: 'archived',
    updatedAt: Date.now(),
  });
  console.info('[SessionStorage] Archived session:', id);
}

/**
 * 恢复已归档的 Session
 * @param id Session ID
 */
export async function restoreSession(id: string): Promise<void> {
  await db.sessions.update(id, {
    status: 'active',
    updatedAt: Date.now(),
  });
  console.info('[SessionStorage] Restored session:', id);
}

/**
 * 获取所有会话数量统计
 * @returns 统计信息
 */
export async function getSessionStats(): Promise<{
  total: number;
  active: number;
  archived: number;
  deleted: number;
}> {
  const all = await db.sessions.toArray();

  return {
    total: all.length,
    active: all.filter(s => s.status === 'active').length,
    archived: all.filter(s => s.status === 'archived').length,
    deleted: all.filter(s => s.status === 'deleted').length,
  };
}

/**
 * 获取所有会话（包括已删除的）
 * @returns 所有会话列表
 */
export async function getAllSessions(): Promise<DBSession[]> {
  return db.sessions.toArray();
}
