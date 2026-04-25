import { useState, useEffect } from 'react';
import type { ModelConfig, ModelProvider } from '@/types/models';
import {
  getAllConfigs as dbGetAll,
  saveConfig as dbSave,
  updateConfig as dbUpdate,
  deleteConfig as dbDelete,
  setDefaultConfig as dbSetDefault,
} from '@/stores/modelConfigStorage';
import { getAllPresets as presetGetAll } from '@/stores/workspacePresetStorage';

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconBrain() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
    </svg>
  );
}

function IconEdit() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconX() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconStar() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function IconWarning() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconSparkle() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3L13.5 8.5L19 10L13.5 11.5L12 17L10.5 11.5L5 10L10.5 8.5L12 3Z" />
      <path d="M19 15L19.75 17.25L22 18L19.75 18.75L19 21L18.25 18.75L16 18L18.25 17.25L19 15Z" />
    </svg>
  );
}

function IconKey() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PROVIDER_META: Record<ModelProvider, { label: string; color: string; icon: string }> = {
  anthropic: { label: 'Anthropic', color: '#f97316', icon: '🧠' },
  'openai-compatible': { label: 'OpenAI 兼容', color: '#22c55e', icon: '🔑' },
};

const ANTHROPIC_MODELS = [
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { value: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
  { value: 'claude-haiku-4-6', label: 'Claude Haiku 4.6' },
];

// ── Badges ────────────────────────────────────────────────────────────────────

function ProviderBadge({ provider }: { provider: ModelProvider }) {
  const meta = PROVIDER_META[provider];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 20,
      fontSize: 11, fontWeight: 600,
      background: `color-mix(in srgb, ${meta.color} 12%, transparent)`,
      color: meta.color,
      border: `1px solid color-mix(in srgb, ${meta.color} 25%, transparent)`,
    }}>
      {provider === 'anthropic' ? <IconBrain /> : <IconKey />}
      {meta.label}
    </span>
  );
}

function DefaultBadge() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 20,
      fontSize: 11, fontWeight: 600,
      background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
      color: 'var(--accent)',
      border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
    }}>
      <IconStar />
      默认
    </span>
  );
}

// ── ConfigCard ────────────────────────────────────────────────────────────────

interface ConfigCardProps {
  config: ModelConfig;
  onSetDefault: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function ConfigCard({ config, onSetDefault, onEdit, onDelete }: ConfigCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        borderRadius: 10,
        background: hovered ? 'var(--bg-card-hover)' : 'var(--bg-card)',
        border: `1px solid ${hovered ? 'var(--border-hover)' : 'var(--border)'}`,
        transition: 'all 0.2s ease',
        cursor: 'default',
      }}
    >
      {/* 头像区 */}
      <div style={{
        width: 36, height: 36, borderRadius: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `color-mix(in srgb, ${PROVIDER_META[config.provider].color} 12%, transparent)`,
        color: PROVIDER_META[config.provider].color,
        flexShrink: 0,
      }}>
        <IconBrain />
      </div>

      {/* 信息 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          marginBottom: 4,
        }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
            {config.name}
          </span>
          {config.isDefault && <DefaultBadge />}
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
        }}>
          <span style={{
            fontSize: 12, fontFamily: 'monospace',
            color: 'var(--text-primary)',
            background: 'var(--border)',
            padding: '1px 6px', borderRadius: 4,
          }}>
            {config.model}
          </span>
          <ProviderBadge provider={config.provider} />
          {config.description && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {config.description}
            </span>
          )}
        </div>
      </div>

      {/* 操作 */}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <ActionButton
          title="设为默认"
          icon={<IconStar />}
          variant={config.isDefault ? 'disabled' : 'default'}
          onClick={onSetDefault}
          disabled={config.isDefault}
        />
        <ActionButton
          title="编辑"
          icon={<IconEdit />}
          variant="default"
          onClick={onEdit}
        />
        <ActionButton
          title="删除"
          icon={<IconTrash />}
          variant="danger"
          onClick={onDelete}
        />
      </div>
    </div>
  );
}

function ActionButton({ title, icon, variant, onClick, disabled }: {
  title: string; icon: React.ReactNode;
  variant: 'default' | 'success' | 'danger' | 'disabled';
  onClick: () => void; disabled?: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  const colors = {
    default: { color: 'var(--text-secondary)', hoverBg: 'var(--bg-input)', hoverColor: 'var(--text-primary)' },
    success: { color: 'var(--success)', hoverBg: 'color-mix(in srgb, var(--success) 12%, transparent)', hoverColor: 'var(--success)' },
    danger: { color: 'var(--error)', hoverBg: 'color-mix(in srgb, var(--error) 12%, transparent)', hoverColor: 'var(--error)' },
    disabled: { color: 'var(--border)', hoverBg: 'transparent', hoverColor: 'var(--border)' },
  }[variant];

  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={title}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 30, height: 30, borderRadius: 6,
        background: hovered && !disabled ? colors.hoverBg : 'transparent',
        color: disabled ? colors.color : (hovered ? colors.hoverColor : colors.color),
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s ease',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {icon}
    </button>
  );
}

