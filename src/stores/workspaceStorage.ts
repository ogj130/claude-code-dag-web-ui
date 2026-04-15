import Dexie, { type Table } from 'dexie';
import type { CreateWorkspaceInput, Workspace } from '@/types/workspace';

interface StoredWorkspace {
  id: string;
  name: string;
  workspacePath: string;
  modelConfigId: string;
  systemPrompt?: string;
  /** 0 = false, 1 = true (IndexedDB indexes require scalar keys) */
  enabled: 0 | 1;
  createdAt: number;
  updatedAt: number;
}

export interface UpdateWorkspaceInput {
  name?: string;
  workspacePath?: string;
  modelConfigId?: string;
  systemPrompt?: string;
  enabled?: boolean;
}

class WorkspaceDB extends Dexie {
  workspaces!: Table<StoredWorkspace, string>;

  constructor() {
    super('cc-web-workspaces');

    this.version(1).stores({
      workspaces: 'id, name, modelConfigId, enabled, updatedAt',
    });
  }
}

const edb = new WorkspaceDB();

function generateId(): string {
  return `workspace_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function toPublic(workspace: StoredWorkspace): Workspace {
  return {
    id: workspace.id,
    name: workspace.name,
    workspacePath: workspace.workspacePath,
    modelConfigId: workspace.modelConfigId,
    systemPrompt: workspace.systemPrompt,
    enabled: workspace.enabled === 1,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
  };
}

export async function createWorkspace(input: CreateWorkspaceInput): Promise<Workspace> {
  const now = Date.now();
  const stored: StoredWorkspace = {
    id: generateId(),
    name: input.name,
    workspacePath: input.workspacePath,
    modelConfigId: input.modelConfigId,
    systemPrompt: input.systemPrompt,
    enabled: input.enabled === false ? 0 : 1,
    createdAt: now,
    updatedAt: now,
  };

  await edb.workspaces.add(stored);
  return toPublic(stored);
}

export async function getAllWorkspaces(): Promise<Workspace[]> {
  const workspaces = await edb.workspaces.orderBy('updatedAt').reverse().toArray();
  return workspaces.map(toPublic);
}

export async function getEnabledWorkspaces(): Promise<Workspace[]> {
  const workspaces = await edb.workspaces.where('enabled').equals(1).toArray();
  return workspaces.map(toPublic);
}

export async function getWorkspaceById(id: string): Promise<Workspace | undefined> {
  const workspace = await edb.workspaces.get(id);
  return workspace ? toPublic(workspace) : undefined;
}

export async function updateWorkspace(id: string, updates: UpdateWorkspaceInput): Promise<Workspace | undefined> {
  const storedUpdates: Partial<StoredWorkspace> = {
    updatedAt: Date.now(),
  };

  if (updates.name !== undefined) storedUpdates.name = updates.name;
  if (updates.workspacePath !== undefined) storedUpdates.workspacePath = updates.workspacePath;
  if (updates.modelConfigId !== undefined) storedUpdates.modelConfigId = updates.modelConfigId;
  if (updates.systemPrompt !== undefined) storedUpdates.systemPrompt = updates.systemPrompt;
  if (updates.enabled !== undefined) storedUpdates.enabled = updates.enabled ? 1 : 0;

  await edb.workspaces.update(id, storedUpdates);
  return getWorkspaceById(id);
}

export async function deleteWorkspace(id: string): Promise<void> {
  await edb.workspaces.delete(id);
}

export { edb };
