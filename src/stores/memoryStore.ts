/**
 * memoryStore — cc-web-memory CRUD 操作封装
 *
 * 统一封装情景记忆（episodes）和语义记忆（patterns）的增删查操作。
 * 优先走 SQLite IPC，降级走 Dexie IndexedDB。
 */

import { checkSQLiteAvailable, fallbackStore } from '../services/sqliteFallback';

// ── 类型定义 ──────────────────────────────────────────────

export interface Episode {
  id: string;
  workspaceId: string;
  timestamp: number;
  type: string;
  content: string;
  tags: string[];
  emotionTag?: string;
  confidence: number;
  isDeleted: number;
  snippet?: string;
}

export interface Pattern {
  id: string;
  domain: string;
  pattern: string;
  description: string;
  confidence: number;
  createdAt?: number;
}

export interface CreateEpisodeParams {
  workspaceId: string;
  type: string;
  content: string;
  tags?: string[];
  emotionTag?: string;
}

export interface CreatePatternParams {
  domain: string;
  pattern: string;
  description: string;
  confidence?: number;
}

// ── 可用性检测 ────────────────────────────────────────────

let _sqliteAvailable: boolean | null = null;

async function useSQLite(): Promise<boolean> {
  if (_sqliteAvailable !== null) return _sqliteAvailable;
  _sqliteAvailable = await checkSQLiteAvailable();
  return _sqliteAvailable;
}

const isElectron = () => typeof window !== 'undefined' && !!window.electron?.invoke;

// ── 情景记忆 ──────────────────────────────────────────────

export const episodeStore = {
  /**
   * 列出工作区的情景记忆
   */
  async list(workspaceId: string, limit = 50): Promise<Episode[]> {
    if (isElectron() && await useSQLite()) {
      try {
        const rows = await window.electron.invoke('sqlite:episodes:list', { workspaceId, limit }) as Episode[];
        return rows ?? [];
      } catch (err) {
        console.warn('[memoryStore] SQLite list failed, using fallback:', err);
      }
    }
    return fallbackStore.episodes.list(workspaceId, limit);
  },

  /**
   * 创建情景记忆
   */
  async create(params: CreateEpisodeParams): Promise<string> {
    if (isElectron() && await useSQLite()) {
      try {
        const result = await window.electron.invoke('sqlite:episodes:create', params) as { id: string; success: boolean };
        if (result.success) return result.id;
      } catch (err) {
        console.warn('[memoryStore] SQLite create failed, using fallback:', err);
      }
    }
    return fallbackStore.episodes.create({
      ...params,
      tags: params.tags ?? [],
    });
  },

  /**
   * 全文搜索情景记忆
   */
  async search(query: string, workspaceId?: string): Promise<Episode[]> {
    if (isElectron() && await useSQLite()) {
      try {
        const rows = await window.electron.invoke('sqlite:episodes:search', { query, workspaceId }) as Episode[];
        return rows ?? [];
      } catch (err) {
        console.warn('[memoryStore] SQLite search failed, using fallback:', err);
      }
    }
    return fallbackStore.episodes.search(query, workspaceId);
  },

  /**
   * 软删除情景记忆（30 天恢复期）
   */
  async softDelete(id: string): Promise<void> {
    if (isElectron() && await useSQLite()) {
      try {
        await window.electron.invoke('sqlite:episodes:softDelete', { id });
        return;
      } catch (err) {
        console.warn('[memoryStore] SQLite softDelete failed, using fallback:', err);
      }
    }
    return fallbackStore.episodes.softDelete(id);
  },
};

// ── 语义记忆 ──────────────────────────────────────────────

export const patternStore = {
  /**
   * 列出语义记忆模式
   */
  async list(domain?: string, limit = 50): Promise<Pattern[]> {
    if (isElectron() && await useSQLite()) {
      try {
        const rows = await window.electron.invoke('sqlite:patterns:list', { domain, limit }) as Pattern[];
        return rows ?? [];
      } catch (err) {
        console.warn('[memoryStore] SQLite patterns list failed, using fallback:', err);
      }
    }
    return fallbackStore.patterns.list(domain, limit);
  },

  /**
   * 创建语义记忆模式
   */
  async create(params: CreatePatternParams): Promise<string> {
    if (isElectron() && await useSQLite()) {
      try {
        const result = await window.electron.invoke('sqlite:patterns:create', params) as { id: string; success: boolean };
        if (result.success) return result.id;
      } catch (err) {
        console.warn('[memoryStore] SQLite patterns create failed, using fallback:', err);
      }
    }
    return fallbackStore.patterns.create({
      ...params,
      confidence: params.confidence ?? 1.0,
    });
  },
};

// ── 便捷导出 ──────────────────────────────────────────────

export const memoryStore = {
  episodes: episodeStore,
  patterns: patternStore,
};
