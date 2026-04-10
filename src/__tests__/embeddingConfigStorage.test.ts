import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveConfig, getAllConfigs, getDefaultConfig,
  updateConfig, deleteConfig, setDefaultConfig,
} from '@/stores/embeddingConfigStorage';

describe('embeddingConfigStorage', () => {
  beforeEach(async () => {
    const { edb } = await import('@/stores/embeddingConfigStorage');
    await edb.configs.clear();
  });

  it('saveConfig 保存配置并返回完整对象', async () => {
    const config = await saveConfig({
      name: 'OpenAI', provider: 'openai',
      endpoint: 'https://api.openai.com/v1/embeddings',
      apiKey: 'sk-test123', model: 'text-embedding-3-small',
      dimension: 1536, isDefault: true,
    });
    expect(config.id).toMatch(/^ecfg_/);
    expect(config.name).toBe('OpenAI');
    expect(config.apiKey).toBe('sk-test123');
    expect(config.isDefault).toBe(true);
  });

  it('getAllConfigs 返回所有配置', async () => {
    await saveConfig({ name: 'A', provider: 'openai', endpoint: 'http://a', model: 'x', dimension: 1536, isDefault: false });
    await saveConfig({ name: 'B', provider: 'ollama', endpoint: 'http://b', model: 'y', dimension: 768, isDefault: false });
    const configs = await getAllConfigs();
    expect(configs).toHaveLength(2);
  });

  it('setDefaultConfig 只保留一个默认配置', async () => {
    const a = await saveConfig({ name: 'A', provider: 'openai', endpoint: 'http://a', model: 'x', dimension: 1536, isDefault: true });
    const b = await saveConfig({ name: 'B', provider: 'ollama', endpoint: 'http://b', model: 'y', dimension: 768, isDefault: false });
    await setDefaultConfig(b.id);
    const def = await getDefaultConfig();
    expect(def?.id).toBe(b.id);
    const configs = await getAllConfigs();
    const nonDefault = configs.find(c => c.id === a.id);
    expect(nonDefault?.isDefault).toBe(false);
  });

  it('updateConfig 更新字段', async () => {
    const original = await saveConfig({ name: 'Test', provider: 'openai', endpoint: 'http://test', model: 'x', dimension: 1536, isDefault: false });
    await updateConfig(original.id, { name: 'Updated', dimension: 512 });
    const updated = (await getAllConfigs()).find(c => c.id === original.id);
    expect(updated?.name).toBe('Updated');
    expect(updated?.dimension).toBe(512);
  });

  it('deleteConfig 删除配置', async () => {
    const config = await saveConfig({ name: 'Del', provider: 'openai', endpoint: 'http://x', model: 'x', dimension: 1536, isDefault: false });
    await deleteConfig(config.id);
    const all = await getAllConfigs();
    expect(all.find(c => c.id === config.id)).toBeUndefined();
  });
});
