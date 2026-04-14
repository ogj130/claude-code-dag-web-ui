import { useState, useEffect } from 'react';
import type { ModelConfig, ModelProvider } from '@/types/models';

const PROVIDER_OPTIONS: { value: ModelProvider; label: string }[] = [
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai-compatible', label: 'OpenAI 兼容' },
];

const ANTHROPIC_MODELS = [
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { value: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
  { value: 'claude-haiku-4-6', label: 'Claude Haiku 4.6' },
];

export function ModelConfigPanel() {
  const [configs, setConfigs] = useState<ModelConfig[]>([]);
  const [editingConfig, setEditingConfig] = useState<Partial<ModelConfig> | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    loadConfigs();
  }, []);

  async function loadConfigs() {
    const configs = await window.electron.invoke('model-config:get-all') as ModelConfig[];
    setConfigs(configs);
  }

  async function handleSave() {
    if (!editingConfig?.name || !editingConfig?.model || !editingConfig?.provider) {
      return;
    }

    if (editingConfig.id) {
      await window.electron.invoke('model-config:update', editingConfig.id, editingConfig);
    } else {
      await window.electron.invoke('model-config:save', editingConfig);
    }
    await loadConfigs();
    setIsEditing(false);
    setEditingConfig(null);
  }

  async function handleDelete(id: string) {
    // 先检查引用
    const presets = await window.electron.invoke('workspace-preset:get-all') as { configId: string }[];
    const usedBy = presets.filter(p => p.configId === id);

    if (usedBy.length > 0) {
      setShowDeleteConfirm(id);
      return;
    }

    await window.electron.invoke('model-config:delete', id);
    await loadConfigs();
  }

  async function confirmDelete(id: string) {
    await window.electron.invoke('model-config:delete', id);
    await loadConfigs();
    setShowDeleteConfirm(null);
  }

  async function handleSetDefault(id: string) {
    await window.electron.invoke('model-config:set-default', id);
    await loadConfigs();
  }

  function startEditing(config?: ModelConfig) {
    setEditingConfig(config || { provider: 'anthropic', isDefault: false });
    setIsEditing(true);
  }

  return (
    <div style={{ padding: 16 }}>
      {/* 配置列表 */}
      <div style={{ marginBottom: 16 }}>
        {configs.map(config => (
          <div
            key={config.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px',
              marginBottom: 8,
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: 8,
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>{config.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {config.model} · {config.provider}
              </div>
              {config.isDefault && (
                <span style={{
                  fontSize: 10,
                  padding: '2px 6px',
                  backgroundColor: 'var(--accent)',
                  borderRadius: 4,
                  color: 'white',
                }}>
                  默认
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => handleSetDefault(config.id)}
                disabled={config.isDefault}
                style={{
                  padding: '4px 8px',
                  fontSize: 12,
                  opacity: config.isDefault ? 0.5 : 1,
                }}
              >
                设为默认
              </button>
              <button
                onClick={() => startEditing(config)}
                style={{ padding: '4px 8px', fontSize: 12 }}
              >
                编辑
              </button>
              <button
                onClick={() => handleDelete(config.id)}
                style={{ padding: '4px 8px', fontSize: 12, color: '#ef4444' }}
              >
                删除
              </button>
            </div>
          </div>
        ))}
        {configs.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 24 }}>
            暂无配置，点击下方添加
          </div>
        )}
      </div>

      {/* 删除确认弹窗 */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: 'var(--bg-primary)',
            padding: 24,
            borderRadius: 12,
            maxWidth: 400,
          }}>
            <h3 style={{ marginTop: 0 }}>确认删除</h3>
            <p>此配置被工作目录预设引用，删除后相关预设将失效。</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDeleteConfirm(null)}>取消</button>
              <button
                onClick={() => confirmDelete(showDeleteConfirm)}
                style={{ backgroundColor: '#ef4444', color: 'white' }}
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑表单 */}
      {isEditing && editingConfig && (
        <div style={{
          padding: 16,
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 8,
        }}>
          <h4 style={{ marginTop: 0 }}>
            {editingConfig.id ? '编辑配置' : '新建配置'}
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              placeholder="配置名称"
              value={editingConfig.name || ''}
              onChange={e => setEditingConfig({ ...editingConfig, name: e.target.value })}
              style={{ padding: 8 }}
            />
            <select
              value={editingConfig.provider || 'anthropic'}
              onChange={e => setEditingConfig({ ...editingConfig, provider: e.target.value as ModelProvider })}
              style={{ padding: 8 }}
            >
              {PROVIDER_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <select
              value={editingConfig.model || ''}
              onChange={e => setEditingConfig({ ...editingConfig, model: e.target.value })}
              style={{ padding: 8 }}
            >
              <option value="">选择模型</option>
              {editingConfig.provider === 'anthropic' && ANTHROPIC_MODELS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
              <option value="custom">自定义...</option>
            </select>
            {editingConfig.model === 'custom' && (
              <input
                placeholder="输入模型名称"
                value={editingConfig.model || ''}
                onChange={e => setEditingConfig({ ...editingConfig, model: e.target.value })}
                style={{ padding: 8 }}
              />
            )}
            {editingConfig.provider === 'openai-compatible' && (
              <input
                placeholder="Base URL (如 http://localhost:8082)"
                value={editingConfig.baseUrl || ''}
                onChange={e => setEditingConfig({ ...editingConfig, baseUrl: e.target.value })}
                style={{ padding: 8 }}
              />
            )}
            <input
              type="password"
              placeholder="API Key (可选)"
              value={editingConfig.apiKey || ''}
              onChange={e => setEditingConfig({ ...editingConfig, apiKey: e.target.value })}
              style={{ padding: 8 }}
            />
            <textarea
              placeholder="备注 (可选)"
              value={editingConfig.description || ''}
              onChange={e => setEditingConfig({ ...editingConfig, description: e.target.value })}
              style={{ padding: 8, minHeight: 60 }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setIsEditing(false)}>取消</button>
              <button
                onClick={handleSave}
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
          + 添加配置
        </button>
      )}
    </div>
  );
}
