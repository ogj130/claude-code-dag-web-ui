import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAllPresets,
  getPresetByPath,
  savePreset,
  updatePreset,
  deletePreset,
  getPresetsByConfigId,
  edb,
} from '@/stores/workspacePresetStorage';
import { saveConfig, edb as configEdb } from '@/stores/modelConfigStorage';

beforeEach(async () => {
  await edb.workspacePresets.clear();
  await configEdb.configs.clear();
});

describe('WorkspacePreset Storage', () => {
  it('should save and retrieve a preset', async () => {
    const config = await saveConfig({
      name: 'Test',
      model: 'sonnet',
      provider: 'anthropic',
      isDefault: false,
    });

    const preset = {
      workspacePath: '/path/to/project',
      configId: config.id,
      isEnabled: true,
    };

    const saved = await savePreset(preset);
    expect(saved.id).toMatch(/^wsp_/);

    const all = await getAllPresets();
    expect(all).toHaveLength(1);
  });

  it('should get preset by workspace path', async () => {
    const config = await saveConfig({
      name: 'Test',
      model: 'sonnet',
      provider: 'anthropic',
      isDefault: false,
    });

    await savePreset({
      workspacePath: '/path/to/project',
      configId: config.id,
      isEnabled: true,
    });

    const preset = await getPresetByPath('/path/to/project');
    expect(preset?.workspacePath).toBe('/path/to/project');
  });

  it('should get presets by config id', async () => {
    const config = await saveConfig({
      name: 'Test',
      model: 'sonnet',
      provider: 'anthropic',
      isDefault: false,
    });

    await savePreset({
      workspacePath: '/path/1',
      configId: config.id,
      isEnabled: true,
    });
    await savePreset({
      workspacePath: '/path/2',
      configId: config.id,
      isEnabled: true,
    });

    const presets = await getPresetsByConfigId(config.id);
    expect(presets).toHaveLength(2);
  });

  it('should update preset', async () => {
    const config = await saveConfig({
      name: 'Test',
      model: 'sonnet',
      provider: 'anthropic',
      isDefault: false,
    });

    const saved = await savePreset({
      workspacePath: '/path/to/project',
      configId: config.id,
      isEnabled: true,
    });

    await updatePreset(saved.id, { isEnabled: false });
    const preset = await getPresetByPath('/path/to/project');
    expect(preset?.isEnabled).toBe(false);
  });
});
