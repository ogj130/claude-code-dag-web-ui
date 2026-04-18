import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSession, edb as sessionEdb } from '@/stores/sessionStorage';
import {
  bindSessionToWorkspace,
  getBindingBySessionId,
  getLatestSessionBindingByWorkspaceId,
  touchBinding,
  edb,
} from '@/stores/sessionWorkspaceBindingStorage';

describe('sessionWorkspaceBindingStorage', () => {
  beforeEach(async () => {
    await edb.bindings.clear();
    await sessionEdb.sessions.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('记录 session 归属 workspace 与来源', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-04-15T00:00:00.000Z').getTime());

    const session = await createSession({ title: 'A', workspacePath: '/tmp/project-a' });
    const binding = await bindSessionToWorkspace(session.id, 'workspace-a', 'manual');

    expect(session.workspacePath).toBe('/tmp/project-a');
    expect(binding.workspaceId).toBe('workspace-a');
    expect(binding.createdBy).toBe('manual');
    expect((await getBindingBySessionId(session.id))?.sessionId).toBe(session.id);
  });

  it('查询 workspace 最近活跃 session', async () => {
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy
      .mockReturnValueOnce(new Date('2026-04-15T00:00:00.000Z').getTime())
      .mockReturnValueOnce(new Date('2026-04-15T00:00:01.000Z').getTime())
      .mockReturnValueOnce(new Date('2026-04-15T00:00:02.000Z').getTime())
      .mockReturnValueOnce(new Date('2026-04-15T00:00:03.000Z').getTime());

    const first = await createSession({ title: 'First', workspacePath: '/tmp/project-a' });
    const second = await createSession({ title: 'Second', workspacePath: '/tmp/project-a' });

    await bindSessionToWorkspace(first.id, 'workspace-a', 'manual');
    await bindSessionToWorkspace(second.id, 'workspace-a', 'global-dispatch');
    await touchBinding(second.id);

    const latest = await getLatestSessionBindingByWorkspaceId('workspace-a');
    expect(latest?.sessionId).toBe(second.id);
  });
});
