import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWorkspace, edb as workspaceEdb } from '@/stores/workspaceStorage';
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
    await workspaceEdb.workspaces.clear();
    await modelConfigEdb.configs.clear();
    vi.restoreAllMocks();
  });

  it('为工作区创建手动会话并写入绑定', async () => {
    await saveConfig({
      name: 'Claude Sonnet',
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      isDefault: true,
    });
    const workspace = await createWorkspace({
      name: 'Workspace A',
      workspacePath: '/tmp/project-a',
      modelConfigId: 'mcfg_manual',
      enabled: true,
    });

    const session = await createManualSessionForWorkspace({
      workspaceId: workspace.id,
      title: 'Manual Session',
    });

    expect(session.workspaceId).toBe(workspace.id);
    expect(session.createdBy).toBe('manual');
    expect(session.session.workspacePath).toBe('/tmp/project-a');
    expect(session.modelConfigId).toBe('mcfg_manual');
    expect((await getBindingBySessionId(session.session.id))?.workspaceId).toBe(workspace.id);
  });

  it('复用工作区最近会话并刷新活跃时间', async () => {
    await saveConfig({
      name: 'Claude Sonnet',
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      isDefault: true,
    });
    const workspace = await createWorkspace({
      name: 'Workspace A',
      workspacePath: '/tmp/project-a',
      modelConfigId: 'mcfg_reuse',
      enabled: true,
    });

    const first = await createSession({ title: 'Existing', workspacePath: '/tmp/project-a' });
    await bindSessionToWorkspace(first.id, workspace.id, 'manual');

    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-04-15T00:00:03.000Z').getTime());
    const reused = await getOrCreateSessionForWorkspace({
      workspaceId: workspace.id,
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
    await saveConfig({
      name: 'Claude Sonnet',
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      isDefault: true,
    });
    const workspace = await createWorkspace({
      name: 'Workspace B',
      workspacePath: '/tmp/project-b',
      modelConfigId: 'mcfg_auto',
      enabled: true,
    });

    const created = await getOrCreateSessionForWorkspace({
      workspaceId: workspace.id,
      title: 'Auto Created',
      createdBy: 'global-dispatch',
    });

    expect(created.reused).toBe(false);
    expect(created.createdBy).toBe('global-dispatch');
    expect(created.session.workspacePath).toBe('/tmp/project-b');
    expect((await getBindingBySessionId(created.session.id))?.createdBy).toBe('global-dispatch');
  });

  it('工作区不存在时抛错', async () => {
    await expect(createManualSessionForWorkspace({ workspaceId: 'missing', title: 'Nope' })).rejects.toThrow(
      'Workspace not found: missing',
    );
  });
});
