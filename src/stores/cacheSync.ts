/**
 * 缓存同步引擎
 *
 * 职责：
 * 1. 新建会话 → 立即写入 IndexedDB（同步写入）
 * 2. 会话更新 → 500ms 防抖后写入（延迟写入，减少 IO）
 * 3. 页面刷新 → 优先从 IndexedDB 读取，后台异步同步服务端
 * 4. 服务端数据优先 → 冲突时以服务端数据为准
 * 5. 存储空间不足 → 自动触发清理
 *
 * 本模块为纯逻辑层，不直接依赖 React。
 * 暴露给 store 的接口均为 async 函数。
 */
import {
  saveNewSession,
  persistSessionUpdate,
  loadRecentSessions,
  loadSession,
  removeSession,
} from '../lib/sessionStorage';
import {
  isStorageNearlyFull,
  evictOldestSessions,
  type SessionRecord,
} from '../lib/db';
import type { Session } from '../stores/useSessionStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** 同步状态枚举 */
export type SyncStatus =
  | 'idle'
  | 'syncing_to_cache'
  | 'syncing_to_server'
  | 'error';

/** 服务端会话数据（从后端拉取的原始数据） */
export interface ServerSession {
  id: string;
  name: string;
  projectPath: string;
  createdAt: number;
  updatedAt: number;
  isActive: boolean;
  model?: string;
  queryCount: number;
  tokenCount: number;
  metadata?: Record<string, unknown>;
}

/** 缓存同步引擎状态 */
export interface CacheSyncState {
  syncStatus: SyncStatus;
  lastSyncTime: number | null;
  pendingWriteCount: number;
  storageNearlyFull: boolean;
}

/** 防抖器类型 */
interface Debouncer {
  run: () => void;
  flush: () => void;
  cancel: () => void;
}

// ---------------------------------------------------------------------------
// Debounce helper
// ---------------------------------------------------------------------------

