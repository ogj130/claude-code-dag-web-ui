/**
 * useCacheSync — 缓存同步 Hook
 *
 * 封装 CacheSyncEngine，提供响应式的同步状态访问。
 *
 * 用法：
 * const { syncStatus, loadSessions, writeSessionDebounced } = useCacheSync();
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { CacheSyncEngine, type CacheSyncState, type ServerSession } from '../stores/cacheSync';
import type { Session } from '../stores/useSessionStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UseCacheSyncOptions {
  /** 页面加载时是否自动从缓存加载会话（默认 true） */
  autoLoad?: boolean;
  /** 最大缓存会话数（默认 20） */
  sessionLimit?: number;
  /** 服务端推送回调（将本地数据同步到服务端） */
  serverPush?: (sessions: Session[]) => Promise<ServerSession[]>;
  /** 服务端拉取回调（从服务端获取数据） */
  serverPull?: () => Promise<ServerSession[]>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCacheSync(options: UseCacheSyncOptions = {}) {
  const {
    autoLoad = true,
    sessionLimit = 20,
    serverPush,
    serverPull,
  } = options;

  // 同步状态
  const [syncState, setSyncState] = useState<CacheSyncState>({
    syncStatus: 'idle',
    lastSyncTime: null,
    pendingWriteCount: 0,
    storageNearlyFull: false,
  });

  // 加载结果回调（由 store 注入）
  const onSessionsLoadedRef = useRef<((sessions: Session[]) => void) | null>(null);

  // 服务端同步函数
  const defaultServerSync: CacheSyncEngine['serverSync'] = useCallback(
    async (type, sessions) => {
      if (type === 'pull') {
        return serverPull?.() ?? [];
      } else {
        return serverPush?.(sessions.map(s => ({
          id: s.id,
          name: s.name,
          projectPath: s.projectPath,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
          isActive: s.isActive,
          queryCount: s.queryCount,
          tokenCount: s.tokenCount,
        }))) ?? [];
      }
    },
    [serverPush, serverPull]
  );

  // 引擎实例（ref 避免重渲染）
  const engineRef = useRef<CacheSyncEngine | null>(null);

  if (!engineRef.current) {
    engineRef.current = new CacheSyncEngine({
      onStateChange: setSyncState,
      serverSync: defaultServerSync,
    });
  }

  const engine = engineRef.current;

  // 组件卸载时销毁引擎
  useEffect(() => {
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [engine]);

  // 自动加载
  useEffect(() => {
    if (!autoLoad) return;

    engine.loadSessionsCacheFirst(sessionLimit).then(sessions => {
      onSessionsLoadedRef.current?.(sessions);
    }).catch(err => {
      console.error('[useCacheSync] 自动加载失败', err);
    });
  }, [autoLoad, engine, sessionLimit]);

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * 注册加载结果回调（供外部 store 使用）
   */
  const onSessionsLoaded = useCallback((fn: (sessions: Session[]) => void) => {
    onSessionsLoadedRef.current = fn;
  }, []);

  /**
   * 缓存优先加载会话
   */
  const loadSessions = useCallback(async (limit = sessionLimit): Promise<Session[]> => {
    const sessions = await engine.loadSessionsCacheFirst(limit);
    return sessions;
  }, [engine, sessionLimit]);

  /**
   * 新建会话立即写入
   */
  const writeSessionImmediately = useCallback(async (session: Session): Promise<void> => {
    await engine.writeSessionImmediately(session);
  }, [engine]);

  /**
   * 更新会话（500ms 防抖）
   */
  const writeSessionDebounced = useCallback((
    sessionId: string,
    updates: {
      name?: string;
      projectPath?: string;
      isActive?: boolean;
      queryCount?: number;
      tokenCount?: number;
      metadata?: Record<string, unknown>;
    }
  ): void => {
    engine.writeSessionDebounced(sessionId, updates);
  }, [engine]);

  /**
   * 手动 flush 所有 pending 写入
   */
  const flushAllPending = useCallback(async (): Promise<void> => {
    await engine.flushAllPending();
  }, [engine]);

  /**
   * 推送本地会话到服务端
   */
  const pushToServer = useCallback(async (sessions: Session[]): Promise<ServerSession[]> => {
    return engine.pushToServer(sessions);
  }, [engine]);

  /**
   * 删除会话
   */
  const deleteSession = useCallback(async (sessionId: string): Promise<void> => {
    await engine.deleteSession(sessionId);
  }, [engine]);

  return {
    // 状态
    syncStatus: syncState.syncStatus,
    lastSyncTime: syncState.lastSyncTime,
    pendingWriteCount: syncState.pendingWriteCount,
    storageNearlyFull: syncState.storageNearlyFull,

    // 回调注册
    onSessionsLoaded,

    // 操作
    loadSessions,
    writeSessionImmediately,
    writeSessionDebounced,
    flushAllPending,
    pushToServer,
    deleteSession,
  };
}
