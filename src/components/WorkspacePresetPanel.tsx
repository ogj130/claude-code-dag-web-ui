import { useState, useEffect } from 'react';
import type { WorkspacePreset, ModelConfig } from '@/types/models';

export function WorkspacePresetPanel() {
  const [presets, setPresets] = useState<WorkspacePreset[]>([]);
  const [configs, setConfigs] = useState<ModelConfig[]>([]);
  const [editingPreset, setEditingPreset] = useState<Partial<WorkspacePreset> | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [presets, configs] = await Promise.all([
      window.electron.invoke('workspace-preset:get-all') as Promise<WorkspacePreset[]>,
      window.electron.invoke('model-config:get-all') as Promise<ModelConfig[]>,
    ]);
    setPresets(presets);
    setConfigs(configs);
  }

  async function handleSave() {
    if (!editingPreset?.workspacePath || !editingPreset?.configId) {
      return;
    }

    if (editingPreset.id) {
      await window.electron.invoke('workspace-preset:update', editingPreset.id, editingPreset);
    } else {
      await window.electron.invoke('workspace-preset:save', editingPreset);
    }
    await loadData();
    setIsEditing(false);
    setEditingPreset(null);
  }

  async function handleDelete(id: string) {
    await window.electron.invoke('workspace-preset:delete', id);
    await loadData();
  }

  async function handleToggleEnabled(preset: WorkspacePreset) {
    await window.electron.invoke('workspace-preset:update', preset.id, { isEnabled: !preset.isEnabled });
    await loadData();
  }

  function getConfigName(configId: string | null): string {
    if (!configId) return '(配置已失效)';
    const config = configs.find(c => c.id === configId);
    return config ? `${config.name} (${config.model})` : '(配置已失效)';
  }

  function startEditing(preset?: WorkspacePreset) {
    setEditingPreset(preset || { isEnabled: true });
    setIsEditing(true);
  }

  return (
    <div style={{ padding: 16 }}>
      {/* 预设列表 */}
      <div style={{ marginBottom: 16 }}>
        {presets.map(preset => {
          const isInvalid = !preset.configId;
          return (
            <div
              key={preset.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px',
                marginBottom: 8,
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: 8,
                opacity: preset.isEnabled ? 1 : 0.6,
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{preset.workspacePath}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {getConfigName(preset.configId)}
                </div>
                {isInvalid && (
                  <span style={{
                    fontSize: 10,
                    padding: '2px 6px',
                    backgroundColor: '#f97316',
                    borderRadius: 4,
                    color: 'white',
                  }}>
                    已失效
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => handleToggleEnabled(preset)}
                  style={{ padding: '4px 8px', fontSize: 12 }}
                >
                  {preset.isEnabled ? '禁用' : '启用'}
                </button>
                <button
                  onClick={() => startEditing(preset)}
                  style={{ padding: '4px 8px', fontSize: 12 }}
                >
                  编辑
                </button>
                <button
                  onClick={() => handleDelete(preset.id)}
                  style={{ padding: '4px 8px', fontSize: 12, color: '#ef4444' }}
                >
                  删除
                </button>
              </div>
            </div>
          );
        })}
        {presets.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 24 }}>
            暂无预设，点击下方添加
          </div>
        )}
      </div>

      {/* 编辑表单 */}
      {isEditing && editingPreset && (
        <div style={{
          padding: 16,
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 8,
        }}>
          <h4 style={{ marginTop: 0 }}>
            {editingPreset.id ? '编辑预设' : '新建预设'}
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              placeholder="工作目录路径"
              value={editingPreset.workspacePath || ''}
              onChange={e => setEditingPreset({ ...editingPreset, workspacePath: e.target.value })}
              style={{ padding: 8 }}
            />
            <select
              value={editingPreset.configId || ''}
              onChange={e => setEditingPreset({ ...editingPreset, configId: e.target.value })}
              style={{ padding: 8 }}
            >
              <option value="">选择模型配置</option>
              {configs.map(config => (
                <option key={config.id} value={config.id}>
                  {config.name} ({config.model})
                </option>
              ))}
            </select>
            <textarea
              placeholder="备注 (可选)"
              value={editingPreset.description || ''}
              onChange={e => setEditingPreset({ ...editingPreset, description: e.target.value })}
              style={{ padding: 8, minHeight: 60 }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setIsEditing(false)}>取消</button>
              <button
                onClick={handleSave}
                disabled={!editingPreset.workspacePath || !editingPreset.configId}
                style={{ backgroundColor: 'var(--accent)', color: 'white' }}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {!isEditing && (
        <button
          onClick={() => startEditing()}
          style={{
            width: '100%',
            padding: 12,
            backgroundColor: 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          + 添加预设
        </button>
      )}
    </div>
  );
}
