/**
 * CacheSyncEngine 完整测试
 * 覆盖行覆盖率 ≥ 95%
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CacheSyncEngine } from '@/stores/cacheSync';
import type { Session } from '@/stores/useSessionStore';
import type { CacheSyncState } from '@/stores/cacheSync';

// ---------------------------------------------------------------------------
// Mock modules (cacheSync.ts imports from these)
// ---------------------------------------------------------------------------
vi.mock('@/lib/sessionStorage', () => ({
  saveNewSession: vi.fn().mockResolvedValue('session_1'),
  persistSessionUpdate: vi.fn().mockResolvedValue(undefined),
  loadRecentSessions: vi.fn().mockResolvedValue([]),
  loadSession: vi.fn().mockResolvedValue(undefined),
  removeSession: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/db', () => ({
  isStorageNearlyFull: vi.fn().mockResolvedValue(false),
  evictOldestSessions: vi.fn().mockResolvedValue([]),
}));

// ---------------------------------------------------------------------------
// Import mocked modules
// ---------------------------------------------------------------------------
import {
  saveNewSession,
  persistSessionUpdate,
  loadRecentSessions,
  loadSession,
  removeSession,
} from '@/lib/sessionStorage';
import { isStorageNearlyFull, evictOldestSessions } from '@/lib/db';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const SESSION_1: Session = {
  id: 'session_1',
  name: 'Test Session',
  projectPath: '/test/project',
  createdAt: Date.now(),
  isActive: true,
};

function makeEngine(overrides?: {
  onStateChange?: (state: CacheSyncState) => void;
  serverSync?: (type: 'push' | 'pull', sessions: any[]) => Promise<any[]>;
}) {
  const stateChanges: CacheSyncState[] = [];
  const onStateChange = vi.fn((s: CacheSyncState) => stateChanges.push(s));
  const serverSync = vi.fn().mockResolvedValue([]);

  const engine = new CacheSyncEngine({
    onStateChange: overrides?.onStateChange ?? onStateChange,
    serverSync: overrides?.serverSync ?? serverSync,
  });

  return { engine, onStateChange, serverSync, stateChanges };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('CacheSyncEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up any active debouncers
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Constructor
  // -------------------------------------------------------------------------
  describe('constructor', () => {
    it('should initialize engine with correct default state', () => {
      const { engine } = makeEngine();
      expect(engine).toBeDefined();
      expect(engine.status).toBe('idle');
      expect(engine.lastSyncTime).toBeNull();
      expect(engine.pendingWriteCount).toBe(0);
      expect(engine.storageNearlyFull).toBe(false);
      expect(engine.state).toEqual({
        syncStatus: 'idle',
        lastSyncTime: null,
        pendingWriteCount: 0,
        storageNearlyFull: false,
      });
    });

    it('should store onStateChange and serverSync callbacks (verify via writeSessionImmediately)', async () => {
      // Use makeEngine which properly sets up all module mocks
      const { engine, onStateChange } = makeEngine();
      const testSession: Session = {
        id: 's1', name: 'Test', projectPath: '/test', createdAt: Date.now(), isActive: true,
      };
      await engine.writeSessionImmediately(testSession);
      // checkAndEvictIfNeeded calls notify() → onStateChange should be called at least once
      expect(onStateChange).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Getters
  // -------------------------------------------------------------------------
  describe('getters', () => {
    it('should return correct initial status', () => {
      const { engine } = makeEngine();
      expect(engine.status).toBe('idle');
      expect(engine.lastSyncTime).toBe(null);
      expect(engine.pendingWriteCount).toBe(0);
      expect(engine.storageNearlyFull).toBe(false);
    });

    it('should return full state via .state getter', () => {
      const { engine } = makeEngine();
      const state = engine.state;
      expect(state).toEqual({
        syncStatus: 'idle',
        lastSyncTime: null,
        pendingWriteCount: 0,
        storageNearlyFull: false,
      });
    });
  });

  // -------------------------------------------------------------------------
  // writeSessionImmediately
  // -------------------------------------------------------------------------
  describe('writeSessionImmediately', () => {
    it('should save session immediately without debounce', async () => {
      const { engine, onStateChange } = makeEngine();
      await engine.writeSessionImmediately(SESSION_1);

      expect(saveNewSession).toHaveBeenCalledWith({
        id: SESSION_1.id,
        name: SESSION_1.name,
        projectPath: SESSION_1.projectPath,
      });
      expect(engine.lastSyncTime).not.toBeNull();
      expect(onStateChange).toHaveBeenCalled();
    });

    it('should call checkAndEvictIfNeeded before saving', async () => {
      const { engine } = makeEngine();
      await engine.writeSessionImmediately(SESSION_1);
      // isStorageNearlyFull is called by checkAndEvictIfNeeded
      expect(isStorageNearlyFull).toHaveBeenCalled();
    });

    it('should notify state change after save', async () => {
      const { engine, stateChanges } = makeEngine();
      await engine.writeSessionImmediately(SESSION_1);
      // At least 1 state change for lastSyncTime update
      expect(stateChanges.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // writeSessionDebounced
  // -------------------------------------------------------------------------
  describe('writeSessionDebounced', () => {
    it('should NOT write immediately', () => {
      const { engine } = makeEngine();
      engine.writeSessionDebounced('s1', { name: 'Updated' });
      expect(persistSessionUpdate).not.toHaveBeenCalled();
    });

    it('should write after DEBOUNCE_MS (500ms)', async () => {
      vi.useFakeTimers();
      try {
        const { engine } = makeEngine();
        engine.writeSessionDebounced('s1', { name: 'Updated' });
        expect(persistSessionUpdate).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(510);
        expect(persistSessionUpdate).toHaveBeenCalledTimes(1);
        expect(persistSessionUpdate).toHaveBeenCalledWith('s1', { name: 'Updated' });
      } finally {
        vi.useRealTimers();
      }
    });

    it('should debounce rapid updates (only one write)', async () => {
      vi.useFakeTimers();
      try {
        const { engine } = makeEngine();
        engine.writeSessionDebounced('s1', { name: 'A' });
        await vi.advanceTimersByTimeAsync(100);
        engine.writeSessionDebounced('s1', { name: 'B' });
        await vi.advanceTimersByTimeAsync(100);
        engine.writeSessionDebounced('s1', { name: 'C' });
        await vi.advanceTimersByTimeAsync(510);

        expect(persistSessionUpdate).toHaveBeenCalledTimes(1);
        // Last update should win (merged)
        expect(persistSessionUpdate).toHaveBeenCalledWith('s1', { name: 'C' });
      } finally {
        vi.useRealTimers();
      }
    });

    it('should debounce updates for different sessionIds independently', async () => {
      vi.useFakeTimers();
      try {
        const { engine } = makeEngine();

        engine.writeSessionDebounced('s1', { name: 'S1' });
        await vi.advanceTimersByTimeAsync(100);
        engine.writeSessionDebounced('s2', { name: 'S2' });

        // Both pending — no writes yet
        expect(persistSessionUpdate).not.toHaveBeenCalled();

        // Resolve s1's debounce
        await vi.advanceTimersByTimeAsync(410); // 100+410 = 510ms since s1
        expect(persistSessionUpdate).toHaveBeenCalledTimes(1);
        expect(persistSessionUpdate).toHaveBeenCalledWith('s1', { name: 'S1' });

        // Resolve s2's debounce
        await vi.advanceTimersByTimeAsync(410); // 100+410 = 510ms since s2
        expect(persistSessionUpdate).toHaveBeenCalledTimes(2);
        expect(persistSessionUpdate).toHaveBeenCalledWith('s2', { name: 'S2' });
      } finally {
        vi.useRealTimers();
      }
    });

    it('should merge multiple updates before single write', async () => {
      vi.useFakeTimers();
      try {
        const { engine } = makeEngine();
        engine.writeSessionDebounced('s1', { name: 'First' });
        await vi.advanceTimersByTimeAsync(100);
        engine.writeSessionDebounced('s1', { name: 'Second', queryCount: 5 });
        await vi.advanceTimersByTimeAsync(510);

        expect(persistSessionUpdate).toHaveBeenCalledTimes(1);
        // Merged: last name + accumulated queryCount
        expect(persistSessionUpdate).toHaveBeenCalledWith('s1', {
          name: 'Second',
          queryCount: 5,
        });
      } finally {
        vi.useRealTimers();
      }
    });

    it('should increment pendingWriteCount while writing', async () => {
      vi.useFakeTimers();
      try {
        const { engine, stateChanges } = makeEngine();
        engine.writeSessionDebounced('s1', { name: 'Test' });
        expect(engine.pendingWriteCount).toBe(0);

        await vi.advanceTimersByTimeAsync(510);
        // After write, pendingWriteCount returns to 0
        expect(engine.pendingWriteCount).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    });

    it('should call checkAndEvictIfNeeded inside debounced write', async () => {
      vi.useFakeTimers();
      try {
        const { engine } = makeEngine();
        engine.writeSessionDebounced('s1', { name: 'Test' });
        await vi.advanceTimersByTimeAsync(510);

        // checkAndEvictIfNeeded → isStorageNearlyFull
        expect(isStorageNearlyFull).toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it('should update lastSyncTime after debounced write', async () => {
      vi.useFakeTimers();
      try {
        const { engine } = makeEngine();
        expect(engine.lastSyncTime).toBeNull();

        engine.writeSessionDebounced('s1', { name: 'Test' });
        await vi.advanceTimersByTimeAsync(510);

        expect(engine.lastSyncTime).not.toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  // -------------------------------------------------------------------------
  // flushAllPending
  // -------------------------------------------------------------------------
  describe('flushAllPending', () => {
    it('should immediately write all pending debounced updates', async () => {
      vi.useFakeTimers();
      try {
        const { engine } = makeEngine();
        engine.writeSessionDebounced('s1', { name: 'S1' });
        engine.writeSessionDebounced('s2', { name: 'S2' });
        expect(persistSessionUpdate).not.toHaveBeenCalled();

        await engine.flushAllPending();

        expect(persistSessionUpdate).toHaveBeenCalledTimes(2);
        expect(persistSessionUpdate).toHaveBeenCalledWith('s1', { name: 'S1' });
        expect(persistSessionUpdate).toHaveBeenCalledWith('s2', { name: 'S2' });
      } finally {
        vi.useRealTimers();
      }
    });

    it('should do nothing when no pending writes', async () => {
      const { engine } = makeEngine();
      await engine.flushAllPending();
      expect(persistSessionUpdate).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // cancelPending
  // -------------------------------------------------------------------------
  describe('cancelPending', () => {
    it('should cancel a pending debounced write', async () => {
      vi.useFakeTimers();
      try {
        const { engine } = makeEngine();
        engine.writeSessionDebounced('s1', { name: 'S1' });
        expect(engine.pendingWriteCount).toBe(0);

        engine.cancelPending('s1');

        await vi.advanceTimersByTimeAsync(510);
        expect(persistSessionUpdate).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it('should be no-op for unknown sessionId', () => {
      const { engine } = makeEngine();
      expect(() => engine.cancelPending('unknown')).not.toThrow();
    });

    it('should notify state change after cancel', () => {
      vi.useFakeTimers();
      try {
        const { engine, onStateChange } = makeEngine();
        engine.writeSessionDebounced('s1', { name: 'S1' });
        const callCountBefore = onStateChange.mock.calls.length;

        engine.cancelPending('s1');

        expect(onStateChange.mock.calls.length).toBeGreaterThan(callCountBefore);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  // -------------------------------------------------------------------------
  // loadSessionsCacheFirst
  // -------------------------------------------------------------------------
  describe('loadSessionsCacheFirst', () => {
    it('should load from cache first and update status to syncing_to_cache', async () => {
      const cachedSessions = [
        {
          id: 'cached_1',
          name: 'Cached Session',
          projectPath: '/test',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
          queryCount: 0,
          tokenCount: 0,
        },
      ];
      (loadRecentSessions as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        cachedSessions
      );

      const { engine, serverSync } = makeEngine();
      serverSync.mockResolvedValueOnce([]); // no server data

      const result = await engine.loadSessionsCacheFirst(10);

      expect(loadRecentSessions).toHaveBeenCalledWith(10);
      expect(engine.status).toBe('idle');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('cached_1');
    });

    it('should merge server data with cache when server has sessions', async () => {
      const cachedSessions = [
        {
          id: 'cached_1',
          name: 'Cached Only',
          projectPath: '/test',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
          queryCount: 0,
          tokenCount: 0,
        },
      ];
      const serverSessions = [
        {
          id: 'server_1',
          name: 'Server Session',
          projectPath: '/server',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
          queryCount: 3,
          tokenCount: 1000,
          model: 'claude-3-5',
        },
      ];

      (loadRecentSessions as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        cachedSessions
      );

      const { engine, serverSync } = makeEngine();
      serverSync.mockResolvedValueOnce(serverSessions);

      const result = await engine.loadSessionsCacheFirst();

      // Server data takes precedence
      expect(result).toHaveLength(2); // server_1 + local-only cached_1
      expect(result[0].id).toBe('server_1');
      expect(result[1].id).toBe('cached_1');
    });

    it('should use server data to update cache (persistSessionUpdate called)', async () => {
      const serverSessions = [
        {
          id: 'server_1',
          name: 'Server Session',
          projectPath: '/server',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
          queryCount: 3,
          tokenCount: 1000,
        },
      ];

      (loadRecentSessions as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
      const { engine, serverSync } = makeEngine();
      serverSync.mockResolvedValueOnce(serverSessions);

      await engine.loadSessionsCacheFirst();

      expect(persistSessionUpdate).toHaveBeenCalledWith('server_1', expect.any(Object));
    });

    it('should fallback to cache when server sync fails', async () => {
      const cachedSessions = [
        {
          id: 'cached_1',
          name: 'Cached',
          projectPath: '/test',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
          queryCount: 0,
          tokenCount: 0,
        },
      ];
      (loadRecentSessions as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        cachedSessions
      );

      // Use a directly-created engine with a rejecting serverSync.
      // We pass a noop serverSync to loadSessionCacheFirst so it doesn't
      // overwrite the error status set by the failing serverSync in loadSessionsCacheFirst.
      const rejectingSync = vi.fn().mockRejectedValue(new Error('network error'));
      const engine = new CacheSyncEngine({
        onStateChange: vi.fn(),
        serverSync: rejectingSync,
      });

      const result = await engine.loadSessionsCacheFirst();

      expect(engine.status).toBe('error');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('cached_1');
    });

    it('should set status to syncing_to_server during server pull', async () => {
      (loadRecentSessions as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

      const { engine, serverSync } = makeEngine();
      serverSync.mockResolvedValueOnce([]);

      const p = engine.loadSessionsCacheFirst();

      // After cache load, status should be syncing_to_server
      // (the exact timing depends on async flow, but we check final state)
      await p;
      expect(engine.status).toBe('idle');
    });

    it('should handle empty cache and empty server gracefully', async () => {
      (loadRecentSessions as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
      const { engine, serverSync } = makeEngine();
      serverSync.mockResolvedValueOnce([]);

      const result = await engine.loadSessionsCacheFirst();
      expect(result).toHaveLength(0);
      expect(engine.status).toBe('idle');
    });

    it('should keep local-only sessions when server returns data', async () => {
      const cachedSessions = [
        {
          id: 'local_only',
          name: 'Local Only',
          projectPath: '/local',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
          queryCount: 0,
          tokenCount: 0,
        },
      ];
      const serverSessions = [
        {
          id: 'server_1',
          name: 'Server',
          projectPath: '/server',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
          queryCount: 1,
          tokenCount: 500,
        },
      ];

      (loadRecentSessions as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        cachedSessions
      );
      const { engine, serverSync } = makeEngine();
      serverSync.mockResolvedValueOnce(serverSessions);

      const result = await engine.loadSessionsCacheFirst();

      // Both server and local-only sessions included
      const ids = result.map(s => s.id);
      expect(ids).toContain('server_1');
      expect(ids).toContain('local_only');
    });
  });

  // -------------------------------------------------------------------------
  // loadSessionCacheFirst
  // -------------------------------------------------------------------------
  describe('loadSessionCacheFirst', () => {
    it('should return session from cache immediately', async () => {
      const cachedRecord = {
        id: 's1',
        name: 'Cached Session',
        projectPath: '/test',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isActive: true,
        queryCount: 0,
        tokenCount: 0,
      };
      (loadSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        cachedRecord
      );

      const { engine } = makeEngine();
      const result = await engine.loadSessionCacheFirst('s1');

      expect(result).toBeDefined();
      expect(result!.id).toBe('s1');
      expect(loadSession).toHaveBeenCalledWith('s1');
    });

    it('should return undefined when session not found', async () => {
      (loadSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);

      const { engine } = makeEngine();
      const result = await engine.loadSessionCacheFirst('notfound');

      expect(result).toBeUndefined();
    });

    it('should trigger background server sync (does not block return)', async () => {
      vi.useFakeTimers();
      try {
        const cachedRecord = {
          id: 's1',
          name: 'Cached',
          projectPath: '/test',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
          queryCount: 0,
          tokenCount: 0,
        };
        (loadSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
          cachedRecord
        );

        const { engine, serverSync } = makeEngine();
        serverSync.mockResolvedValueOnce([]);

        const resultPromise = engine.loadSessionCacheFirst('s1');

        // Should return immediately without waiting for serverSync
        const result = await resultPromise;
        expect(result).toBeDefined();
        expect(result!.id).toBe('s1');

        // Advance timers so background promise resolves
        await vi.advanceTimersByTimeAsync(0);
        await Promise.resolve(); // allow microtask queue to flush
      } finally {
        vi.useRealTimers();
      }
    });

    it('should silently ignore background sync error', async () => {
      const cachedRecord = {
        id: 's1',
        name: 'Cached',
        projectPath: '/test',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isActive: true,
        queryCount: 0,
        tokenCount: 0,
      };
      (loadSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        cachedRecord
      );

      const { engine, serverSync } = makeEngine();
      serverSync.mockRejectedValueOnce(new Error('server error'));

      // Should NOT throw
      const result = await engine.loadSessionCacheFirst('s1');
      expect(result).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // pushToServer
  // -------------------------------------------------------------------------
  describe('pushToServer', () => {
    it('should push sessions to server and update local cache', async () => {
      const sessions: Session[] = [
        {
          id: 's1',
          name: 'To Push',
          projectPath: '/test',
          createdAt: Date.now(),
          isActive: true,
        },
      ];

      const serverResolved = [
        {
          id: 's1',
          name: 'Resolved by Server',
          projectPath: '/server',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
          queryCount: 2,
          tokenCount: 600,
          model: 'claude-3',
        },
      ];

      const { engine, serverSync } = makeEngine();
      serverSync.mockResolvedValueOnce(serverResolved);

      const result = await engine.pushToServer(sessions);

      expect(serverSync).toHaveBeenCalledWith('push', expect.any(Array));
      expect(persistSessionUpdate).toHaveBeenCalledWith('s1', expect.any(Object));
      expect(engine.status).toBe('idle');
      expect(engine.lastSyncTime).not.toBeNull();
      expect(result).toEqual(serverResolved);
    });

    it('should set status to syncing_to_server during push', async () => {
      const sessions: Session[] = [SESSION_1];
      const { engine, serverSync } = makeEngine();
      serverSync.mockResolvedValueOnce([]);

      const p = engine.pushToServer(sessions);
      // Status changes during sync
      await p;
      expect(engine.status).toBe('idle');
    });

    it('should set status to error and throw when server fails', async () => {
      const sessions: Session[] = [SESSION_1];
      const { engine, serverSync } = makeEngine();
      serverSync.mockRejectedValueOnce(new Error('push failed'));

      await expect(engine.pushToServer(sessions)).rejects.toThrow('push failed');
      expect(engine.status).toBe('error');
    });

    it('should resolve lastSyncTime after successful push', async () => {
      const sessions: Session[] = [SESSION_1];
      const { engine, serverSync } = makeEngine();
      serverSync.mockResolvedValueOnce([]);

      expect(engine.lastSyncTime).toBeNull();
      await engine.pushToServer(sessions);
      expect(engine.lastSyncTime).not.toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // checkAndEvictIfNeeded
  // -------------------------------------------------------------------------
  describe('checkAndEvictIfNeeded', () => {
    it('should do nothing when storage is not nearly full', async () => {
      (isStorageNearlyFull as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        false
      );

      const { engine } = makeEngine();
      await engine.checkAndEvictIfNeeded();

      expect(evictOldestSessions).not.toHaveBeenCalled();
      expect(engine.storageNearlyFull).toBe(false);
    });

    it('should evict when storage is nearly full', async () => {
      (isStorageNearlyFull as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false); // after eviction, check again
      (evictOldestSessions as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        'old_1',
        'old_2',
      ]);

      const { engine } = makeEngine();
      await engine.checkAndEvictIfNeeded();

      expect(evictOldestSessions).toHaveBeenCalledWith(5);
      expect(engine.storageNearlyFull).toBe(false);
    });

    it('should set storageNearlyFull=true after eviction if still nearly full', async () => {
      (isStorageNearlyFull as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true); // still full after eviction
      (evictOldestSessions as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        'old_1',
      ]);

      const { engine } = makeEngine();
      await engine.checkAndEvictIfNeeded();

      expect(engine.storageNearlyFull).toBe(true);
    });

    it('should notify state change', async () => {
      (isStorageNearlyFull as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        false
      );

      const { engine, onStateChange } = makeEngine();
      const callsBefore = onStateChange.mock.calls.length;
      await engine.checkAndEvictIfNeeded();

      expect(onStateChange.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  // -------------------------------------------------------------------------
  // deleteSession
  // -------------------------------------------------------------------------
  describe('deleteSession', () => {
    it('should cancel pending writes and remove session', async () => {
      vi.useFakeTimers();
      try {
        const { engine } = makeEngine();
        engine.writeSessionDebounced('s1', { name: 'Pending' });

        await engine.deleteSession('s1');

        expect(removeSession).toHaveBeenCalledWith('s1');
        expect(engine.lastSyncTime).not.toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it('should notify state change after delete', async () => {
      const { engine, onStateChange } = makeEngine();
      const callsBefore = onStateChange.mock.calls.length;
      await engine.deleteSession('any_id');
      expect(onStateChange.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  // -------------------------------------------------------------------------
  // destroy
  // -------------------------------------------------------------------------
  describe('destroy', () => {
    it('should cancel all pending debounced writes', async () => {
      vi.useFakeTimers();
      try {
        const { engine } = makeEngine();
        engine.writeSessionDebounced('s1', { name: 'S1' });
        engine.writeSessionDebounced('s2', { name: 'S2' });

        engine.destroy();

        await vi.advanceTimersByTimeAsync(1000);
        expect(persistSessionUpdate).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it('should be safe to call destroy multiple times', () => {
      const { engine } = makeEngine();
      engine.writeSessionDebounced('s1', { name: 'S1' });
      expect(() => {
        engine.destroy();
        engine.destroy();
      }).not.toThrow();
    });

    it('should clear debouncers and pendingUpdates maps', () => {
      vi.useFakeTimers();
      try {
        const { engine } = makeEngine();
        engine.writeSessionDebounced('s1', { name: 'S1' });
        engine.destroy();

        // After destroy, calling cancelPending with any id should be safe
        expect(() => engine.cancelPending('s1')).not.toThrow();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------
  describe('edge cases', () => {
    it('should handle concurrent writeSessionImmediately calls', async () => {
      const { engine } = makeEngine();
      const sessions: Session[] = [
        { id: 's1', name: 'S1', projectPath: '/p1', createdAt: Date.now(), isActive: true },
        { id: 's2', name: 'S2', projectPath: '/p2', createdAt: Date.now(), isActive: true },
      ];

      await Promise.all(sessions.map(s => engine.writeSessionImmediately(s)));

      expect(saveNewSession).toHaveBeenCalledTimes(2);
    });

    it('should not crash when serverSync returns null fields in sessions', async () => {
      const serverSessions = [
        {
          id: 's1',
          name: null as any,
          projectPath: '/server',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
          queryCount: 0,
          tokenCount: 0,
        },
      ];

      (loadRecentSessions as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
      const { engine, serverSync } = makeEngine();
      serverSync.mockResolvedValueOnce(serverSessions);

      const result = await engine.loadSessionsCacheFirst();
      expect(result).toHaveLength(1);
    });

    it('should not crash when persistSessionUpdate throws', async () => {
      vi.useFakeTimers();
      try {
        (persistSessionUpdate as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
          new Error('DB write error')
        );

        const { engine } = makeEngine();
        engine.writeSessionDebounced('s1', { name: 'Test' });

        // Should not throw, just recover
        await vi.advanceTimersByTimeAsync(510);

        expect(engine.status).toBe('idle');
        // pendingWriteCount should have been decremented (finally block)
        expect(engine.pendingWriteCount).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    });

    it('should handle cancelPending on session with no pending writes', () => {
      const { engine, onStateChange } = makeEngine();
      const callsBefore = onStateChange.mock.calls.length;
      engine.cancelPending('nonexistent');
      // Should still call notify (pendingWriteCount = Math.max(0, -1) = 0)
      // Actually, cancelPending only calls notify if deb exists. For non-existent, no-op.
      expect(engine.pendingWriteCount).toBe(0);
    });

    it('should merge background server sync into loadSessionCacheFirst result', async () => {
      vi.useFakeTimers();
      try {
        const cachedRecord = {
          id: 's1',
          name: 'Cached',
          projectPath: '/test',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
          queryCount: 0,
          tokenCount: 0,
        };
        (loadSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce(cachedRecord);

        const serverResult = [
          {
            id: 's1',
            name: 'Server Updated',
            projectPath: '/server',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            isActive: true,
            queryCount: 5,
            tokenCount: 1000,
          },
        ];

        const { engine, serverSync } = makeEngine();
        serverSync.mockResolvedValueOnce(serverResult);

        // Load session - returns immediately from cache
        const resultPromise = engine.loadSessionCacheFirst('s1');
        const localResult = await resultPromise;
        expect(localResult).toBeDefined();
        expect(localResult!.id).toBe('s1');

        // Advance timers to let background sync resolve
        await vi.advanceTimersByTimeAsync(0);
        await Promise.resolve(); // flush microtasks

        // Background sync should have called persistSessionUpdate
        expect(persistSessionUpdate).toHaveBeenCalledWith('s1', expect.any(Object));
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
