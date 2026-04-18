/**
 * qaHistoryStorage — 问答历史记录存储接口
 *
 * 当前为最小存根实现（返回空数组），待后续接入持久化存储。
 */
import type { QAHistoryEntry, QASearchFilters } from '@/types/qaHistory';

/** 搜索问答历史记录 */
export async function searchQAHistory(_filters: QASearchFilters): Promise<QAHistoryEntry[]> {
  return [];
}

/** 根据 sessionId 获取问答历史 */
export async function getQAHistoryBySessionId(_sessionId: string): Promise<QAHistoryEntry[]> {
  return [];
}

/** 根据 workspaceId 获取问答历史 */
export async function getQAHistoryByWorkspaceId(_workspaceId: string): Promise<QAHistoryEntry[]> {
  return [];
}
