import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAllPresets,
  getPresetByPath,
  getPresetById,
  getEnabledPresets,
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

  // ─────────────────────────────────────────────
  // 新增测试：getPresetById
  // ─────────────────────────────────────────────
  it('should get preset by id', async () => {
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

    const found = await getPresetById(saved.id);
    expect(found?.id).toBe(saved.id);
    expect(found?.workspacePath).toBe('/path/to/project');
  });

  it('should return undefined for non-existent preset id', async () => {
    const found = await getPresetById('non-existent-id');
    expect(found).toBeUndefined();
  });

  // ─────────────────────────────────────────────
  // 新增测试：getEnabledPresets
  // ─────────────────────────────────────────────
  it('should return only enabled presets', async () => {
    const config = await saveConfig({
      name: 'Test',
      model: 'sonnet',
      provider: 'anthropic',
      isDefault: false,
    });

    await savePreset({
      workspacePath: '/path/enabled',
      configId: config.id,
      isEnabled: true,
    });
    await savePreset({
      workspacePath: '/path/disabled',
      configId: config.id,
      isEnabled: false,
    });

    const enabled = await getEnabledPresets();
    expect(enabled).toHaveLength(1);
    expect(enabled[0].workspacePath).toBe('/path/enabled');
    expect(enabled[0].isEnabled).toBe(true);
  });

  it('should return empty array when no presets exist', async () => {
    const enabled = await getEnabledPresets();
    expect(enabled).toHaveLength(0);
  });

  // ─────────────────────────────────────────────
  // 新增测试：name 和 systemPrompt 字段
  // ─────────────────────────────────────────────
  it('should save and retrieve name field', async () => {
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
      name: '我的前端项目',
    });

    const found = await getPresetById(saved.id);
    expect(found?.name).toBe('我的前端项目');
  });

  it('should auto-generate name from path if not provided', async () => {
    const config = await saveConfig({
      name: 'Test',
      model: 'sonnet',
      provider: 'anthropic',
      isDefault: false,
    });

    const saved = await savePreset({
      workspacePath: '/path/to/my-project',
      configId: config.id,
      isEnabled: true,
    });

    const found = await getPresetById(saved.id);
    expect(found?.name).toBe('my-project');
  });

  it('should save and retrieve systemPrompt field', async () => {
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
      systemPrompt: '你是一个有帮助的助手',
    });

    const found = await getPresetById(saved.id);
    expect(found?.systemPrompt).toBe('你是一个有帮助的助手');
  });

  it('should update name and systemPrompt fields', async () => {
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

    await updatePreset(saved.id, {
      name: '新名称',
      systemPrompt: '新系统提示词',
    });

    const found = await getPresetById(saved.id);
    expect(found?.name).toBe('新名称');
    expect(found?.systemPrompt).toBe('新系统提示词');
  });
});