/** 防抖工具函数 - 简化版 */
function createDebouncer(
  fn: () => void | Promise<void>,
  delay: number
): Debouncer {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return {
    run() {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        const result = fn();
        if (result) result.catch(() => {/* swallow: error handled in finally block */});
        timer = null;
      }, delay);
    },
    flush() {
      if (timer !== null) {
        clearTimeout(timer);
        const result = fn();
        if (result) result.catch(() => {/* swallow */});
        timer = null;
      }
    },
    cancel() {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// CacheSyncEngine
// ---------------------------------------------------------------------------

export class CacheSyncEngine {
  // 内部状态
  private _status: SyncStatus = 'idle';
  private _lastSyncTime: number | null = null;
  private _pendingWriteCount = 0;
  private _storageNearlyFull = false;

  // 防抖写入器：每个 sessionId 一个 debouncer
  private debouncers = new Map<string, Debouncer>();

  // 待写入的数据缓存
  private pendingUpdates = new Map<string, {
    name?: string;
    projectPath?: string;
    isActive?: boolean;
    queryCount?: number;
    tokenCount?: number;
    metadata?: Record<string, unknown>;
  }>();

  // 状态变更通知（由外部注入）
  private onStateChange: (state: CacheSyncState) => void;

  // 服务端同步回调（由外部注入）
  private serverSync: (
    type: 'push' | 'pull',
    sessions: SessionRecord[]
  ) => Promise<ServerSession[]>;

  constructor(opts: {
    onStateChange: (state: CacheSyncState) => void;
    serverSync: (type: 'push' | 'pull', sessions: SessionRecord[]) => Promise<ServerSession[]>;
  }) {
    this.onStateChange = opts.onStateChange;
    this.serverSync = opts.serverSync;
  }

  // ---------------------------------------------------------------------------
  // Public getters
  // ---------------------------------------------------------------------------

  get status(): SyncStatus {
    return this._status;
  }

  get lastSyncTime(): number | null {
    return this._lastSyncTime;
  }

  get pendingWriteCount(): number {
    return this._pendingWriteCount;
  }

  get storageNearlyFull(): boolean {
    return this._storageNearlyFull;
  }

  get state(): CacheSyncState {
    return {
      syncStatus: this._status,
      lastSyncTime: this._lastSyncTime,
      pendingWriteCount: this._pendingWriteCount,
      storageNearlyFull: this._storageNearlyFull,
    };
  }

  // ---------------------------------------------------------------------------
  // State helpers
  // ---------------------------------------------------------------------------

  private setStatus(s: SyncStatus) {
    this._status = s;
    this.notify();
  }

  private notify() {
    this.onStateChange(this.state);
  }

  // ---------------------------------------------------------------------------
  // 2.2.1 — 新会话立即写入策略
  // ---------------------------------------------------------------------------

  /**
   * 新建会话 → 立即写入 IndexedDB（无防抖）
   * @param session Session 对象
   */
  async writeSessionImmediately(session: Session): Promise<void> {
    await this.checkAndEvictIfNeeded();

    await saveNewSession({
      id: session.id,
      name: session.name,
      projectPath: session.projectPath,
    });

    this._lastSyncTime = Date.now();
    this.notify();
  }

  // ---------------------------------------------------------------------------
  // 2.2.2 — 会话更新的 500ms 防抖写入
  // ---------------------------------------------------------------------------

  /**
   * 更新会话 → 防抖写入（500ms）
   * 同一 sessionId 的多次更新只触发一次写入
   */
  writeSessionDebounced(sessionId: string, updates: {
    name?: string;
    projectPath?: string;
    isActive?: boolean;
    queryCount?: number;
    tokenCount?: number;
    metadata?: Record<string, unknown>;
  }): void {
    // 合并更新到待写入缓存
    const existing = this.pendingUpdates.get(sessionId) || {};
    this.pendingUpdates.set(sessionId, { ...existing, ...updates });

    if (!this.debouncers.has(sessionId)) {
      const deb = createDebouncer(async () => {
        const pending = this.pendingUpdates.get(sessionId);
        if (!pending) return;

        this._pendingWriteCount++;
        this.notify();

        try {
          await this.checkAndEvictIfNeeded();
          await persistSessionUpdate(sessionId, pending);
          this._lastSyncTime = Date.now();
        } finally {
          this._pendingWriteCount = Math.max(0, this._pendingWriteCount - 1);
          this.pendingUpdates.delete(sessionId);
          this.notify();
        }
      }, 500);

      this.debouncers.set(sessionId, deb);
    }

    // 每次调用重置防抖计时器
    this.debouncers.get(sessionId)!.run();
  }

  /** 手动 flush 所有 pending 的防抖写入 */
  async flushAllPending(): Promise<void> {
    for (const deb of Array.from(this.debouncers.values())) {
      deb.flush();
    }
  }

  /** 取消指定 sessionId 的待写入 */
  cancelPending(sessionId: string): void {
    const deb = this.debouncers.get(sessionId);
    if (deb) {
      deb.cancel();
      this.pendingUpdates.delete(sessionId);
      this._pendingWriteCount = Math.max(0, this._pendingWriteCount - 1);
      this.notify();
    }
  }

  // ---------------------------------------------------------------------------
  // 2.2.3 — 页面刷新时的缓存优先策略
  // ---------------------------------------------------------------------------

  /**
   * 缓存优先加载：
   * 1. 先同步读取 IndexedDB（快速、无网络依赖）
   * 2. 再后台异步拉取服务端数据
   * 3. 服务端数据优先，发生冲突时以服务端为准
   *
   * @param limit 最多加载多少条最近会话
   * @returns 合并后的会话列表
   */
  async loadSessionsCacheFirst(limit = 20): Promise<Session[]> {
    // Step 1: 立即从缓存加载
    this.setStatus('syncing_to_cache');
    const cachedSessions = await loadRecentSessions(limit);

    // 转换为 Session 类型（store 使用的格式）
    const fromCache: Session[] = cachedSessions.map(s => ({
      id: s.id,
      name: s.name,
      projectPath: s.projectPath,
      createdAt: s.createdAt,
      isActive: s.isActive,
      model: s.model,
    }));

    // Step 2: 后台异步拉取服务端数据
    this.setStatus('syncing_to_server');
    try {
      const serverSessions = await this.serverSync('pull', []);

      if (serverSessions.length > 0) {
        // Step 3: 服务端数据优先 — 冲突时用服务端数据覆盖缓存
        // 写入服务端数据到缓存
        for (const sv of serverSessions) {
          await persistSessionUpdate(sv.id, {
            name: sv.name,
            projectPath: sv.projectPath,
            isActive: sv.isActive,
            model: sv.model,
            queryCount: sv.queryCount,
            tokenCount: sv.tokenCount,
            metadata: sv.metadata,
          });
        }

        // 合并：服务端有的用服务端，没有的用缓存
        const merged: Session[] = serverSessions.map(sv => ({
          id: sv.id,
          name: sv.name,
          projectPath: sv.projectPath,
          createdAt: sv.createdAt,
          isActive: sv.isActive,
          model: sv.model,
        }));

        // 缓存有但服务端没有的会话也保留（本地新建但未同步到服务端的）
        const serverIds = new Set(serverSessions.map(s => s.id));
        const localOnly = fromCache.filter(s => !serverIds.has(s.id));

        this._lastSyncTime = Date.now();
        this.setStatus('idle');

        return [...merged, ...localOnly];
      }
    } catch (err) {
      console.warn('[CacheSync] 服务端同步失败，使用缓存数据', err);
      this.setStatus('error');
    }

    this.setStatus('idle');
    return fromCache;
  }

  /**
   * 加载单个会话（缓存优先）
   */
  async loadSessionCacheFirst(sessionId: string): Promise<Session | undefined> {
    // 先读缓存
    const cached = await loadSession(sessionId);
    if (!cached) return undefined;

    const local: Session = {
      id: cached.id,
      name: cached.name,
      projectPath: cached.projectPath,
      createdAt: cached.createdAt,
      isActive: cached.isActive,
    };

    // 后台异步同步服务端
    this.serverSync('pull', [cached]).then(async serverSessions => {
      if (serverSessions.length > 0) {
        const sv = serverSessions[0];
        await persistSessionUpdate(sv.id, {
          name: sv.name,
          projectPath: sv.projectPath,
          isActive: sv.isActive,
          queryCount: sv.queryCount,
          tokenCount: sv.tokenCount,
          metadata: sv.metadata,
        });
      }
    }).catch(() => {
      // 忽略后台同步错误
    });

    return local;
  }

  // ---------------------------------------------------------------------------
  // 2.2.4 — 服务端数据优先的同步策略
  // ---------------------------------------------------------------------------

  /**
   * 将本地会话列表推送到服务端
   * 服务端负责决定最终 authoritative 数据
   *
   * 策略：
   * - 上传所有本地会话 ID
   * - 服务端返回"需要更新的会话"列表（diff）
   * - 本地以服务端的返回值为准更新缓存
   */
  async pushToServer(sessions: Session[]): Promise<ServerSession[]> {
    this.setStatus('syncing_to_server');
    try {
      const records: SessionRecord[] = sessions.map(s => ({
        id: s.id,
        name: s.name,
        projectPath: s.projectPath,
        createdAt: s.createdAt,
        updatedAt: Date.now(),
        isActive: s.isActive,
        model: s.model,
        queryCount: 0,
        tokenCount: 0,
      }));

      const resolved = await this.serverSync('push', records);

      // 以服务端返回值为准，更新本地缓存
      for (const sv of resolved) {
        await persistSessionUpdate(sv.id, {
          name: sv.name,
          projectPath: sv.projectPath,
          isActive: sv.isActive,
          queryCount: sv.queryCount,
          tokenCount: sv.tokenCount,
          metadata: sv.metadata,
        });
      }

      this._lastSyncTime = Date.now();
      this.setStatus('idle');
      return resolved;
    } catch (err) {
      console.warn('[CacheSync] 推送服务端失败', err);
      this.setStatus('error');
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // 2.2.5 — 存储空间不足时的自动清理触发
  // ---------------------------------------------------------------------------

  /**
   * 检查存储空间，必要时自动清理最旧的会话
   * 触发阈值：使用量 > 80%
   */
  async checkAndEvictIfNeeded(): Promise<void> {
    this._storageNearlyFull = await isStorageNearlyFull();

    if (this._storageNearlyFull) {
      console.warn('[CacheSync] 存储空间不足，触发自动清理');

      // 删除最旧的 5 条会话
      const evicted = await evictOldestSessions(5);
      console.info(`[CacheSync] 已清理 ${evicted.length} 条最旧会话`, evicted);

      // 重新检查
      this._storageNearlyFull = await isStorageNearlyFull();
    }

    this.notify();
  }

  // ---------------------------------------------------------------------------
  // Session deletion
  // ---------------------------------------------------------------------------

  /** 删除会话（含防抖取消） */
  async deleteSession(sessionId: string): Promise<void> {
    this.cancelPending(sessionId);
    await removeSession(sessionId);
    this._lastSyncTime = Date.now();
    this.notify();
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  /** 销毁引擎（清理所有防抖定时器） */
  destroy(): void {
    for (const deb of Array.from(this.debouncers.values())) {
      deb.cancel();
    }
    this.debouncers.clear();
    this.pendingUpdates.clear();
  }
}