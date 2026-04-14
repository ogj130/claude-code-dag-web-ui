import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveConfig, getAllConfigs, getDefaultConfig,
  updateConfig, deleteConfig, setDefaultConfig,
} from '@/stores/modelConfigStorage';

describe('modelConfigStorage', () => {
  beforeEach(async () => {
    const { edb } = await import('@/stores/modelConfigStorage');
    await edb.configs.clear();
  });

  it('saveConfig 保存配置并返回完整对象', async () => {
    const config = await saveConfig({
      name: 'Claude Sonnet', provider: 'anthropic',
      model: 'claude-sonnet-4-6', isDefault: true,
    });
    expect(config.id).toMatch(/^mcfg_/);
    expect(config.name).toBe('Claude Sonnet');
    expect(config.isDefault).toBe(true);
  });

  it('getAllConfigs 返回所有配置', async () => {
    await saveConfig({ name: 'A', provider: 'anthropic', model: 'sonnet', isDefault: false });
    await saveConfig({ name: 'B', provider: 'openai-compatible', model: 'gpt-4', baseUrl: 'https://api.openai.com', isDefault: false });
    const configs = await getAllConfigs();
    expect(configs).toHaveLength(2);
  });

  it('setDefaultConfig 只保留一个默认配置', async () => {
    const a = await saveConfig({ name: 'A', provider: 'anthropic', model: 'sonnet', isDefault: true });
    const b = await saveConfig({ name: 'B', provider: 'anthropic', model: 'opus', isDefault: false });
    await setDefaultConfig(b.id);
    const def = await getDefaultConfig();
    expect(def?.id).toBe(b.id);
    const configs = await getAllConfigs();
    const nonDefault = configs.find(c => c.id === a.id);
    expect(nonDefault?.isDefault).toBe(false);
  });

  it('updateConfig 更新字段', async () => {
    const original = await saveConfig({ name: 'Test', provider: 'anthropic', model: 'sonnet', isDefault: false });
    await updateConfig(original.id, { name: 'Updated', priority: 10 });
    const updated = (await getAllConfigs()).find(c => c.id === original.id);
    expect(updated?.name).toBe('Updated');
    expect(updated?.priority).toBe(10);
  });

  it('deleteConfig 删除配置', async () => {
    const config = await saveConfig({ name: 'Del', provider: 'anthropic', model: 'sonnet', isDefault: false });
    await deleteConfig(config.id);
    const all = await getAllConfigs();
    expect(all.find(c => c.id === config.id)).toBeUndefined();
  });
});
