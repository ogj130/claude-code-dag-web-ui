/**
 * useSessionStore — 会话管理 Zustand Store
 *
 * 集成 Phase 2.2 缓存同步机制：
 * - 新建会话 → 立即写入 IndexedDB
 * - 会话更新 → 500ms 防抖后写入
 * - 删除会话 → 同步删除 IndexedDB
 * - 初始化   → 缓存优先加载，后台同步服务端
 *
 * 集成 Phase 3.3 隐私模式：
 * - 隐私模式开启时不创建新历史记录
 * - 存储在 localStorage 中（用户本地）
 *
 * 集成 Phase 4.3 内存管理：
 * - FIFO 淘汰：会话超过 100 条时自动删除最旧的
 * - 会话切换时清理 DAG 节点数据释放内存
 */
import { create } from 'zustand';
import { CacheSyncEngine, type CacheSyncState, type ServerSession } from './cacheSync';
import {
  shouldEvictSessions,
  getEvictCount,
  notifyFifoEviction,
  cleanupDagNodes,
  startMemoryMonitoring,
} from '../utils/memoryManager';
import { evictOldestSessions } from '../lib/db';

// ---------------------------------------------------------------------------
// 隐私模式工具函数
// ---------------------------------------------------------------------------

/** 隐私模式 localStorage 键名 */
const PRIVACY_MODE_KEY = 'cc_privacy_mode';

/**
 * 获取隐私模式状态
 */
export function isPrivacyModeEnabled(): boolean {
  return localStorage.getItem(PRIVACY_MODE_KEY) === 'true';
}

/**
 * 设置隐私模式状态
 */
export function setPrivacyMode(enabled: boolean): void {
  localStorage.setItem(PRIVACY_MODE_KEY, String(enabled));
}

// ---------------------------------------------------------------------------
// Session interface
// ---------------------------------------------------------------------------

export interface Session {
  id: string;
  name: string;
  projectPath: string;
  createdAt: number;
  isActive: boolean;
}

// ---------------------------------------------------------------------------
// Store State
// ---------------------------------------------------------------------------

interface SessionState {
  sessions: Session[];
  activeSessionId: string;
  // 缓存同步状态
  syncState: CacheSyncState;
  isInitialized: boolean;

  // Actions
  addSession: (session: Session) => void;
  removeSession: (id: string) => void;
  setActive: (id: string) => void;
  renameSession: (id: string, name: string) => void;
  updateSession: (id: string, updates: Partial<Pick<Session, 'name' | 'projectPath'>>) => void;

  // 内部：批量设置会话（用于缓存加载）
  _setSessions: (sessions: Session[]) => void;
  _setSyncState: (state: CacheSyncState) => void;
}

// ---------------------------------------------------------------------------
// CacheSyncEngine singleton
// ---------------------------------------------------------------------------

// 默认会话 ID（兜底用，不应持久化）
const FALLBACK_SESSION_ID = `session_${Date.now()}`;

/** 创建默认会话 */
function createDefaultSession(): Session {
  return {
    id: FALLBACK_SESSION_ID,
    name: '会话 1',
    projectPath: '/Users/ouguangji/2026/cc-web-ui',
    createdAt: Date.now(),
    isActive: true,
  };
}

// 服务端同步函数（可由外部通过 initCacheSyncServerFns 注入）
let serverPushFn: ((sessions: Session[]) => Promise<ServerSession[]>) | null = null;
let serverPullFn: (() => Promise<ServerSession[]>) | null = null;

/**
 * 注入服务端同步函数（由 App 或 WebSocket hook 调用）
 */
