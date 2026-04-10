/**
 * 会话存储封装层
 * 封装 Session/Query 与 Dexie 之间的读写逻辑，
 * 包含压缩支持（依赖 lz-string）
 */
import { compress, decompress } from 'lz-string';
import type { SessionRecord, QueryRecord } from './db';
import {
  createSession,
  getSession,
  updateSession,
  deleteSession,
  listRecentSessions,
  listQueriesBySession,
  getAllSessionIds,
  createQuery,
  updateQuery,
} from './db';

// ---------------------------------------------------------------------------
// Compression helpers
// ---------------------------------------------------------------------------

/** 超过 1KB 的文本自动压缩 */
function maybeCompress(text: string, threshold = 1024): string {
  return text.length > threshold ? compress(text) ?? text : text;
}

/** 自动解压缩（如果被压缩过） */
function maybeDecompress(text: string): string {
  // 通过尝试解压缩判断是否被压缩：解压缩结果与原文不同才算压缩过
  try {
    const decompressed = decompress(text);
    // 简单判断：解压缩后长度明显增加认为是压缩过
    return decompressed && decompressed.length > text.length * 1.5
      ? decompressed
      : text;
  } catch {
    return text;
  }
}

// ---------------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------------

/**
 * 新建会话记录并写入 IndexedDB
 */
export async function saveNewSession(params: {
  id: string;
  name: string;
  projectPath: string;
}): Promise<string> {
  const now = Date.now();
  const record: SessionRecord = {
    id: params.id,
    name: params.name,
    projectPath: params.projectPath,
    createdAt: now,
    updatedAt: now,
    isActive: true,
    queryCount: 0,
    tokenCount: 0,
  };
  await createSession(record);
  return record.id;
}

/**
 * 更新会话记录（只更新提供的字段）
 */
export async function persistSessionUpdate(
  id: string,
  updates: {
    name?: string;
    projectPath?: string;
    isActive?: boolean;
    queryCount?: number;
    tokenCount?: number;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const record: Partial<SessionRecord> = { updatedAt: Date.now() };

  if (updates.name !== undefined) record.name = updates.name;
  if (updates.projectPath !== undefined) record.projectPath = updates.projectPath;
  if (updates.isActive !== undefined) record.isActive = updates.isActive;
  if (updates.queryCount !== undefined) record.queryCount = updates.queryCount;
  if (updates.tokenCount !== undefined) record.tokenCount = updates.tokenCount;

  // metadata 序列化并压缩
  if (updates.metadata) {
    const metaJson = JSON.stringify(updates.metadata);
    record.metadata = maybeCompress(metaJson);
  }

  await updateSession(id, record);
}

/**
 * 加载最近会话列表（供页面刷新时缓存优先策略使用）
 */
export async function loadRecentSessions(limit = 20): Promise<SessionRecord[]> {
  const sessions = await listRecentSessions(limit);

  // 批量解压 metadata（如果有）
  return sessions.map(s => {
    if (s.metadata) {
      try {
        const decompressed = maybeDecompress(s.metadata);
        return { ...s, metadata: decompressed };
      } catch {
        return s;
      }
    }
    return s;
  });
}

/**
 * 加载单个会话（带 metadata 解压）
 */
export async function loadSession(id: string): Promise<SessionRecord | undefined> {
  const record = await getSession(id);
  if (!record) return undefined;

  if (record.metadata) {
    try {
      const decompressed = maybeDecompress(record.metadata);
      return { ...record, metadata: decompressed };
    } catch {
      return record;
    }
  }
  return record;
}

/**
 * 删除会话
 */
export async function removeSession(id: string): Promise<void> {
  await deleteSession(id);
}

/**
 * 获取所有会话 ID（用于服务端同步时的 diff）
 */
export async function fetchAllSessionIds(): Promise<string[]> {
  return getAllSessionIds();
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

/**
 * 保存新问答记录
 */
export async function saveNewQuery(params: {
  id: string;
  sessionId: string;
  query: string;
  tokenCount?: number;
  toolCount?: number;
}): Promise<string> {
  const record: QueryRecord = {
    id: params.id,
    sessionId: params.sessionId,
    query: params.query,
    timestamp: Date.now(),
    tokenCount: params.tokenCount ?? 0,
    toolCount: params.toolCount ?? 0,
  };
  await createQuery(record);

  // 更新所属会话的 queryCount
  await updateSession(params.sessionId, {
    queryCount: 1, // 增量逻辑由调用方负责，这里只触发更新
    updatedAt: Date.now(),
  });

  return record.id;
}

/**
 * 加载指定会话的所有问答（带 analysis/summary 解压）
 */
export async function loadQueriesForSession(
  sessionId: string
): Promise<QueryRecord[]> {
  const records = await listQueriesBySession(sessionId);

  return records.map(r => {
    const result = { ...r };
    if (r.analysis) {
      try {
        result.analysis = maybeDecompress(r.analysis);
      } catch {
        // ignore
      }
    }
    if (r.summary) {
      try {
        result.summary = maybeDecompress(r.summary);
      } catch {
        // ignore
      }
    }
    return result;
  });
}

/**
 * 更新问答记录（含压缩）
 */
export async function persistQueryUpdate(
  id: string,
  updates: {
    summary?: string;
    analysis?: string;
    tokenCount?: number;
    toolCount?: number;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const record: Partial<QueryRecord> = {};

  if (updates.summary !== undefined) {
    record.summary = maybeCompress(updates.summary);
  }
  if (updates.analysis !== undefined) {
    record.analysis = maybeCompress(updates.analysis);
  }
  if (updates.tokenCount !== undefined) {
    record.tokenCount = updates.tokenCount;
  }
  if (updates.toolCount !== undefined) {
    record.toolCount = updates.toolCount;
  }
  if (updates.metadata) {
    record.metadata = maybeCompress(JSON.stringify(updates.metadata));
  }

  await updateQuery(id, record);
}
