import fakeIndexedDB, { IDBKeyRange } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.stubGlobal('indexedDB', fakeIndexedDB);
vi.stubGlobal('IDBKeyRange', IDBKeyRange);

const loadWorkspaceStorage = () => import('@/stores/workspaceStorage');

describe('workspaceStorage', () => {
  beforeEach(async () => {
    const { edb } = await loadWorkspaceStorage();
    await edb.workspaces.clear();
  });

  it('createWorkspace 保留 workspacePath 与 modelConfigId', async () => {
    const { createWorkspace, getWorkspaceById } = await loadWorkspaceStorage();
    const workspace = await createWorkspace({
      name: 'Workspace A',
      workspacePath: '/tmp/project-a',
      modelConfigId: 'model_123',
      enabled: true,
    });

    expect(workspace.workspacePath).toBe('/tmp/project-a');
    expect(workspace.modelConfigId).toBe('model_123');
    expect((await getWorkspaceById(workspace.id))?.workspacePath).toBe('/tmp/project-a');
    expect((await getWorkspaceById(workspace.id))?.modelConfigId).toBe('model_123');
  });

  it('getEnabledWorkspaces 只返回 enabled 工作区', async () => {
    const { createWorkspace, getEnabledWorkspaces } = await loadWorkspaceStorage();
    await createWorkspace({ name: 'Enabled', workspacePath: '/tmp/enabled', modelConfigId: 'model_a', enabled: true });
    await createWorkspace({ name: 'Disabled', workspacePath: '/tmp/disabled', modelConfigId: 'model_b', enabled: false });

    const enabled = await getEnabledWorkspaces();

    expect(enabled).toHaveLength(1);
    expect(enabled[0].enabled).toBe(true);
    expect(enabled[0].name).toBe('Enabled');
  });

  it('updateWorkspace 可更新 model 绑定', async () => {
    const { createWorkspace, getWorkspaceById, updateWorkspace } = await loadWorkspaceStorage();
    const workspace = await createWorkspace({
      name: 'Workspace',
      workspacePath: '/tmp/project-a',
      modelConfigId: 'model_a',
      enabled: true,
    });

    await updateWorkspace(workspace.id, { workspacePath: '/tmp/project-b', modelConfigId: 'model_b' });

    expect((await getWorkspaceById(workspace.id))?.workspacePath).toBe('/tmp/project-b');
    expect((await getWorkspaceById(workspace.id))?.modelConfigId).toBe('model_b');
  });

  it('deleteWorkspace 后列表为空', async () => {
    const { createWorkspace, deleteWorkspace, getAllWorkspaces, getWorkspaceById } = await loadWorkspaceStorage();
    const workspace = await createWorkspace({
      name: 'Workspace',
      workspacePath: '/tmp/project-a',
      modelConfigId: 'model_a',
      enabled: true,
    });

    await deleteWorkspace(workspace.id);

    expect(await getAllWorkspaces()).toEqual([]);
    expect(await getWorkspaceById(workspace.id)).toBeUndefined();
  });
});
