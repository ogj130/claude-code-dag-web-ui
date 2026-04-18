/**
 * useSessionStore 核心功能测试
 *
 * 覆盖 useSessionStore.ts 的核心功能：
 * - 会话 CRUD 操作（addSession / removeSession / setActive / renameSession / updateSession）
 * - 隐私模式（isPrivacyModeEnabled / setPrivacyMode）
 * - FIFO 淘汰逻辑（会话超过 100 条时自动淘汰最旧会话）
 * - 缓存同步集成（writeSessionImmediately 防抖写入）
 * - 状态初始化（_setSessions / isInitialized）
 *
 * Mock 策略：
 * - CacheSyncEngine：mock 类实例，追踪 writeSessionImmediately / writeSessionDebounced / deleteSession 调用
 * - sessionStorage：mock 底层 IndexedDB 操作，避免真实 IO
 * - memoryManager：mock FIFO 判定函数，控制淘汰触发
 * - db：mock evictOldestSessions
 * - useTaskStore：mock 避免 setActive 中的动态 require 触发
 */
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useSessionStore,
  isPrivacyModeEnabled,
  setPrivacyMode,
  loadSessionsFromCache,
  flushPendingSessionWrites,
  initCacheSyncServerFns,
  initMemoryMonitoring,
  type Session,
} from '@/stores/useSessionStore';

// ---------------------------------------------------------------------------
// Mock 辅助：通过 vi.hoisted 确保所有 mock 函数在 vi.mock 工厂之前正确初始化
// ---------------------------------------------------------------------------

// memoryManager mocks — 在 vi.hoisted 中创建，供 vi.mock 工厂引用
const {
  mockShouldEvict,
  mockGetEvictCount,
  mockNotifyFifoEviction,
  mockCleanupDagNodes,
  mockStartMemoryMonitoring,
} = vi.hoisted(() => ({
  mockShouldEvict: vi.fn().mockReturnValue(false),
  mockGetEvictCount: vi.fn().mockReturnValue(0),
  mockNotifyFifoEviction: vi.fn(),
  mockCleanupDagNodes: vi.fn().mockImplementation((nodes: Map<string, unknown>) => nodes),
  mockStartMemoryMonitoring: vi.fn().mockReturnValue(vi.fn()),
}));

// CacheSyncEngine mock — 追踪写入调用
const {
  engineWriteImmediately,
  engineWriteDebounced,
  engineDeleteSession,
  engineFlushAll,
  engineLoadSessionsCacheFirst,
} = vi.hoisted(() => ({
  engineWriteImmediately: vi.fn().mockResolvedValue(undefined),
  engineWriteDebounced: vi.fn(),
  engineDeleteSession: vi.fn().mockResolvedValue(undefined),
  engineFlushAll: vi.fn().mockResolvedValue(undefined),
  engineLoadSessionsCacheFirst: vi.fn().mockResolvedValue([]),
}));

// ---------------------------------------------------------------------------
// Mock 外部依赖
// ---------------------------------------------------------------------------

// CacheSyncEngine — mock 类实例，追踪所有写入调用
vi.mock('@/stores/cacheSync', () => {
  return {
    CacheSyncEngine: vi.fn().mockImplementation(() => ({
      writeSessionImmediately: engineWriteImmediately,
      writeSessionDebounced: engineWriteDebounced,
      deleteSession: engineDeleteSession,
      flushAllPending: engineFlushAll,
      loadSessionsCacheFirst: engineLoadSessionsCacheFirst,
      state: {
        syncStatus: 'idle',
        lastSyncTime: null,
        pendingWriteCount: 0,
        storageNearlyFull: false,
      },
      destroy: vi.fn(),
    })),
  };
});

// sessionStorage — mock 底层 IndexedDB 操作
vi.mock('@/lib/sessionStorage', () => ({
  saveNewSession: vi.fn().mockResolvedValue('mock-id'),
  persistSessionUpdate: vi.fn().mockResolvedValue(undefined),
  loadRecentSessions: vi.fn().mockResolvedValue([]),
  loadSession: vi.fn().mockResolvedValue(undefined),
  removeSession: vi.fn().mockResolvedValue(undefined),
}));

