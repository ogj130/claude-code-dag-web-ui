import Dexie, { type Table } from 'dexie';
import { encryptField, decryptField } from '@/utils/encryption';
import type { ModelConfig } from '@/types/models';

const DB_NAME = 'cc-web-model';

export type { ModelConfig };

interface StoredConfig extends Omit<ModelConfig, 'apiKey' | 'isDefault'> {
  encryptedApiKey?: string;
  /** 0 = false, 1 = true (IndexedDB indexes require scalar keys) */
  isDefault: number;
}

class ModelConfigDB extends Dexie {
  configs!: Table<StoredConfig, string>;
  constructor() {
    super(DB_NAME);
    this.version(1).stores({
      configs: 'id, name, isDefault, updatedAt',
    });
  }
}

const edb = new ModelConfigDB();

function generateId(): string {
  return `mcfg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function toPublic(s: StoredConfig): ModelConfig {
  return {
    ...s,
    isDefault: s.isDefault === 1,
    apiKey: s.encryptedApiKey ? decryptField(s.encryptedApiKey) : undefined,
  };
}

export async function getAllConfigs(): Promise<ModelConfig[]> {
  const stored = await edb.configs.orderBy('updatedAt').reverse().toArray();
  return stored.map(toPublic);
}

export async function getDefaultConfig(): Promise<ModelConfig | undefined> {
  const stored = await edb.configs.where('isDefault').equals(1).first();
  return stored ? toPublic(stored) : undefined;
}

export async function saveConfig(
  config: Omit<ModelConfig, 'id' | 'createdAt' | 'updatedAt'>
): Promise<ModelConfig> {
  const now = Date.now();
  const id = generateId();
  const stored: StoredConfig = {
    id,
    name: config.name,
    model: config.model,
    provider: config.provider,
    baseUrl: config.baseUrl,
    encryptedApiKey: config.apiKey ? encryptField(config.apiKey) : undefined,
    isDefault: config.isDefault ? 1 : 0,
    priority: config.priority,
    description: config.description,
    createdAt: now,
    updatedAt: now,
  };

  await edb.transaction('rw', edb.configs, async () => {
    if (stored.isDefault === 1) {
      await edb.configs.where('isDefault').equals(1).modify({ isDefault: 0 });
    }
    await edb.configs.add(stored);
  });

  return toPublic(stored);
}

export async function updateConfig(
  id: string,
  updates: Partial<Omit<ModelConfig, 'id' | 'createdAt'>>
): Promise<void> {
  const storedUpdate: Partial<StoredConfig> = { updatedAt: Date.now() };
  if (updates.name !== undefined) storedUpdate.name = updates.name;
  if (updates.model !== undefined) storedUpdate.model = updates.model;
  if (updates.provider !== undefined) storedUpdate.provider = updates.provider;
  if (updates.baseUrl !== undefined) storedUpdate.baseUrl = updates.baseUrl;
  if (updates.apiKey !== undefined) {
    storedUpdate.encryptedApiKey = updates.apiKey ? encryptField(updates.apiKey) : undefined;
  }
  if (updates.isDefault !== undefined) {
    if (updates.isDefault) {
      await edb.configs.where('isDefault').equals(1).modify({ isDefault: 0 });
    }
    storedUpdate.isDefault = updates.isDefault ? 1 : 0;
  }
  if (updates.priority !== undefined) storedUpdate.priority = updates.priority;
  if (updates.description !== undefined) storedUpdate.description = updates.description;
  await edb.configs.update(id, storedUpdate);
}

export async function deleteConfig(id: string): Promise<void> {
  await edb.configs.delete(id);
}

export async function setDefaultConfig(id: string): Promise<void> {
  await edb.transaction('rw', edb.configs, async () => {
    await edb.configs.where('isDefault').equals(1).modify({ isDefault: 0 });
    await edb.configs.update(id, { isDefault: 1, updatedAt: Date.now() });
  });
}

/** 仅供测试使用 */
export { edb };
