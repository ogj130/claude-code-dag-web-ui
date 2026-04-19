import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveConfig, edb as modelConfigEdb } from '@/stores/modelConfigStorage';
import { createSession, edb as sessionEdb } from '@/stores/sessionStorage';
import {
  bindSessionToWorkspace,
  getBindingBySessionId,
  edb as bindingEdb,
} from '@/stores/sessionWorkspaceBindingStorage';
import {
  createManualSessionForWorkspace,
  getOrCreateSessionForWorkspace,
} from '@/services/sessionService';

describe('sessionService', () => {
  beforeEach(async () => {
    await bindingEdb.bindings.clear();
    await sessionEdb.sessions.clear();
    await modelConfigEdb.configs.clear();
    vi.restoreAllMocks();
  });

  it('为工作区创建手动会话并写入绑定', async () => {
    const session = await createManualSessionForWorkspace({
      workspaceId: 'ws_manual_1',
      workspacePath: '/tmp/project-a',
      title: 'Manual Session',
    });

    expect(session.workspaceId).toBe('ws_manual_1');
    expect(session.createdBy).toBe('manual');
    expect(session.session.workspacePath).toBe('/tmp/project-a');
    expect((await getBindingBySessionId(session.session.id))?.workspaceId).toBe('ws_manual_1');
  });

  it('复用工作区最近会话并刷新活跃时间', async () => {
    const first = await createSession({ title: 'Existing', workspacePath: '/tmp/project-a' });
    await bindSessionToWorkspace(first.id, 'ws_reuse_1', 'manual');

    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-04-15T00:00:03.000Z').getTime());
    const reused = await getOrCreateSessionForWorkspace({
      workspaceId: 'ws_reuse_1',
      workspacePath: '/tmp/project-a',
      title: 'Ignored',
      createdBy: 'global-dispatch',
    });

    expect(reused.reused).toBe(true);
    expect(reused.createdBy).toBe('manual');
    expect(reused.session.id).toBe(first.id);
    expect((await getBindingBySessionId(first.id))?.lastActiveAt).toBe(Date.now());
    nowSpy.mockRestore();
  });

  it('无历史会话时自动创建新会话', async () => {
    const created = await getOrCreateSessionForWorkspace({
      workspaceId: 'ws_auto_1',
      workspacePath: '/tmp/project-b',
      title: 'Auto Created',
      createdBy: 'global-dispatch',
    });

    expect(created.reused).toBe(false);
    expect(created.createdBy).toBe('global-dispatch');
    expect(created.session.workspacePath).toBe('/tmp/project-b');
    expect((await getBindingBySessionId(created.session.id))?.createdBy).toBe('global-dispatch');
  });
});
