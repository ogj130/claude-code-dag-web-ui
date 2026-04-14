import Dexie, { type Table } from 'dexie';
import type { WorkspacePreset } from '@/types/models';

const DB_NAME = 'cc-web-model';

export type { WorkspacePreset };

class WorkspacePresetDB extends Dexie {
  workspacePresets!: Table<WorkspacePreset, string>;
  constructor() {
    super(DB_NAME);
    this.version(1).stores({
      workspacePresets: 'id, workspacePath, configId, isEnabled, updatedAt',
    });
  }
}

const edb = new WorkspacePresetDB();

function generateId(): string {
  return `wsp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export async function getAllPresets(): Promise<WorkspacePreset[]> {
  return edb.workspacePresets.orderBy('updatedAt').reverse().toArray();
}

export async function getPresetByPath(workspacePath: string): Promise<WorkspacePreset | undefined> {
  return edb.workspacePresets.where('workspacePath').equals(workspacePath).first();
}

export async function getPresetsByConfigId(configId: string): Promise<WorkspacePreset[]> {
  return edb.workspacePresets.where('configId').equals(configId).toArray();
}

export async function savePreset(
  preset: Omit<WorkspacePreset, 'id' | 'createdAt' | 'updatedAt'>
): Promise<WorkspacePreset> {
  const now = Date.now();
  const id = generateId();
  const stored: WorkspacePreset = {
    id,
    workspacePath: preset.workspacePath,
    configId: preset.configId,
    isEnabled: preset.isEnabled,
    description: preset.description,
    createdAt: now,
    updatedAt: now,
  };

  // 如果已存在同路径的预设，更新而非创建
  const existing = await getPresetByPath(preset.workspacePath);
  if (existing) {
    await edb.workspacePresets.update(existing.id, { ...stored, id: existing.id, createdAt: existing.createdAt });
    return { ...stored, id: existing.id, createdAt: existing.createdAt };
  }

  await edb.workspacePresets.add(stored);
  return stored;
}

export async function updatePreset(
  id: string,
  updates: Partial<Omit<WorkspacePreset, 'id' | 'createdAt'>>
): Promise<void> {
  const storedUpdate: Partial<WorkspacePreset> = { updatedAt: Date.now() };
  if (updates.workspacePath !== undefined) storedUpdate.workspacePath = updates.workspacePath;
  if (updates.configId !== undefined) storedUpdate.configId = updates.configId;
  if (updates.isEnabled !== undefined) storedUpdate.isEnabled = updates.isEnabled;
  if (updates.description !== undefined) storedUpdate.description = updates.description;
  await edb.workspacePresets.update(id, storedUpdate);
}

export async function deletePreset(id: string): Promise<void> {
  await edb.workspacePresets.delete(id);
}

export async function invalidatePresetByConfigId(configId: string): Promise<void> {
  await edb.workspacePresets.where('configId').equals(configId).modify({
    configId: null,
    updatedAt: Date.now(),
  });
}

export { edb };