// ── FormModal ────────────────────────────────────────────────────────────────

interface FormModalProps {
  config: Partial<ModelConfig>;
  onSave: () => void;
  onCancel: () => void;
  onChange: (partial: Partial<ModelConfig>) => void;
}

function FormModal({ config, onSave, onCancel, onChange }: FormModalProps) {
  const isEdit = !!config.id;
  const canSave = !!config.name?.trim() && !!config.model?.trim() && !!config.provider;
  // Anthropic 自定义模型名（当选择了"其他..."时）
  const [customModel, setCustomModel] = useState('');

  const anthropicOptions = [
    ...ANTHROPIC_MODELS,
    { value: '__custom__', label: '其他（自定义）' },
  ];

  // 连接测试状态
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  function handleAnthropicModelChange(val: string) {
    if (val === '__custom__') {
      setCustomModel(config.model && !ANTHROPIC_MODELS.some(m => m.value === config.model) ? config.model : '');
      onChange({ ...config, model: '' });
    } else {
      setCustomModel('');
      onChange({ ...config, model: val });
    }
  }

  function handleCustomModelInput(v: string) {
    setCustomModel(v);
    onChange({ ...config, model: v });
  }

  const handleTestConnection = async () => {
    if (!config.model?.trim()) {
      setTestStatus('error');
      setTestMessage('请先填写模型名称');
      return;
    }
    setTestStatus('testing');
    setTestMessage('');
    const start = Date.now();
    try {
      const baseUrl = (config.baseUrl ?? 'https://api.anthropic.com').replace(/\/$/, '');
      const isClaude = (config.model ?? '').toLowerCase().startsWith('claude');

      let url: string;
      let headers: Record<string, string> = { 'Content-Type': 'application/json' };
      let body: Record<string, unknown>;

      if (isClaude) {
        url = `${baseUrl}/v1/messages`;
        headers['x-api-key'] = config.apiKey ?? '';
        headers['anthropic-version'] = '2023-06-01';
        body = { model: config.model, messages: [{ role: 'user', content: 'Hi' }], max_tokens: 10, temperature: 0.1 };
      } else {
        url = `${baseUrl}/v1/chat/completions`;
        headers['Authorization'] = `Bearer ${config.apiKey ?? ''}`;
        body = { model: config.model, messages: [{ role: 'user', content: 'Hi' }], max_tokens: 10, temperature: 0.1 };
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      try {
        const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal });
        clearTimeout(timeout);

        if (resp.ok) {
          const latency = Date.now() - start;
          setTestStatus('success');
          setTestMessage(`连接成功 (${latency}ms)`);
        } else {
          const err = await resp.text().catch(() => '');
          setTestStatus('error');
          setTestMessage(`连接失败: HTTP ${resp.status}${err ? ' - ' + err.slice(0, 100) : ''}`);
        }
      } catch (err) {
        clearTimeout(timeout);
        if (err instanceof Error && err.name === 'AbortError') {
          setTestStatus('error');
          setTestMessage('连接超时 (3s)');
        } else {
          setTestStatus('error');
          setTestMessage(`连接失败: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      } catch (_outerErr) {
        // Setup errors before fetch is attempted — non-critical, log only
        console.warn('[ModelConfigPanel] Connection setup error:', _outerErr);
      }
  };

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: 12,
      background: 'var(--bg-card)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--bg-card-hover)',
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          {isEdit ? '编辑配置' : '新建配置'}
        </span>
        <button
          onClick={onCancel}
          aria-label="关闭"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28, borderRadius: 6,
            background: 'transparent', color: 'var(--text-secondary)',
            border: 'none', cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--border)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          <IconX />
        </button>
      </div>

      {/* Fields */}
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="配置名称" required>
          <ThemedInput
            placeholder="例如「主力模型」"
            value={config.name || ''}
            onChange={v => onChange({ ...config, name: v })}
          />
        </Field>

        <Field label="提供商" required>
          <ThemedSelect
            value={config.provider || 'anthropic'}
            onChange={v => onChange({ ...config, provider: v as ModelProvider })}
            options={[
              { value: 'anthropic', label: 'Anthropic' },
              { value: 'openai-compatible', label: 'OpenAI 兼容' },
            ]}
          />
        </Field>

        <Field label="模型" required>
          {config.provider === 'anthropic' ? (
            <>
              <ThemedSelect
                value={ANTHROPIC_MODELS.some(m => m.value === (config.model ?? '')) ? (config.model ?? '') : '__custom__'}
                onChange={handleAnthropicModelChange}
                options={anthropicOptions}
                placeholder="选择模型"
              />
              {/* 自定义模型名称输入 */}
              {!ANTHROPIC_MODELS.some(m => m.value === (config.model ?? '')) && (
                <div style={{ marginTop: 8 }}>
                  <ThemedInput
                    placeholder="输入自定义模型名称"
                    value={customModel}
                    onChange={handleCustomModelInput}
                  />
                </div>
              )}
            </>
          ) : (
            <ThemedInput
              placeholder="输入模型名称，如 gpt-4o"
              value={config.model || ''}
              onChange={v => onChange({ ...config, model: v })}
            />
          )}
        </Field>

        <Field label="Base URL">
          <ThemedInput
            placeholder={
              config.provider === 'openai-compatible'
                ? '例如 http://localhost:8082'
                : '留空使用默认值，或输入自定义地址'
            }
            value={config.baseUrl || ''}
            onChange={v => onChange({ ...config, baseUrl: v })}
          />
        </Field>

        <Field label="API Key">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <ThemedInput
                type="password"
                placeholder="可选，留空则使用环境变量"
                value={config.apiKey || ''}
                onChange={v => {
                  onChange({ ...config, apiKey: v });
                  if (testStatus !== 'idle') {
                    setTestStatus('idle');
                    setTestMessage('');
                  }
                }}
              />
            </div>
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testStatus === 'testing'}
              style={{
                padding: '7px 12px',
                borderRadius: 8,
                border: `1px solid ${
                  testStatus === 'success' ? 'var(--success)' :
                  testStatus === 'error' ? 'var(--error)' :
                  'var(--border)'
                }`,
                background: testStatus === 'success'
                  ? 'color-mix(in srgb, var(--success) 10%, transparent)'
                  : testStatus === 'error'
                  ? 'color-mix(in srgb, var(--error) 10%, transparent)'
                  : 'var(--bg-card)',
                color: testStatus === 'success'
                  ? 'var(--success)'
                  : testStatus === 'error'
                  ? 'var(--error)'
                  : 'var(--text-primary)',
                cursor: testStatus === 'testing' ? 'wait' : 'pointer',
                fontSize: 13,
                fontWeight: 500,
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                whiteSpace: 'nowrap',
                opacity: testStatus === 'testing' ? 0.7 : 1,
                transition: 'all 0.15s',
              }}
              title="测试 API 连通性"
            >
              {testStatus === 'testing' ? (
                '测试中…'
              ) : testStatus === 'success' ? (
                <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>连接</>
              ) : testStatus === 'error' ? (
                <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>重试</>
              ) : (
                '测试连接'
              )}
            </button>
          </div>
          {testMessage && (
            <div style={{
              marginTop: 6,
              fontSize: 12,
              color: testStatus === 'success' ? 'var(--success)' : 'var(--error)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}>
              {testStatus === 'success' ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              )}
              {testMessage}
            </div>
          )}
        </Field>

        <Field label="备注">
          <ThemedTextarea
            placeholder="可选描述"
            value={config.description || ''}
            onChange={v => onChange({ ...config, description: v })}
            rows={2}
          />
        </Field>
      </div>

      {/* Footer */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid var(--border)',
        display: 'flex', justifyContent: 'flex-end', gap: 8,
        background: 'var(--bg-card-hover)',
      }}>
        <ThemedButton variant="secondary" onClick={onCancel}>取消</ThemedButton>
        <ThemedButton variant="primary" onClick={onSave} disabled={!canSave}>
          {isEdit ? '保存更改' : '添加配置'}
        </ThemedButton>
      </div>
    </div>
  );
}

// ── DeleteConfirm ─────────────────────────────────────────────────────────────

function DeleteConfirm({ onConfirm, onCancel }: {
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: 24,
        maxWidth: 380,
        width: '90%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'color-mix(in srgb, var(--error) 12%, transparent)',
            color: 'var(--error)',
          }}>
            <IconWarning />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
              确认删除
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              此操作不可撤销
            </div>
          </div>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 20px', lineHeight: 1.6 }}>
          此配置被工作目录预设引用，删除后相关预设将<span style={{ color: '#f97316', fontWeight: 600 }}>失效</span>。
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <ThemedButton variant="secondary" onClick={onCancel}>取消</ThemedButton>
          <ThemedButton variant="danger" onClick={onConfirm}>确认删除</ThemedButton>
        </div>
      </div>
    </div>
  );
}

// ── Field / Inputs ────────────────────────────────────────────────────────────

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
        {label}
        {required && <span style={{ color: 'var(--error)', fontSize: 11 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function ThemedInput({ value, onChange, placeholder, type = 'text' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%', padding: '8px 12px',
        background: 'var(--bg-input)', border: '1px solid var(--border)',
        borderRadius: 8, color: 'var(--text-primary)', fontSize: 13,
        fontFamily: 'inherit', outline: 'none',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        boxSizing: 'border-box',
      }}
      onFocus={e => {
        e.currentTarget.style.borderColor = 'var(--accent)';
        e.currentTarget.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--accent) 15%, transparent)';
      }}
      onBlur={e => {
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    />
  );
}

function ThemedSelect({ value, onChange, options, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%', padding: '8px 12px',
        background: 'var(--bg-input)', border: '1px solid var(--border)',
        borderRadius: 8, color: value ? 'var(--text-primary)' : 'var(--text-muted)',
        fontSize: 13, fontFamily: 'inherit', outline: 'none', cursor: 'pointer',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        boxSizing: 'border-box',
        appearance: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 10px center',
        paddingRight: 32,
      }}
      onFocus={e => {
        e.currentTarget.style.borderColor = 'var(--accent)';
        e.currentTarget.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--accent) 15%, transparent)';
      }}
      onBlur={e => {
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <option value="">{placeholder || '请选择...'}</option>
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function ThemedTextarea({ value, onChange, placeholder, rows = 3 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{
        width: '100%', padding: '8px 12px',
        background: 'var(--bg-input)', border: '1px solid var(--border)',
        borderRadius: 8, color: 'var(--text-primary)', fontSize: 13,
        fontFamily: 'inherit', outline: 'none', resize: 'vertical',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        boxSizing: 'border-box', minHeight: 60,
      }}
      onFocus={e => {
        e.currentTarget.style.borderColor = 'var(--accent)';
        e.currentTarget.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--accent) 15%, transparent)';
      }}
      onBlur={e => {
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    />
  );
}

// ── ThemedButton ─────────────────────────────────────────────────────────────

function ThemedButton({ variant, onClick, disabled, children }: {
  variant: 'primary' | 'secondary' | 'danger';
  onClick: () => void; disabled?: boolean; children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);

  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '7px 16px', borderRadius: 8,
    fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
    border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.15s ease', opacity: disabled ? 0.5 : 1,
  };

  const variants = {
    primary: {
      background: hovered && !disabled ? 'var(--accent-dim)' : 'var(--accent)',
      color: 'white',
    },
    secondary: {
      background: hovered && !disabled ? 'var(--bg-input)' : 'transparent',
      color: 'var(--text-secondary)',
      border: '1px solid var(--border)',
    },
    danger: {
      background: hovered && !disabled ? 'var(--error)' : 'transparent',
      color: hovered && !disabled ? 'white' : 'var(--error)',
      border: '1px solid var(--error)',
    },
  }[variant];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ ...base, ...variants }}
    >
      {children}
    </button>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '40px 20px',
      color: 'var(--text-muted)', gap: 12,
    }}>
      <div style={{ opacity: 0.3 }}>
        <IconSparkle />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
          暂无模型配置
        </div>
        <div style={{ fontSize: 12 }}>
          添加模型配置后可在全局终端中<br />为不同工作区指定不同的 AI 模型
        </div>
      </div>
      <ThemedButton variant="primary" onClick={onAdd}>
        <IconPlus />
        添加第一个配置
      </ThemedButton>
    </div>
  );
}

// ── StatsBar ─────────────────────────────────────────────────────────────────

function StatsBar({ configs }: { configs: ModelConfig[] }) {
  const defaults = configs.filter(c => c.isDefault).length;
  const anthropic = configs.filter(c => c.provider === 'anthropic').length;
  const openai = configs.filter(c => c.provider === 'openai-compatible').length;

  return (
    <div style={{
      display: 'flex', gap: 12, padding: '0 0 12px 0',
      borderBottom: '1px solid var(--border)', marginBottom: 12,
    }}>
      <StatPill label="总计" value={configs.length} />
      <StatPill label="Anthropic" value={anthropic} color={PROVIDER_META['anthropic'].color} />
      <StatPill label="OpenAI 兼容" value={openai} color={PROVIDER_META['openai-compatible'].color} />
      {defaults > 0 && <StatPill label="默认" value={defaults} color="var(--accent)" />}
    </div>
  );
}

function StatPill({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontWeight: 700, fontSize: 13, color: color || 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}

// ── ModelConfigPanel ─────────────────────────────────────────────────────────

export function ModelConfigPanel() {
  const [configs, setConfigs] = useState<ModelConfig[]>([]);
  const [editing, setEditing] = useState<Partial<ModelConfig> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    loadConfigs();
  }, []);

  async function loadConfigs() {
    try {
      const data = window.electron?.invoke
        ? await window.electron.invoke('model-config:get-all') as ModelConfig[]
        : await dbGetAll();
      setConfigs(data || []);
    } catch (err) {
      console.error('[ModelConfigPanel] Failed to load:', err);
    }
  }

  async function handleSave() {
    if (!editing?.name?.trim() || !editing?.model?.trim() || !editing?.provider) return;
    try {
      if (editing.id) {
        if (window.electron?.invoke) {
          await window.electron.invoke('model-config:update', editing.id, editing);
        } else {
          await dbUpdate(editing.id, editing);
        }
      } else {
        if (window.electron?.invoke) {
          await window.electron.invoke('model-config:save', { ...editing, isDefault: false });
        } else {
          await dbSave({ ...editing, isDefault: false } as Omit<ModelConfig, 'id' | 'createdAt' | 'updatedAt'>);
        }
      }
      await loadConfigs();
      setEditing(null);
    } catch (err) {
      console.error('[ModelConfigPanel] Save failed:', err);
    }
  }

  async function handleDelete(id: string) {
    try {
      const presets = window.electron?.invoke
        ? await window.electron.invoke('workspace-preset:get-all') as { configId: string }[]
        : await presetGetAll();
      const usedBy = presets.filter(p => p.configId === id);
      if (usedBy.length > 0) {
        setDeleteTarget(id);
        return;
      }
      if (window.electron?.invoke) {
        await window.electron.invoke('model-config:delete', id);
      } else {
        await dbDelete(id);
      }
      await loadConfigs();
    } catch (err) {
      console.error('[ModelConfigPanel] Delete failed:', err);
    }
  }

  async function confirmDelete(id: string) {
    try {
      if (window.electron?.invoke) {
        await window.electron.invoke('model-config:delete', id);
      } else {
        await dbDelete(id);
      }
      await loadConfigs();
    } catch (err) {
      console.error('[ModelConfigPanel] Confirm delete failed:', err);
    } finally {
      setDeleteTarget(null);
    }
  }

  async function handleSetDefault(id: string) {
    try {
      if (window.electron?.invoke) {
        await window.electron.invoke('model-config:set-default', id);
      } else {
        await dbSetDefault(id);
      }
      await loadConfigs();
    } catch (err) {
      console.error('[ModelConfigPanel] Set default failed:', err);
    }
  }

  return (
    <div style={{ padding: 16 }}>
      {configs.length > 0 && <StatsBar configs={configs} />}

      {/* 列表 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {configs.map(cfg => (
          <ConfigCard
            key={cfg.id}
            config={cfg}
            onSetDefault={() => handleSetDefault(cfg.id)}
            onEdit={() => setEditing(cfg)}
            onDelete={() => handleDelete(cfg.id)}
          />
        ))}
      </div>

      {/* 表单 */}
      {editing && (
        <FormModal
          config={editing}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
          onChange={partial => setEditing(prev => prev ? { ...prev, ...partial } : partial as Partial<ModelConfig>)}
        />
      )}

      {/* 删除确认 */}
      {deleteTarget && (
        <DeleteConfirm
          onConfirm={() => confirmDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* 空状态 */}
      {configs.length === 0 && !editing && (
        <EmptyState onAdd={() => setEditing({ provider: 'anthropic', model: 'claude-sonnet-4-6', isDefault: false })} />
      )}

      {/* 添加按钮 */}
      {configs.length > 0 && !editing && (
        <button
          onClick={() => setEditing({ provider: 'anthropic', model: 'claude-sonnet-4-6', isDefault: false })}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            width: '100%', padding: '10px',
            background: 'transparent',
            border: '1px dashed var(--border)',
            borderRadius: 10,
            color: 'var(--text-muted)',
            fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'var(--accent)';
            e.currentTarget.style.color = 'var(--accent)';
            e.currentTarget.style.background = 'color-mix(in srgb, var(--accent) 5%, transparent)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.color = 'var(--text-muted)';
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <IconPlus />
          添加配置
        </button>
      )}
    </div>
  );
}
