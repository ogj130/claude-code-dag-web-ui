/**
 * 数据隐私管理
 * 提供数据清除、隐私模式等功能
 */

import { db, clearAllData } from '@/stores/db';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 隐私模式存储键 */
const PRIVACY_MODE_KEY = 'cc-web-ui-privacy-mode';

// ---------------------------------------------------------------------------
// Privacy Mode
// ---------------------------------------------------------------------------

/**
 * 检查是否启用隐私模式
 */
export function isPrivacyModeEnabled(): boolean {
  return localStorage.getItem(PRIVACY_MODE_KEY) === 'true';
}

/**
 * 启用隐私模式
 * 启用后不会记录新的历史记录
 */
export function enablePrivacyMode(): void {
  localStorage.setItem(PRIVACY_MODE_KEY, 'true');
  console.info('[Privacy] Privacy mode enabled');
}

/**
 * 禁用隐私模式
 * 恢复正常的历史记录功能
 */
export function disablePrivacyMode(): void {
  localStorage.setItem(PRIVACY_MODE_KEY, 'false');
  console.info('[Privacy] Privacy mode disabled');
}

/**
 * 切换隐私模式
 */
export function togglePrivacyMode(): boolean {
  const enabled = isPrivacyModeEnabled();
  if (enabled) {
    disablePrivacyMode();
  } else {
    enablePrivacyMode();
  }
  return !enabled;
}

// ---------------------------------------------------------------------------
// Data Clearing
// ---------------------------------------------------------------------------

/**
 * 清除所有历史记录
 * 包括会话、查询、工具调用、分片数据
 */
export async function clearAllHistory(): Promise<void> {
  try {
    await clearAllData();
    console.info('[Privacy] All history cleared');
  } catch (error) {
    console.error('[Privacy] Failed to clear history:', error);
    throw error;
  }
}

/**
 * 清除指定会话的历史记录
 */
export async function clearSession(sessionId: string): Promise<void> {
  try {
    await db.transaction('rw', [db.sessions, db.queries, db.toolCalls, db.sessionShards], async () => {
      // 删除会话
      await db.sessions.delete(sessionId);

      // 删除该会话的所有查询
      await db.queries.where('sessionId').equals(sessionId).delete();

      // 删除该会话的所有工具调用
      await db.toolCalls.where('sessionId').equals(sessionId).delete();

      // 删除该会话的所有分片
      await db.sessionShards.where('sessionId').equals(sessionId).delete();
    });

    console.info('[Privacy] Session cleared:', sessionId);
  } catch (error) {
    console.error('[Privacy] Failed to clear session:', error);
    throw error;
  }
}

/**
 * 清除指定时间范围之前的历史记录
 * @param beforeTimestamp 时间戳，删除此时间之前的记录
 */
export async function clearHistoryBefore(beforeTimestamp: number): Promise<void> {
  try {
    // 获取要删除的会话
    const sessionsToDelete = await db.sessions
      .where('createdAt')
      .below(beforeTimestamp)
      .toArray();

    const sessionIds = sessionsToDelete.map(s => s.id);

    await db.transaction('rw', [db.sessions, db.queries, db.toolCalls, db.sessionShards], async () => {
      // 删除会话
      await db.sessions.bulkDelete(sessionIds);

      // 删除相关查询
      for (const sessionId of sessionIds) {
        await db.queries.where('sessionId').equals(sessionId).delete();
        await db.toolCalls.where('sessionId').equals(sessionId).delete();
        await db.sessionShards.where('sessionId').equals(sessionId).delete();
      }
    });

    console.info('[Privacy] Cleared history before:', new Date(beforeTimestamp).toISOString());
  } catch (error) {
    console.error('[Privacy] Failed to clear history:', error);
    throw error;
  }
}

/**
 * 获取历史记录统计信息
 */
export async function getHistoryStats(): Promise<{
  sessionCount: number;
  queryCount: number;
  toolCallCount: number;
  oldestTimestamp: number;
  newestTimestamp: number;
}> {
  try {
    const sessionCount = await db.sessions.count();
    const queryCount = await db.queries.count();
    const toolCallCount = await db.toolCalls.count();

    const oldestSession = await db.sessions.orderBy('createdAt').first();
    const newestSession = await db.sessions.orderBy('createdAt').last();

    return {
      sessionCount,
      queryCount,
      toolCallCount,
      oldestTimestamp: oldestSession?.createdAt ?? 0,
      newestTimestamp: newestSession?.createdAt ?? 0,
    };
  } catch (error) {
    console.error('[Privacy] Failed to get history stats:', error);
    throw error;
  }
}