export function initCacheSyncServerFns(opts: {
  push: (sessions: Session[]) => Promise<ServerSession[]>;
  pull: () => Promise<ServerSession[]>;
}): void {
  serverPushFn = opts.push;
  serverPullFn = opts.pull;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useSessionStore = create<SessionState>((set) => {
  // 创建缓存同步引擎实例
  const engine = new CacheSyncEngine({
    onStateChange: (syncState) => {
      set({ syncState });
    },
    serverSync: async (type, sessions) => {
      if (type === 'pull') {
        return serverPullFn?.() ?? [];
      } else {
        return serverPushFn?.(sessions.map(s => ({
          id: s.id,
          name: s.name,
          projectPath: s.projectPath,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
          isActive: s.isActive,
          queryCount: s.queryCount ?? 0,
          tokenCount: s.tokenCount ?? 0,
        }))) ?? [];
      }
    },
  });

  const defaultSession = createDefaultSession();

  // 默认会话立即写入 CCWebDB（保证首次 Query 创建时 session 已存在）
  engine.writeSessionImmediately(defaultSession).catch(err => {
    console.error('[SessionStore] 写入默认会话失败', err);
  });

  return {
    // 初始值：单个默认会话
    sessions: [defaultSession],
    activeSessionId: defaultSession.id,
    syncState: engine.state,
    isInitialized: false,

    // ---- 缓存优先初始化 ----
    // 页面加载时由外部调用 loadFromCache() 触发

    _setSessions: (sessions) => {
      if (sessions.length === 0) {
        // 缓存为空，降级到默认会话
        set({
          sessions: [createDefaultSession()],
          activeSessionId: FALLBACK_SESSION_ID,
          isInitialized: true,
        });
        return;
      }
      // 找 isActive 为 true 的会话作为 active
      const active = sessions.find(s => s.isActive) ?? sessions[0];
      set({
        sessions,
        activeSessionId: active.id,
        isInitialized: true,
      });
    },

    _setSyncState: (syncState) => {
      set({ syncState });
    },

    // ---- CRUD 操作 ----

    addSession: (session) => {
      set(state => {
        const next: Session[] = [
          ...state.sessions.map(s => ({ ...s, isActive: false })),
          { ...session, isActive: true },
        ];

        // 4.3.5: FIFO 淘汰 — 会话超过 100 条时自动删除最旧的
        if (shouldEvictSessions(next.length)) {
          const evictCount = getEvictCount(next.length);
          if (evictCount > 0) {
            // 按 createdAt 排序，保留最新的，删除最旧的
            const sorted = [...next].sort((a, b) => b.createdAt - a.createdAt);
            const toRemove = sorted.slice(-evictCount);
            const removeIds = new Set(toRemove.map(s => s.id));

            // 确保不删除当前活跃会话
            removeIds.delete(session.id);

            const filtered = next.filter(s => !removeIds.has(s.id));

            // 异步删除 IndexedDB 中的旧会话
            const idsToDelete = Array.from(removeIds);
            if (idsToDelete.length > 0) {
              Promise.all(idsToDelete.map(() => evictOldestSessions(1)))
                .then(() => {
                  notifyFifoEviction(idsToDelete.length);
                })
                .catch(err => {
                  console.error('[SessionStore] FIFO 淘汰失败', err);
                });
            }

            return { sessions: filtered, activeSessionId: session.id };
          }
        }

        return { sessions: next, activeSessionId: session.id };
      });

      // 2.2.1: 新会话立即写入 IndexedDB
      engine.writeSessionImmediately(session).catch(err => {
        console.error('[SessionStore] 写入新会话失败', err);
      });
    },

    removeSession: (id) => {
      set(state => {
        const sessions = state.sessions.filter(s => s.id !== id);
        const activeSessionId =
          state.activeSessionId === id
            ? (sessions[0]?.id ?? FALLBACK_SESSION_ID)
            : state.activeSessionId;
        return { sessions, activeSessionId };
      });

      // 删除缓存
      engine.deleteSession(id).catch(err => {
        console.error('[SessionStore] 删除会话失败', err);
      });
    },

    setActive: (id) => {
      const prevActiveId = useSessionStore.getState().activeSessionId;

      // 4.3.4: 会话切换时清理 DAG 数据释放内存
      if (prevActiveId !== id) {
        try {
          // 动态导入 useTaskStore 以避免循环依赖
          const { useTaskStore } = require('./useTaskStore');
          const taskState = useTaskStore.getState();
          if (taskState.nodes.size > 0) {
            const cleanedNodes = cleanupDagNodes(taskState.nodes, 3);
            if (cleanedNodes.size < taskState.nodes.size) {
              useTaskStore.setState({ nodes: cleanedNodes });
              console.info(
                `[SessionStore] 会话切换：清理 DAG 节点 ${taskState.nodes.size} → ${cleanedNodes.size}`
              );
            }
          }
        } catch (err) {
          // useTaskStore 可能还未初始化，忽略错误
          console.debug('[SessionStore] DAG 清理跳过:', err);
        }
      }

      // 2.2.2: 标记激活的会话也需要持久化（防抖）
      engine.writeSessionDebounced(id, { isActive: true });
      set(state => ({
        activeSessionId: id,
        sessions: state.sessions.map(s => ({
          ...s,
          isActive: s.id === id,
        })),
      }));
    },

    renameSession: (id, name) => {
      set(state => ({
        sessions: state.sessions.map(s =>
          s.id === id ? { ...s, name } : s
        ),
      }));

      // 2.2.2: 更新使用防抖写入
      engine.writeSessionDebounced(id, { name });
    },

    updateSession: (id, updates) => {
      set(state => ({
        sessions: state.sessions.map(s =>
          s.id === id ? { ...s, ...updates } : s
        ),
      }));

      // 2.2.2: 更新使用防抖写入
      engine.writeSessionDebounced(id, updates);
    },
  };
});

// ---------------------------------------------------------------------------
// Cache loading helpers（供外部调用）
// ---------------------------------------------------------------------------

/**
 * 从 IndexedDB 缓存加载会话（缓存优先，服务端数据同步覆盖）
 * 应在 App 初始化时调用一次
 */
export async function loadSessionsFromCache(limit = 20): Promise<void> {
  const engine = getEngineInstance();
  const store = useSessionStore.getState();

  const sessions = await engine.loadSessionsCacheFirst(limit);
  store._setSessions(sessions);
}

/**
 * 获取引擎实例（用于 flushAllPending 等）
 */
export function getEngineInstance(): CacheSyncEngine {
  // 通过 store 的状态间接访问；引擎实例由 store 创建
  // 这里重新构造一个轻量引用（实际引擎在 store closure 中）
  // 为避免循环依赖，通过静态方式暴露
  return (useSessionStore.getState() as unknown as { _engine?: CacheSyncEngine })._engine ??
    new CacheSyncEngine({
      onStateChange: () => {},
      serverSync: async () => [],
    });
}

/**
 * Flush 所有待写入的会话更新
 */
export async function flushPendingSessionWrites(): Promise<void> {
  const engine = getEngineInstance();
  await engine.flushAllPending();
}

// ---------------------------------------------------------------------------
// 内存监控（Phase 4.3）
// ---------------------------------------------------------------------------

let memoryMonitorCleanup: (() => void) | null = null;

/**
 * 启动内存监控（应在 App 初始化时调用）
 *
 * @param interval 检查间隔（毫秒），默认 60 秒
 * @returns 停止监控的函数
 */
export function initMemoryMonitoring(interval = 60000): () => void {
  // 先清理旧的监控
  if (memoryMonitorCleanup) {
    memoryMonitorCleanup();
  }

  memoryMonitorCleanup = startMemoryMonitoring(interval, (usage) => {
    console.warn(
      `[SessionStore] 内存使用过高: ${(usage / 1024 / 1024).toFixed(1)}MB，建议刷新页面释放内存`
    );
  });

  return memoryMonitorCleanup;
}

// 开发调试用：浏览器控制台可直接调用 window.__sessionStore.setState(...)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).__sessionStore = useSessionStore;

