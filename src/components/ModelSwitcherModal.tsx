import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ModelConfig } from '@/types/models';
import { useModelForm } from '@/hooks/useModelForm';
import { ConfirmSwitchDialog } from './ConfirmSwitchDialog';

interface ModelSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitch: (config: ModelConfig) => void;
  currentModel?: string;
}

type Tab = 'switch' | 'add';

export function ModelSwitcherModal({ isOpen, onClose, onSwitch, currentModel }: ModelSwitcherModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('switch');
  const [configs, setConfigs] = useState<ModelConfig[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<ModelConfig | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const { formData, updateField, reset, save, isValid, isSaving, ANTHROPIC_MODELS } = useModelForm();

  // 加载配置列表
  useEffect(() => {
    if (isOpen) {
      loadConfigs();
    }
  }, [isOpen]);

  const loadConfigs = async () => {
    setIsLoading(true);
    try {
      if (!window.electron?.invoke) {
        setConfigs([{ id: 'default', name: '默认模型', model: 'claude-sonnet-4-6', provider: 'anthropic', isDefault: true, createdAt: Date.now(), updatedAt: Date.now() }]);
        return;
      }
      const list = await window.electron.invoke('model-config:get-all') as ModelConfig[];
      setConfigs(list);
    } catch (error) {
      console.error('Failed to load configs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 处理新增保存
  const handleSave = async () => {
    const success = await save();
    if (success) {
      await loadConfigs();
      setActiveTab('switch');
      reset();
    }
  };

  // 处理切换
  const handleSwitch = () => {
    if (selectedConfig && selectedConfig.model !== currentModel) {
      setShowConfirm(true);
    } else {
      onClose();
    }
  };

  const confirmSwitch = () => {
    if (selectedConfig) {
      onSwitch(selectedConfig);
    }
    setShowConfirm(false);
    setSelectedConfig(null);
    onClose();
  };

  // ESC 关闭
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modal = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9998,
        animation: 'fadeIn 200ms ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 12,
          width: 520,
          maxWidth: '95vw',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 16px 64px rgba(0, 0, 0, 0.4)',
          animation: 'scaleIn 200ms ease-out',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
        }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
            模型管理
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              color: 'var(--text-secondary)',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Tab Bar */}
        <div style={{
          display: 'flex',
          gap: 8,
          padding: '12px 20px',
          borderBottom: '1px solid var(--border)',
        }}>
          <button
            onClick={() => setActiveTab('switch')}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              backgroundColor: activeTab === 'switch' ? 'var(--accent)' : 'var(--bg-secondary)',
              color: activeTab === 'switch' ? 'white' : 'var(--text-secondary)',
              transition: 'all 150ms ease',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 3h5v5M8 21H3v-5M21 3l-9 9M3 21l9-9"/>
            </svg>
            切换模型
          </button>
          <button
            onClick={() => setActiveTab('add')}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              backgroundColor: activeTab === 'add' ? 'var(--accent)' : 'var(--bg-secondary)',
              color: activeTab === 'add' ? 'white' : 'var(--text-secondary)',
              transition: 'all 150ms ease',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            新增模型
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {activeTab === 'switch' ? (
            /* 切换模型 Tab */
            isLoading ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
                加载中...
              </div>
            ) : configs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
                暂无模型配置，请先添加
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {configs.map(config => (
                  <button
                    key={config.id}
                    onClick={() => setSelectedConfig(config)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '14px 16px',
                      borderRadius: 8,
                      border: selectedConfig?.id === config.id ? '2px solid var(--accent)' : '1px solid var(--border)',
                      backgroundColor: selectedConfig?.id === config.id ? 'var(--bg-card-hover)' : 'var(--bg-secondary)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 150ms ease',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Selected Indicator */}
                    {config.model === currentModel && (
                      <div style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: 3,
                        backgroundColor: 'var(--success)',
                      }} />
                    )}

                    <div style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      border: `2px solid ${selectedConfig?.id === config.id ? 'var(--accent)' : 'var(--border)'}`,
                      marginRight: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: selectedConfig?.id === config.id ? 'var(--accent)' : 'transparent',
                    }}>
                      {selectedConfig?.id === config.id && (
                        <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'white' }} />
                      )}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                          {config.name}
                        </span>
                        {config.model === currentModel && (
                          <span style={{
                            fontSize: 11,
                            padding: '2px 8px',
                            borderRadius: 4,
                            backgroundColor: 'var(--success-bg)',
                            color: 'var(--success)',
                            fontWeight: 500,
                          }}>
                            当前使用中
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {config.model} · {config.provider}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )
          ) : (
            /* 新增模型 Tab */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* 配置名称 */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>
                  配置名称
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => updateField('name', e.target.value)}
                  placeholder="例如：我的 Claude 配置"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    outline: 'none',
                    transition: 'border-color 150ms ease',
                  }}
                />
              </div>

              {/* 提供商 */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>
                  提供商
                </label>
                <select
                  value={formData.provider}
                  onChange={e => updateField('provider', e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value="anthropic">Anthropic</option>
                  <option value="openai-compatible">OpenAI 兼容</option>
                </select>
              </div>

              {/* 模型选择 */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>
                  模型
                </label>
                <select
                  value={formData.model}
                  onChange={e => updateField('model', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value="">选择模型</option>
                  {formData.provider === 'anthropic' && ANTHROPIC_MODELS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                  <option value="custom">自定义...</option>
                </select>
              </div>

              {/* Base URL (仅 OpenAI 兼容) */}
              {formData.provider === 'openai-compatible' && (
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>
                    Base URL
                  </label>
                  <input
                    type="text"
                    value={formData.baseUrl || ''}
                    onChange={e => updateField('baseUrl', e.target.value)}
                    placeholder="例如：http://localhost:8082"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--bg-input)',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                      outline: 'none',
                    }}
                  />
                </div>
              )}

              {/* API Key */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>
                  API Key <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(可选)</span>
                </label>
                <input
                  type="password"
                  value={formData.apiKey || ''}
                  onChange={e => updateField('apiKey', e.target.value)}
                  placeholder="输入 API Key"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
              </div>

              {/* 备注 */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>
                  备注 <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(可选)</span>
                </label>
                <textarea
                  value={formData.description || ''}
                  onChange={e => updateField('description', e.target.value)}
                  placeholder="添加备注..."
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    outline: 'none',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* 保存按钮 */}
              <button
                onClick={handleSave}
                disabled={!isValid || isSaving}
                style={{
                  padding: '12px',
                  borderRadius: 6,
                  border: 'none',
                  backgroundColor: isValid && !isSaving ? 'var(--accent)' : 'var(--bg-secondary)',
                  color: isValid && !isSaving ? 'white' : 'var(--text-secondary)',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: isValid && !isSaving ? 'pointer' : 'not-allowed',
                  transition: 'all 150ms ease',
                  opacity: isSaving ? 0.7 : 1,
                }}
              >
                {isSaving ? '保存中...' : '保存配置'}
              </button>
            </div>
          )}
        </div>

        {/* Footer (仅切换模型 Tab) */}
        {activeTab === 'switch' && (
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 12,
            padding: '16px 20px',
            borderTop: '1px solid var(--border)',
          }}>
            <button
              onClick={onClose}
              style={{
                padding: '10px 20px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
            >
              取消
            </button>
            <button
              onClick={handleSwitch}
              disabled={!selectedConfig}
              style={{
                padding: '10px 20px',
                borderRadius: 6,
                border: 'none',
                backgroundColor: selectedConfig ? 'var(--accent)' : 'var(--bg-secondary)',
                color: selectedConfig ? 'white' : 'var(--text-secondary)',
                fontSize: 13,
                fontWeight: 500,
                cursor: selectedConfig ? 'pointer' : 'not-allowed',
                transition: 'all 150ms ease',
              }}
            >
              确认切换
            </button>
          </div>
        )}
      </div>

      {/* 确认对话框 */}
      {showConfirm && selectedConfig && (
        <ConfirmSwitchDialog
          targetConfig={selectedConfig}
          onConfirm={confirmSwitch}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );

  return createPortal(modal, document.body);
}
