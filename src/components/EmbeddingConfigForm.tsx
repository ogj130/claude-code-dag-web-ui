/**
 * EmbeddingConfigForm — Embedding 配置添加/编辑表单
 * Extracted from EmbeddingConfigPanel.tsx
 */

import { useState } from 'react';
import type { EmbeddingConfig, EmbeddingProvider } from '@/stores/embeddingConfigStorage';

const PROVIDER_OPTIONS: { value: EmbeddingProvider; label: string }[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'ollama', label: 'Ollama' },
  { value: 'cohere', label: 'Cohere' },
  { value: 'local', label: 'Local / 其他' },
];

export interface EmbeddingConfigFormProps {
  editingConfig?: EmbeddingConfig | null;
  onSave: (data: Omit<EmbeddingConfig, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

export function EmbeddingConfigForm({ editingConfig, onSave, onCancel }: EmbeddingConfigFormProps) {
  const [name, setName] = useState(editingConfig?.name ?? '');
  const [provider, setProvider] = useState<EmbeddingProvider>(editingConfig?.provider ?? 'openai');
  const [endpoint, setEndpoint] = useState(editingConfig?.endpoint ?? '');
  const [apiKey, setApiKey] = useState(editingConfig?.apiKey ?? '');
  const [model, setModel] = useState(editingConfig?.model ?? '');
  const [dimension, setDimension] = useState(String(editingConfig?.dimension ?? 1536));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = '名称为必填项';
    if (!endpoint.trim()) newErrors.endpoint = 'Endpoint 为必填项';
    if (!model.trim()) newErrors.model = '模型为必填项';
    if (!dimension || isNaN(Number(dimension)) || Number(dimension) <= 0) {
      newErrors.dimension = '维度必须为正整数';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSave({
      name: name.trim(),
      provider,
      endpoint: endpoint.trim(),
      apiKey: apiKey.trim() || undefined,
      model: model.trim(),
      dimension: Number(dimension),
      isDefault: editingConfig?.isDefault ?? false,
    });
    if (!editingConfig) {
      setName(''); setEndpoint(''); setApiKey(''); setModel('');
      setDimension('1536'); setProvider('openai');
    }
  };

  const inputStyle = (hasError: boolean): React.CSSProperties => ({
    width: '100%',
    padding: '8px 10px',
    background: 'var(--bg-input)',
    border: `1px solid ${hasError ? '#ef4444' : 'var(--border)'}`,
    borderRadius: 7,
    fontSize: 12,
    color: 'var(--text-primary)',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  });

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
        {editingConfig ? '编辑配置' : '添加新配置'}
      </div>

      {/* 名称 + 提供商 */}
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
            名称 *
          </label>
          <input
            type="text"
            placeholder="如: OpenAI text-embedding-3"
            value={name}
            onChange={e => setName(e.target.value)}
            style={inputStyle(!!errors.name)}
            onFocus={e => { (e.target as HTMLInputElement).style.borderColor = 'var(--accent)'; }}
            onBlur={e => { (e.target as HTMLInputElement).style.borderColor = errors.name ? '#ef4444' : 'var(--border)'; }}
          />
          {errors.name && <span style={{ fontSize: 10, color: '#ef4444', marginTop: 2 }}>{errors.name}</span>}
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
            提供商 *
          </label>
          <select
            value={provider}
            onChange={e => setProvider(e.target.value as EmbeddingProvider)}
            style={{
              ...inputStyle(false),
              cursor: 'pointer',
            }}
          >
            {PROVIDER_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Endpoint */}
      <div>
        <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
          Endpoint *
        </label>
        <input
          type="text"
          placeholder={provider === 'ollama' ? 'http://localhost:11434/api/embeddings' : 'https://api.openai.com/v1/embeddings'}
          value={endpoint}
          onChange={e => setEndpoint(e.target.value)}
          style={inputStyle(!!errors.endpoint)}
          onFocus={e => { (e.target as HTMLInputElement).style.borderColor = 'var(--accent)'; }}
          onBlur={e => { (e.target as HTMLInputElement).style.borderColor = errors.endpoint ? '#ef4444' : 'var(--border)'; }}
        />
        {errors.endpoint && <span style={{ fontSize: 10, color: '#ef4444', marginTop: 2 }}>{errors.endpoint}</span>}
      </div>

      {/* API Key */}
      <div>
        <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
          API Key {provider === 'ollama' || provider === 'local' ? '(可选)' : ''}
        </label>
        <input
          type="password"
          placeholder="sk-…"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          style={inputStyle(false)}
          onFocus={e => { (e.target as HTMLInputElement).style.borderColor = 'var(--accent)'; }}
          onBlur={e => { (e.target as HTMLInputElement).style.borderColor = 'var(--border)'; }}
        />
      </div>

      {/* 模型 + 维度 */}
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 2 }}>
          <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
            模型 *
          </label>
          <input
            type="text"
            placeholder={provider === 'ollama' ? 'nomic-embed-text' : 'text-embedding-3-small'}
            value={model}
            onChange={e => setModel(e.target.value)}
            style={inputStyle(!!errors.model)}
            onFocus={e => { (e.target as HTMLInputElement).style.borderColor = 'var(--accent)'; }}
            onBlur={e => { (e.target as HTMLInputElement).style.borderColor = errors.model ? '#ef4444' : 'var(--border)'; }}
          />
          {errors.model && <span style={{ fontSize: 10, color: '#ef4444', marginTop: 2 }}>{errors.model}</span>}
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
            维度 *
          </label>
          <input
            type="number"
            placeholder="1536"
            value={dimension}
            onChange={e => setDimension(e.target.value)}
            style={inputStyle(!!errors.dimension)}
            onFocus={e => { (e.target as HTMLInputElement).style.borderColor = 'var(--accent)'; }}
            onBlur={e => { (e.target as HTMLInputElement).style.borderColor = errors.dimension ? '#ef4444' : 'var(--border)'; }}
          />
          {errors.dimension && <span style={{ fontSize: 10, color: '#ef4444', marginTop: 2 }}>{errors.dimension}</span>}
        </div>
      </div>

      {/* 按钮 */}
      <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
        <button
          type="submit"
          style={{
            flex: 1,
            padding: '7px 12px',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 7,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.85'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
        >
          {editingConfig ? '保存更改' : '添加配置'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '7px 12px',
            background: 'transparent',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 7,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-input)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
        >
          取消
        </button>
      </div>
    </form>
  );
}
