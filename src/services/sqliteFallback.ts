/**
 * SQLiteFallback — SQLite 不可用时的 IndexedDB 降级方案
 *
 * 当 better-sqlite3 加载失败（平台不支持 / 构建问题）时，
 * 使用 Dexie (IndexedDB) 作为降级存储。
 */

import Dexie, { type Table } from 'dexie';

// ── 类型定义 ──────────────────────────────────────────────
interface FBEpisode {
  id: string;
  workspaceId: string;
  timestamp: number;
  type: string;
  content: string;
  tags: string[];
  emotionTag?: string;
  confidence: number;
  isDeleted: number;
}

interface FBPattern {
  id: string;
  domain: string;
  pattern: string;
  description: string;
  confidence: number;
}

interface FBSkill {
  id: string;
  name: string;
  description: string;
  content: string;
  source: string;
  status: string;
  usageCount: number;
}

interface FBHook {
  id: string;
  name: string;
  triggerType: string;
  conditions: string;
  actions: string;
  enabled: number;
}

// ── Dexie 数据库 ──────────────────────────────────────────
class FallbackDB extends Dexie {
  episodes!: Table<FBEpisode>;
  patterns!: Table<FBPattern>;
  skills!: Table<FBSkill>;
  hooks!: Table<FBHook>;

  constructor() {
    super('cc-web-v3-fallback');
    this.version(1).stores({
      episodes: 'id, workspaceId, type, timestamp, *tags',
      patterns: 'id, domain',
      skills: 'id, name, source, status',
      hooks: 'id, triggerType, enabled',
    });
  }
}

const fallbackDb = new FallbackDB();

// ── 可用性检测 ────────────────────────────────────────────
let _sqliteAvailable: boolean | null = null;

export async function checkSQLiteAvailable(): Promise<boolean> {
  if (_sqliteAvailable !== null) return _sqliteAvailable;

  try {
    if (window.electron?.invoke) {
      const result = await window.electron.invoke('sqlite:isAvailable');
      _sqliteAvailable = !!result;
    } else {
      _sqliteAvailable = false;
    }
  } catch {
    _sqliteAvailable = false;
  }

  if (!_sqliteAvailable) {
    console.warn('[Storage] SQLite unavailable, using IndexedDB fallback');
  }
  return _sqliteAvailable;
}

// ── 降级 API ──────────────────────────────────────────────
export const fallbackStore = {
  // 情景记忆
  episodes: {
    async list(workspaceId: string, limit = 50) {
      return fallbackDb.episodes
        .where('workspaceId').equals(workspaceId)
        .filter((e) => !e.isDeleted)
        .reverse()
        .sortBy('timestamp')
        .then((arr) => arr.slice(0, limit));
    },

    async create(ep: Omit<FBEpisode, 'id' | 'timestamp' | 'confidence' | 'isDeleted'>) {
      const id = crypto.randomUUID();
      await fallbackDb.episodes.add({
        ...ep,
        id,
        timestamp: Date.now(),
        confidence: 1.0,
        isDeleted: 0,
      });
      return id;
    },

    async search(query: string, workspaceId?: string) {
      const lower = query.toLowerCase();
      let collection = fallbackDb.episodes.toCollection();
      if (workspaceId) {
        collection = collection.filter((e) => e.workspaceId === workspaceId);
      }
      return collection
        .filter((e) => !e.isDeleted && e.content.toLowerCase().includes(lower))
        .toArray();
    },

    async softDelete(id: string) {
      await fallbackDb.episodes.update(id, { isDeleted: 1 });
    },
  },

  // 语义记忆
  patterns: {
    async list(domain?: string, limit = 50) {
      if (domain) {
        return fallbackDb.patterns.where('domain').equals(domain).limit(limit).toArray();
      }
      return fallbackDb.patterns.limit(limit).toArray();
    },

    async create(p: Omit<FBPattern, 'id'>) {
      const id = crypto.randomUUID();
      await fallbackDb.patterns.add({ ...p, id });
      return id;
    },
  },

  // Skills
  skills: {
    async list(status = 'active', limit = 50) {
      return fallbackDb.skills.where('status').equals(status).limit(limit).toArray();
    },

    async create(s: Omit<FBSkill, 'id' | 'usageCount'>) {
      const id = crypto.randomUUID();
      await fallbackDb.skills.add({ ...s, id, usageCount: 0 });
      return id;
    },
  },

  // Hooks
  hooks: {
    async list(enabled?: boolean) {
      if (enabled !== undefined) {
        return fallbackDb.hooks.where('enabled').equals(enabled ? 1 : 0).toArray();
      }
      return fallbackDb.hooks.toArray();
    },

    async create(h: Omit<FBHook, 'id'>) {
      const id = crypto.randomUUID();
      await fallbackDb.hooks.add({ ...h, id });
      return id;
    },
  },
};