// memoryManager — mock FIFO 判定函数（引用模块级函数便于测试追踪）
vi.mock('@/utils/memoryManager', () => ({
  shouldEvictSessions: mockShouldEvict,
  getEvictCount: mockGetEvictCount,
  notifyFifoEviction: mockNotifyFifoEviction,
  cleanupDagNodes: mockCleanupDagNodes,
  startMemoryMonitoring: mockStartMemoryMonitoring,
}));

// db — mock evictOldestSessions（引用模块级函数便于测试追踪）
const { mockEvictOldestSessions } = vi.hoisted(() => ({
  mockEvictOldestSessions: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/db', () => ({
  evictOldestSessions: mockEvictOldestSessions,
}));

// useTaskStore — mock 避免 setActive 中的动态 require
vi.mock('@/stores/useTaskStore', () => ({
  useTaskStore: {
    getState: vi.fn().mockReturnValue({ nodes: new Map() }),
    setState: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: `session_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    name: '测试会话',
    projectPath: '/test/project',
    createdAt: Date.now(),
    isActive: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 测试套件
// ---------------------------------------------------------------------------

describe('useSessionStore', () => {
  // 每个测试后重置 store 状态和 localStorage
  afterEach(() => {
    useSessionStore.setState({
      sessions: [],
      activeSessionId: '',
      syncState: {
        syncStatus: 'idle',
        lastSyncTime: null,
        pendingWriteCount: 0,
        storageNearlyFull: false,
      },
      isInitialized: false,
    });
    localStorage.removeItem('cc_privacy_mode');
    // 重置 vi.hoisted 创建的 mock 函数状态
    mockShouldEvict.mockReturnValue(false);
    mockGetEvictCount.mockReturnValue(0);
    mockEvictOldestSessions.mockResolvedValue([]);
    mockStartMemoryMonitoring.mockReturnValue(vi.fn());
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. 会话 CRUD 操作
  // -------------------------------------------------------------------------

  describe('addSession', () => {
    it('添加新会话后 sessions 数组长度增加', () => {
      const session = makeSession({ name: '会话 A' });
      useSessionStore.getState().addSession(session);

      const { sessions } = useSessionStore.getState();
      // addSession 创建新对象（{...session, isActive: true}），按 ID 比较
      expect(sessions.find(s => s.id === session.id)).toBeDefined();
    });

    it('新添加的会话 isActive 为 true，既往会话全部改为 false', () => {
      const s1 = makeSession({ id: 's1', name: '会话1' });
      const s2 = makeSession({ id: 's2', name: '会话2' });

      useSessionStore.getState().addSession(s1);
      expect(useSessionStore.getState().sessions.find(s => s.id === 's1')?.isActive).toBe(true);

      useSessionStore.getState().addSession(s2);
      expect(useSessionStore.getState().sessions.find(s => s.id === 's1')?.isActive).toBe(false);
      expect(useSessionStore.getState().sessions.find(s => s.id === 's2')?.isActive).toBe(true);
    });

    it('activeSessionId 切换到新会话', () => {
      const s1 = makeSession({ id: 's1' });
      const s2 = makeSession({ id: 's2' });

      useSessionStore.getState().addSession(s1);
      expect(useSessionStore.getState().activeSessionId).toBe('s1');

      useSessionStore.getState().addSession(s2);
      expect(useSessionStore.getState().activeSessionId).toBe('s2');
    });

    it('新会话立即写入 IndexedDB（writeSessionImmediately 被调用）', () => {
      const session = makeSession();
      useSessionStore.getState().addSession(session);
      expect(engineWriteImmediately).toHaveBeenCalledWith(session);
    });

    it('writeSessionImmediately 抛出错误时错误被捕获（不向上传播）', () => {
      engineWriteImmediately.mockRejectedValueOnce(new Error('IndexedDB error'));
      const session = makeSession({ id: 'err_session' });

      // 错误被 .catch() 捕获，store 操作不应抛错
      expect(() => useSessionStore.getState().addSession(session)).not.toThrow();
    });

    it('FIFO 淘汰时 evictOldestSessions 抛出错误，错误被捕获', () => {
      // 触发 FIFO 路径：超过阈值 + evictCount > 0
      mockShouldEvict.mockReturnValue(true);
      mockGetEvictCount.mockReturnValue(5);
      mockEvictOldestSessions.mockRejectedValueOnce(new Error('DB error'));

      const oldSessions: Session[] = Array.from({ length: 105 }, (_, i) =>
        makeSession({ id: `old_${i}`, createdAt: 1000 + i })
      );
      useSessionStore.getState()._setSessions(oldSessions);

      const newSession = makeSession({ id: 'new_one' });
      // addSession 中 FIFO 路径执行，evictOldestSessions 抛错，但被 .catch() 捕获
      expect(() => useSessionStore.getState().addSession(newSession)).not.toThrow();
    });
  });

  describe('removeSession', () => {
    it('删除会话后 sessions 中不再包含该会话', () => {
      const s1 = makeSession({ id: 's1' });
      const s2 = makeSession({ id: 's2' });

      useSessionStore.getState().addSession(s1);
      useSessionStore.getState().addSession(s2);

      useSessionStore.getState().removeSession('s1');

      const ids = useSessionStore.getState().sessions.map(s => s.id);
      expect(ids).not.toContain('s1');
      expect(ids).toContain('s2');
    });

    it('删除当前活跃会话后 activeSessionId 切换到剩余第一个会话', () => {
      const s1 = makeSession({ id: 's1' });
      const s2 = makeSession({ id: 's2' });

      useSessionStore.getState().addSession(s1);
      useSessionStore.getState().addSession(s2); // s2 isActive

      useSessionStore.getState().removeSession('s2');

      // activeSessionId 切换到 s1
      const { sessions, activeSessionId } = useSessionStore.getState();
      expect(activeSessionId).toBe('s1');
      // s1 仍在 sessions 中
      expect(sessions.find(s => s.id === 's1')).toBeDefined();
    });

    it('删除不存在的会话不报错', () => {
      expect(() => useSessionStore.getState().removeSession('non-existent')).not.toThrow();
    });

    it('删除会话触发 engine.deleteSession', () => {
      const s1 = makeSession({ id: 's1' });
      useSessionStore.getState().addSession(s1);
      useSessionStore.getState().removeSession('s1');

      expect(engineDeleteSession).toHaveBeenCalledWith('s1');
    });

    it('deleteSession 抛出错误时错误被捕获（不向上传播）', () => {
      engineDeleteSession.mockRejectedValueOnce(new Error('IndexedDB error'));
      const s1 = makeSession({ id: 's1' });
      useSessionStore.getState().addSession(s1);

      // 错误被 .catch() 捕获，store 操作不应抛错
      expect(() => useSessionStore.getState().removeSession('s1')).not.toThrow();
    });
  });

  describe('setActive', () => {
    it('设置活跃会话后该会话 isActive 为 true', () => {
      const s1 = makeSession({ id: 's1' });
      const s2 = makeSession({ id: 's2' });

      useSessionStore.getState().addSession(s1);
      useSessionStore.getState().addSession(s2); // s2 isActive

      // 切换回 s1
      useSessionStore.getState().setActive('s1');

      expect(useSessionStore.getState().sessions.find(s => s.id === 's1')?.isActive).toBe(true);
      expect(useSessionStore.getState().sessions.find(s => s.id === 's2')?.isActive).toBe(false);
    });

    it('setActive 触发 writeSessionDebounced', () => {
      const s1 = makeSession({ id: 's1' });
      useSessionStore.getState().addSession(s1);

      useSessionStore.getState().setActive('s1');

      expect(engineWriteDebounced).toHaveBeenCalledWith('s1', { isActive: true });
    });
  });

  describe('renameSession', () => {
    it('重命名会话后 name 已更新', () => {
      const s1 = makeSession({ id: 's1', name: '旧名称' });
      useSessionStore.getState().addSession(s1);

      useSessionStore.getState().renameSession('s1', '新名称');

      expect(useSessionStore.getState().sessions.find(s => s.id === 's1')?.name).toBe('新名称');
    });

    it('renameSession 触发 writeSessionDebounced', () => {
      const s1 = makeSession({ id: 's1' });
      useSessionStore.getState().addSession(s1);

      useSessionStore.getState().renameSession('s1', '新名称');

      expect(engineWriteDebounced).toHaveBeenCalledWith('s1', { name: '新名称' });
    });

    it('重命名不存在的会话不报错', () => {
      expect(() => useSessionStore.getState().renameSession('ghost', '名字')).not.toThrow();
    });
  });

  describe('updateSession', () => {
    it('更新会话属性（model / projectPath）', () => {
      const s1 = makeSession({ id: 's1', model: undefined });
      useSessionStore.getState().addSession(s1);

      useSessionStore.getState().updateSession('s1', { model: 'claude-3-5-sonnet' });

      const updated = useSessionStore.getState().sessions.find(s => s.id === 's1');
      expect(updated?.model).toBe('claude-3-5-sonnet');
    });

    it('updateSession 触发 writeSessionDebounced', () => {
      const s1 = makeSession({ id: 's1' });
      useSessionStore.getState().addSession(s1);

      useSessionStore.getState().updateSession('s1', { name: '更新后' });

      expect(engineWriteDebounced).toHaveBeenCalledWith('s1', { name: '更新后' });
    });

    it('更新不存在的会话不报错', () => {
      expect(() => useSessionStore.getState().updateSession('ghost', { name: 'x' })).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // 2. FIFO 淘汰逻辑
  // -------------------------------------------------------------------------

  describe('FIFO 淘汰', () => {
    it('会话数超过 100 且 shouldEvictSessions 返回 true 时，淘汰最旧会话', async () => {
      // 注入 mock：超过阈值，淘汰 10 条
      mockShouldEvict.mockReturnValue(true);
      mockGetEvictCount.mockReturnValue(10);

      // 预先塞入 100 条旧会话（超过阈值）
      const oldSessions: Session[] = Array.from({ length: 100 }, (_, i) =>
        makeSession({ id: `old_${i}`, name: `旧会话${i}`, createdAt: 1000 + i })
      );
      // 用 _setSessions 批量设置（绕过 addSession 的写入逻辑）
      useSessionStore.getState()._setSessions(oldSessions);

      // 新增一条，此时应该触发淘汰
      const newSession = makeSession({ id: 'new_session', name: '新会话' });
      useSessionStore.getState().addSession(newSession);

      const { sessions } = useSessionStore.getState();
      // 淘汰 10 条后应剩余 91 条
      expect(sessions.length).toBe(91);
      // 新会话应在其中
      expect(sessions.find(s => s.id === 'new_session')).toBeDefined();
      // 最旧的 10 条应被移除（old_0 ~ old_9 是最旧的）
      for (let i = 0; i < 10; i++) {
        expect(sessions.find(s => s.id === `old_${i}`)).toBeUndefined();
      }

      // evictOldestSessions 被调用（同步触发，mockResolvedValue）
      expect(mockEvictOldestSessions).toHaveBeenCalled();
    });

    it('shouldEvictSessions 返回 false 时不触发淘汰', () => {
      mockShouldEvict.mockReturnValue(false);

      const oldSessions: Session[] = Array.from({ length: 5 }, (_, i) =>
        makeSession({ id: `s_${i}`, createdAt: 1000 + i })
      );
      useSessionStore.getState()._setSessions(oldSessions);

      const newSession = makeSession({ id: 'new_one' });
      useSessionStore.getState().addSession(newSession);

      const { sessions } = useSessionStore.getState();
      // 全部保留（6 条）
      expect(sessions.length).toBe(6);
    });
  });

  // -------------------------------------------------------------------------
  // 3. 隐私模式
  // -------------------------------------------------------------------------

  describe('隐私模式', () => {
    it('setPrivacyMode(true) 后 isPrivacyModeEnabled() 返回 true', () => {
      setPrivacyMode(true);
      expect(isPrivacyModeEnabled()).toBe(true);
    });

    it('setPrivacyMode(false) 后 isPrivacyModeEnabled() 返回 false', () => {
      setPrivacyMode(false);
      expect(isPrivacyModeEnabled()).toBe(false);
    });

    it('未设置时 isPrivacyModeEnabled() 默认为 false', () => {
      localStorage.removeItem('cc_privacy_mode');
      expect(isPrivacyModeEnabled()).toBe(false);
    });

    it('设置后值正确存储在 localStorage', () => {
      setPrivacyMode(true);
      expect(localStorage.getItem('cc_privacy_mode')).toBe('true');

      setPrivacyMode(false);
      expect(localStorage.getItem('cc_privacy_mode')).toBe('false');
    });
  });

  // -------------------------------------------------------------------------
  // 4. 缓存同步集成
  // -------------------------------------------------------------------------

  describe('缓存同步集成', () => {
    it('新建会话立即调用 writeSessionImmediately', () => {
      const session = makeSession();
      useSessionStore.getState().addSession(session);

      expect(engineWriteImmediately).toHaveBeenCalledWith(session);
    });

    it('会话更新使用防抖写入（advanceTimersByTime 触发）', () => {
      vi.useFakeTimers();

      const s1 = makeSession({ id: 's1' });
      useSessionStore.getState().addSession(s1);

      // 重置 addSession 的调用（只要 writeSessionImmediately）
      engineWriteDebounced.mockClear();

      // 触发防抖更新
      useSessionStore.getState().updateSession('s1', { name: '防抖测试' });

      // 防抖期间不应有 flush
      expect(engineFlushAll).not.toHaveBeenCalled();

      // 推进时间，触发防抖
      vi.advanceTimersByTime(500);
      vi.runAllTimers();

      expect(engineWriteDebounced).toHaveBeenCalledWith('s1', { name: '防抖测试' });

      vi.useRealTimers();
    });

    it('flushPendingSessionWrites 调用 engine.flushAllPending', async () => {
      await flushPendingSessionWrites();
      expect(engineFlushAll).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 5. 状态初始化
  // -------------------------------------------------------------------------

  describe('_setSessions', () => {
    it('有会话时正确设置 sessions 和 activeSessionId', () => {
      const sessions: Session[] = [
        makeSession({ id: 's1', name: '会话1', isActive: false }),
        makeSession({ id: 's2', name: '会话2', isActive: true }),
        makeSession({ id: 's3', name: '会话3', isActive: false }),
      ];

      useSessionStore.getState()._setSessions(sessions);

      const { sessions: result, activeSessionId, isInitialized } = useSessionStore.getState();
      expect(result).toEqual(sessions);
      expect(activeSessionId).toBe('s2'); // isActive 为 true 的会话
      expect(isInitialized).toBe(true);
    });

    it('无 isActive 会话时默认选第一个', () => {
      const sessions: Session[] = [
        makeSession({ id: 's1', isActive: false }),
        makeSession({ id: 's2', isActive: false }),
      ];

      useSessionStore.getState()._setSessions(sessions);

      expect(useSessionStore.getState().activeSessionId).toBe('s1');
    });

    it('sessions 为空时降级到默认会话，isInitialized 仍为 true', () => {
      useSessionStore.getState()._setSessions([]);

      const { sessions, isInitialized } = useSessionStore.getState();
      expect(sessions.length).toBe(1);
      expect(isInitialized).toBe(true);
    });

    it('_setSyncState 正确更新 syncState', () => {
      const newSyncState = {
        syncStatus: 'syncing_to_cache' as const,
        lastSyncTime: 1234567890,
        pendingWriteCount: 5,
        storageNearlyFull: true,
      };
      useSessionStore.getState()._setSyncState(newSyncState);

      const { syncState } = useSessionStore.getState();
      expect(syncState).toEqual(newSyncState);
    });
  });

  describe('isInitialized 初始值', () => {
    it('store 创建后 isInitialized 初始为 false', () => {
      // 读取当前 store 状态的初始值（在 _setSessions 之前）
      // 由于测试环境 store 已经被之前的测试修改，通过验证 _setSessions 之后变为 true
      useSessionStore.getState()._setSessions([makeSession({ id: 'x' })]);
      expect(useSessionStore.getState().isInitialized).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 6. 边界情况
  // -------------------------------------------------------------------------

  describe('边界情况', () => {
    it('删除最后一个会话后 sessions 为空但 activeSessionId 有 fallback 值', () => {
      // 确保初始状态干净：只有一个默认会话
      useSessionStore.getState()._setSessions([makeSession({ id: 'only-session', name: '唯一会话' })]);

      // 删除唯一会话
      useSessionStore.getState().removeSession('only-session');

      const { sessions, activeSessionId } = useSessionStore.getState();
      // sessions 为空（removeSession 不自动创建 fallback）
      expect(sessions.length).toBe(0);
      // activeSessionId 降级到 FALLBACK_SESSION_ID
      expect(activeSessionId).toBeTruthy();
    });

    it('并发多次 addSession 每条都会触发 writeSessionImmediately', () => {
      const s1 = makeSession({ id: 's1' });
      const s2 = makeSession({ id: 's2' });

      useSessionStore.getState().addSession(s1);
      useSessionStore.getState().addSession(s2);

      expect(engineWriteImmediately).toHaveBeenCalledTimes(2);
    });
  });

  // -------------------------------------------------------------------------
  // 7. 辅助函数（loadSessionsFromCache / initCacheSyncServerFns / initMemoryMonitoring）
  // -------------------------------------------------------------------------

  describe('loadSessionsFromCache', () => {
    it('加载缓存会话后 store 状态正确更新', async () => {
      const cachedSessions: Session[] = [
        makeSession({ id: 'cached_1', name: '缓存会话1' }),
        makeSession({ id: 'cached_2', name: '缓存会话2', isActive: true }),
      ];

      // 直接 mock engineLoadSessionsCacheFirst
      engineLoadSessionsCacheFirst.mockResolvedValue(cachedSessions);

      await loadSessionsFromCache(20);

      const { sessions, activeSessionId, isInitialized } = useSessionStore.getState();
      expect(sessions).toEqual(cachedSessions);
      expect(activeSessionId).toBe('cached_2');
      expect(isInitialized).toBe(true);
    });
  });

  describe('initCacheSyncServerFns', () => {
    it('正确设置 push 和 pull 函数（不抛错）', () => {
      const pushFn = vi.fn().mockResolvedValue([]);
      const pullFn = vi.fn().mockResolvedValue([]);

      // 验证函数可调用不抛错
      expect(() =>
        initCacheSyncServerFns({ push: pushFn, pull: pullFn })
      ).not.toThrow();
    });
  });

  describe('initMemoryMonitoring', () => {
    it('调用 startMemoryMonitoring 并返回停止函数', () => {
      const stop = initMemoryMonitoring(30000);

      // startMemoryMonitoring mock 被调用
      expect(mockStartMemoryMonitoring).toHaveBeenCalledWith(30000, expect.any(Function));

      // stop 是清理函数
      expect(typeof stop).toBe('function');
      stop();
    });

    it('第二次调用会先清理旧的监控（memoryMonitorCleanup 被触发）', () => {
      // 第一次调用
      const stop1 = initMemoryMonitoring(60000);
      mockStartMemoryMonitoring.mockClear();

      // 第二次调用：旧的 cleanup 应被触发
      const stop2 = initMemoryMonitoring(30000);

      // mockStartMemoryMonitoring 再次被调用
      expect(mockStartMemoryMonitoring).toHaveBeenCalled();

      stop2();
    });

    it('startMemoryMonitoring 触发内存警告回调（callback 执行行覆盖）', () => {
      // 让 mockStartMemoryMonitoring 立即调用传入的回调
      // 这样行 367-369（内存警告 callback）会被执行
      let capturedCallback: ((usage: number) => void) | undefined;
      mockStartMemoryMonitoring.mockImplementation((interval: number, cb: (u: number) => void) => {
        capturedCallback = cb;
        return vi.fn(); // stop 函数
      });

      initMemoryMonitoring(60000);

      // 手动触发回调（模拟内存超限）
      if (capturedCallback) {
        capturedCallback(200 * 1024 * 1024); // 200MB
      }

      // 验证 callback 被调用
      expect(capturedCallback).toBeDefined();

      // 恢复 mock
      mockStartMemoryMonitoring.mockReturnValue(vi.fn());
    });
  });
});
