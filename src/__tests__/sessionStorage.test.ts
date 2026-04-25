import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { edb } from '@/stores/sessionStorage';
import {
  createSession,
  getSession,
  updateSession,
  deleteSession,
  getSessionList,
  getRecentSessions,
  getSessionStats,
  getAllSessions,
} from '@/stores/sessionStorage';

describe('sessionStorage', () => {
  beforeEach(async () => {
    await edb.sessions.clear();
    // Clear localStorage privacy mode state between tests
    localStorage.removeItem('cc_privacy_mode');
  });

  afterEach(async () => {
    await edb.sessions.clear();
  });

  // ---------------------------------------------------------------------------
  // createSession
  // ---------------------------------------------------------------------------

  describe('createSession', () => {
    it('creates a session with generated id and default fields', async () => {
      const session = await createSession({ title: 'Test Session' });

      expect(session.id).toMatch(/^session_/);
      expect(session.title).toBe('Test Session');
      expect(session.status).toBe('active');
      expect(session.queryCount).toBe(0);
      expect(session.tokenUsage).toBe(0);
      expect(session.tags).toEqual([]);
      expect(session.summary).toBe('');
    });

    it('creates a session with workspacePath', async () => {
      const session = await createSession({ title: 'WS Session', workspacePath: '/my/project' });

      expect(session.workspacePath).toBe('/my/project');
    });

    it('creates a session with tags', async () => {
      const session = await createSession({ title: 'Tagged', tags: ['vip', 'urgent'] });

      expect(session.tags).toEqual(['vip', 'urgent']);
    });
  });

  // ---------------------------------------------------------------------------
  // getSession
  // ---------------------------------------------------------------------------

  describe('getSession', () => {
    it('returns the session by id', async () => {
      const created = await createSession({ title: 'Find Me' });
      const found = await getSession(created.id);

      expect(found?.title).toBe('Find Me');
    });

    it('returns undefined for non-existent id', async () => {
      const result = await getSession('does-not-exist');
      expect(result).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // updateSession
  // ---------------------------------------------------------------------------

  describe('updateSession', () => {
    it('updates title', async () => {
      const created = await createSession({ title: 'Original' });
      await updateSession(created.id, { title: 'Updated' });

      const found = await getSession(created.id);
      expect(found?.title).toBe('Updated');
    });

    it('increments tokenUsage via tokenUsageIncrement', async () => {
      const created = await createSession({ title: 'Token Test' });
      await updateSession(created.id, { tokenUsageIncrement: 100 });
      await updateSession(created.id, { tokenUsageIncrement: 50 });

      const found = await getSession(created.id);
      expect(found?.tokenUsage).toBe(150);
    });

    it('increments queryCount via queryCountIncrement', async () => {
      const created = await createSession({ title: 'Query Test' });
      await updateSession(created.id, { queryCountIncrement: 1 });
      await updateSession(created.id, { queryCountIncrement: 1 });

      const found = await getSession(created.id);
      expect(found?.queryCount).toBe(2);
    });

    it('updates tags', async () => {
      const created = await createSession({ title: 'Tag Test', tags: ['old'] });
      await updateSession(created.id, { tags: ['new', 'updated'] });

      const found = await getSession(created.id);
      expect(found?.tags).toEqual(['new', 'updated']);
    });
  });

  // ---------------------------------------------------------------------------
  // deleteSession (soft delete)
  // ---------------------------------------------------------------------------

  describe('deleteSession', () => {
    it('marks session as deleted (soft delete)', async () => {
      const created = await createSession({ title: 'To Delete' });
      await deleteSession(created.id);

      const found = await getSession(created.id);
      expect(found?.status).toBe('deleted');
    });
  });

  // ---------------------------------------------------------------------------
  // getSessionList
  // ---------------------------------------------------------------------------

  describe('getSessionList', () => {
    it('returns paginated sessions', async () => {
      for (let i = 0; i < 5; i++) {
        await createSession({ title: `Session ${i}` });
      }

      const result = await getSessionList({ page: 1, pageSize: 3 });

      expect(result.items.length).toBe(3);
      expect(result.total).toBe(5);
      expect(result.totalPages).toBe(2);
      expect(result.hasMore).toBe(true);
    });

    it('excludes deleted sessions by default', async () => {
      const s1 = await createSession({ title: 'Active' });
      await createSession({ title: 'Deleted' });
      await deleteSession(s1.id);

      const result = await getSessionList({ page: 1, pageSize: 10 });
      expect(result.items.every(s => s.status !== 'deleted')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // getRecentSessions
  // ---------------------------------------------------------------------------

  describe('getRecentSessions', () => {
    it('returns up to limit sessions', async () => {
      for (let i = 0; i < 10; i++) {
        await createSession({ title: `Recent ${i}` });
      }

      const result = await getRecentSessions(5);
      expect(result.length).toBe(5);
    });

    it('only returns active sessions', async () => {
      const active = await createSession({ title: 'Active' });
      await createSession({ title: 'Deleted' });
      await deleteSession(active.id);

      const result = await getRecentSessions(10);
      expect(result.every(s => s.status === 'active')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // getSessionStats
  // ---------------------------------------------------------------------------

  describe('getSessionStats', () => {
    it('returns correct counts', async () => {
      await createSession({ title: 'Active 1' });
      await createSession({ title: 'Active 2' });
      const deleted = await createSession({ title: 'Deleted' });
      await deleteSession(deleted.id);

      const stats = await getSessionStats();

      expect(stats.total).toBe(3);
      expect(stats.active).toBe(2);
      expect(stats.deleted).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // getAllSessions
  // ---------------------------------------------------------------------------

  describe('getAllSessions', () => {
    it('returns all sessions including deleted', async () => {
      const active = await createSession({ title: 'Active' });
      await createSession({ title: 'Deleted' });
      await deleteSession(active.id);

      const all = await getAllSessions();
      expect(all.length).toBe(2);
    });
  });
});
