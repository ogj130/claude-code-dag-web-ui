import Dexie, { type Table } from 'dexie';
import { encryptField, decryptField } from '@/utils/encryption';

export type EmbeddingProvider = 'openai' | 'ollama' | 'cohere' | 'local';

export interface EmbeddingConfig {
  id: string;
  name: string;
  provider: EmbeddingProvider;
  endpoint: string;
  apiKey?: string;
  model: string;
  dimension: number;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
  lastTestedAt?: number;
  lastTestLatency?: number;
  lastTestDimension?: number;
}

interface StoredConfig {
  id: string;
  name: string;
  provider: EmbeddingProvider;
  endpoint: string;
  encryptedApiKey?: string;
  model: string;
  dimension: number;
  /** 0 = false, 1 = true (IndexedDB indexes require scalar keys) */
  isDefault: number;
  createdAt: number;
  updatedAt: number;
  lastTestedAt?: number;
  lastTestLatency?: number;
  lastTestDimension?: number;
}

class EmbeddingDB extends Dexie {
  configs!: Table<StoredConfig, string>;
  constructor() {
    super('cc-web-embedding');
    this.version(1).stores({
      configs: 'id, name, provider, isDefault, updatedAt',
    });
  }
}

const edb = new EmbeddingDB();

function generateId(): string {
  return `ecfg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function toPublic(s: StoredConfig): EmbeddingConfig {
  return {
    id: s.id, name: s.name, provider: s.provider, endpoint: s.endpoint,
    apiKey: s.encryptedApiKey ? decryptField(s.encryptedApiKey) : undefined,
    model: s.model, dimension: s.dimension, isDefault: s.isDefault === 1,
    createdAt: s.createdAt, updatedAt: s.updatedAt,
    lastTestedAt: s.lastTestedAt, lastTestLatency: s.lastTestLatency,
    lastTestDimension: s.lastTestDimension,
  };
}

export async function getAllConfigs(): Promise<EmbeddingConfig[]> {
  const stored = await edb.configs.orderBy('updatedAt').reverse().toArray();
  return stored.map(toPublic);
}

export async function getDefaultConfig(): Promise<EmbeddingConfig | undefined> {
  const stored = await edb.configs.where('isDefault').equals(1).first();
  if (!stored) return undefined;
  return toPublic(stored);
}

export async function saveConfig(config: Omit<EmbeddingConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<EmbeddingConfig> {
  const now = Date.now();
  const id = generateId();
  const stored: StoredConfig = {
    id, name: config.name, provider: config.provider, endpoint: config.endpoint,
    encryptedApiKey: config.apiKey ? encryptField(config.apiKey) : undefined,
    model: config.model, dimension: config.dimension,
    isDefault: config.isDefault ? 1 : 0, createdAt: now, updatedAt: now,
    lastTestedAt: config.lastTestedAt, lastTestLatency: config.lastTestLatency,
    lastTestDimension: config.lastTestDimension,
  };

  await edb.transaction('rw', edb.configs, async () => {
    if (stored.isDefault === 1) {
      await edb.configs.where('isDefault').equals(1).modify({ isDefault: 0 });
    }
    await edb.configs.add(stored);
  });

  return toPublic(stored);
}

export async function updateConfig(id: string, updates: Partial<Omit<EmbeddingConfig, 'id' | 'createdAt'>>): Promise<void> {
  const storedUpdate: Partial<StoredConfig> = { updatedAt: Date.now() };
  if (updates.name !== undefined) storedUpdate.name = updates.name;
  if (updates.provider !== undefined) storedUpdate.provider = updates.provider;
  if (updates.endpoint !== undefined) storedUpdate.endpoint = updates.endpoint;
  if (updates.apiKey !== undefined) storedUpdate.encryptedApiKey = updates.apiKey ? encryptField(updates.apiKey) : undefined;
  if (updates.model !== undefined) storedUpdate.model = updates.model;
  if (updates.dimension !== undefined) storedUpdate.dimension = updates.dimension;
  if (updates.isDefault !== undefined) {
    if (updates.isDefault) await edb.configs.where('isDefault').equals(1).modify({ isDefault: 0 });
    storedUpdate.isDefault = updates.isDefault ? 1 : 0;
  }
  if (updates.lastTestedAt !== undefined) storedUpdate.lastTestedAt = updates.lastTestedAt;
  if (updates.lastTestLatency !== undefined) storedUpdate.lastTestLatency = updates.lastTestLatency;
  if (updates.lastTestDimension !== undefined) storedUpdate.lastTestDimension = updates.lastTestDimension;
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
