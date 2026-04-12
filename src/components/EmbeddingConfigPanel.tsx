import { useState, useEffect, useCallback } from 'react';
import {
  getAllConfigs,
  saveConfig,
  updateConfig,
  deleteConfig,
  setDefaultConfig,
} from '@/stores/embeddingConfigStorage';
import { testConnection } from '@/utils/embedding';
import type { EmbeddingConfig, EmbeddingProvider } from '@/stores/embeddingConfigStorage';
import type { TestResult } from '@/utils/embedding';

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

const PROVIDER_OPTIONS: { value: EmbeddingProvider; label: string }[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'ollama', label: 'Ollama' },
  { value: 'cohere', label: 'Cohere' },
  { value: 'local', label: 'Local / 其他' },
];

const PROVIDER_COLORS: Record<EmbeddingProvider, string> = {
  openai: '#4ade80',
  ollama: '#818cf8',
  cohere: '#f97316',
  local: '#6b7280',
};

// ---------------------------------------------------------------------------
// 子组件
// ---------------------------------------------------------------------------

/** 配置卡片 */
function ConfigCard({
  config,
  onSetDefault,
  onTest,
  onEdit,
  onDelete,
  testing,
  testResult,
}: {
  config: EmbeddingConfig;
  onSetDefault: () => void;
  onTest: () => void;
  onEdit: () => void;
  onDelete: () => void;
  testing: boolean;
  testResult: TestResult | null;
}) {
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${config.isDefault ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 10,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        transition: 'box-shadow 0.2s',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.2)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
      }}
    >
      {/* 卡片头部 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              {config.name}
            </span>
            {config.isDefault && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  background: 'var(--accent)',
                  color: '#fff',
                  borderRadius: 4,
                  padding: '1px 5px',
                  letterSpacing: '0.05em',
                }}
              >
                DEFAULT
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                fontSize: 10,
                color: '#fff',
                background: PROVIDER_COLORS[config.provider],
                borderRadius: 4,
                padding: '1px 6px',
                fontWeight: 600,
              }}
            >
              {PROVIDER_OPTIONS.find(p => p.value === config.provider)?.label ?? config.provider}
            </span>
            <span
              style={{
                fontSize: 10,
                color: 'var(--text-muted)',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {config.model}
            </span>
          </div>
        </div>

        {/* 删除按钮 */}
        <button
          onClick={onDelete}
          title="删除配置"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: 3,
            borderRadius: 4,
            fontSize: 13,
            transition: 'all 0.15s',
            flexShrink: 0,
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.color = '#ef4444';
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.1)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M3 4h10M5 4V3a1 1 0 011-1h4a1 1 0 011 1v1M12 4v9a1 1 0 01-1 1H5a1 1 0 01-1-1V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* 指标行 */}
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            维度
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace" }}>
            {config.lastTestDimension ?? config.dimension}
          </span>
        </div>
        {testResult ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              延迟
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                fontFamily: "'JetBrains Mono', monospace",
                color: testResult.success ? '#4ade80' : '#ef4444',
              }}
            >
              {testing ? '…' : testResult.success ? `${testResult.latency}ms` : '失败'}
            </span>
          </div>
        ) : config.lastTestLatency ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              上次延迟
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', fontFamily: "'JetBrains Mono', monospace" }}>
              {config.lastTestLatency}ms
            </span>
          </div>
        ) : null}
      </div>

      {/* 测试结果提示 */}
      {testResult && !testResult.success && (
        <div
          style={{
            fontSize: 11,
            color: '#ef4444',
            background: 'rgba(239,68,68,0.08)',
            borderRadius: 5,
            padding: '5px 8px',
            border: '1px solid rgba(239,68,68,0.2)',
          }}
        >
          {testResult.error ?? '连接失败'}
        </div>
      )}

      {/* 操作按钮行 */}
      <div style={{ display: 'flex', gap: 6 }}>
        {!config.isDefault && (
          <button
            onClick={onSetDefault}
            style={{
              flex: 1,
              padding: '5px 8px',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              const btn = e.currentTarget as HTMLButtonElement;
              btn.style.background = 'var(--bg-input)';
              btn.style.borderColor = 'var(--accent)';
              btn.style.color = 'var(--accent)';
            }}
            onMouseLeave={e => {
              const btn = e.currentTarget as HTMLButtonElement;
              btn.style.background = 'transparent';
              btn.style.borderColor = 'var(--border)';
              btn.style.color = 'var(--text-secondary)';
            }}
          >
            设为默认
          </button>
        )}
        <button
          onClick={onTest}
          disabled={testing}
          style={{
            flex: 1,
            padding: '5px 8px',
            background: testing ? 'var(--bg-input)' : 'var(--bg-card)',
            border: `1px solid ${testing ? 'var(--border)' : 'var(--accent)'}`,
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            color: testing ? 'var(--text-muted)' : 'var(--accent)',
            cursor: testing ? 'default' : 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            if (!testing) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-input)';
          }}
          onMouseLeave={e => {
            if (!testing) {
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-card)';
            }
          }}
        >
          {testing ? '测试中…' : '测试连接'}
        </button>
        <button
          onClick={onEdit}
          style={{
            flex: 1,
            padding: '5px 8px',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            const btn = e.currentTarget as HTMLButtonElement;
            btn.style.background = 'var(--bg-input)';
            btn.style.borderColor = 'var(--accent)';
            btn.style.color = 'var(--accent)';
          }}
          onMouseLeave={e => {
            const btn = e.currentTarget as HTMLButtonElement;
            btn.style.background = 'transparent';
            btn.style.borderColor = 'var(--border)';
            btn.style.color = 'var(--text-secondary)';
          }}
        >
          编辑
        </button>
      </div>
    </div>
  );
}

/** 添加/编辑表单 */
function ConfigForm({
  editingConfig,
  onSave,
  onCancel,
}: {
  editingConfig?: EmbeddingConfig | null;
  onSave: (data: Omit<EmbeddingConfig, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}) {
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
      // 新建后清空表单
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

// ---------------------------------------------------------------------------
// 主组件
// ---------------------------------------------------------------------------

export function EmbeddingConfigPanel() {
  const [configs, setConfigs] = useState<EmbeddingConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingConfig, setEditingConfig] = useState<EmbeddingConfig | null>(null);
  const [testingIds, setTestingIds] = useState<Set<string>>(new Set());
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});

  const loadConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllConfigs();
      setConfigs(data);
    } catch (err) {
      console.error('[EmbeddingConfigPanel] Failed to load configs:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  const handleSave = async (data: Omit<EmbeddingConfig, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      if (editingConfig) {
        await updateConfig(editingConfig.id, data);
        setConfigs(prev => prev.map(c => c.id === editingConfig.id ? { ...c, ...data, updatedAt: Date.now() } : c));
        setEditingConfig(null);
      } else {
        const newConfig = await saveConfig(data);
        setConfigs(prev => [...prev, newConfig]);
      }
      setShowForm(false);
    } catch (err) {
      console.error('[EmbeddingConfigPanel] Failed to save config:', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteConfig(id);
      setConfigs(prev => prev.filter(c => c.id !== id));
      setTestResults(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (err) {
      console.error('[EmbeddingConfigPanel] Failed to delete config:', err);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await setDefaultConfig(id);
      setConfigs(prev => prev.map(c => ({ ...c, isDefault: c.id === id })));
    } catch (err) {
      console.error('[EmbeddingConfigPanel] Failed to set default:', err);
    }
  };

  const handleTest = async (config: EmbeddingConfig) => {
    setTestingIds(prev => new Set(prev).add(config.id));
    try {
      const result = await testConnection(config);
      setTestResults(prev => ({ ...prev, [config.id]: result }));
    } catch (err) {
      setTestResults(prev => ({
        ...prev,
        [config.id]: { success: false, error: String(err) },
      }));
    } finally {
      setTestingIds(prev => {
        const next = new Set(prev);
        next.delete(config.id);
        return next;
      });
    }
  };

  const handleEdit = (config: EmbeddingConfig) => {
    setEditingConfig(config);
    setShowForm(true);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingConfig(null);
  };

  return (
    <>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .embedding-panel {
          animation: fadeIn 0.2s ease-out;
        }
        .embedding-card-enter {
          animation: cardEnter 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        @keyframes cardEnter {
          from { opacity: 0; transform: scale(0.95) translateY(-8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>

      <div
        className="embedding-panel"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          padding: '20px 24px',
          maxWidth: 720,
          margin: '0 auto',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {/* 标题栏 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2L2 5v6l6 3 6-3V5L8 2z" stroke="var(--accent)" strokeWidth="1.5" fill="none" />
              <path d="M8 2v12M2 5l6 3 6-3" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
              Embedding 配置
            </span>
            {!loading && (
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  background: 'var(--bg-input)',
                  borderRadius: 10,
                  padding: '1px 8px',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {configs.length}
              </span>
            )}
          </div>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              style={{
                padding: '6px 14px',
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 7,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.85'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
            >
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              添加配置
            </button>
          )}
        </div>

        {/* 表单区域 */}
        {showForm && (
          <div className="embedding-card-enter">
            <ConfigForm
              editingConfig={editingConfig}
              onSave={handleSave}
              onCancel={handleCancelForm}
            />
          </div>
        )}

        {/* 配置列表 */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                style={{
                  background: 'linear-gradient(90deg, var(--bg-card) 25%, var(--bg-input) 50%, var(--bg-card) 75%)',
                  backgroundSize: '200% 100%',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  height: 120,
                  animation: 'shimmer 1.5s infinite',
                }}
              />
            ))}
          </div>
        ) : configs.length === 0 && !showForm ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 24px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              gap: 12,
              color: 'var(--text-muted)',
            }}
          >
            <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
              <path d="M24 6L6 15v18l18 9 18-9V15L24 6z" stroke="currentColor" strokeWidth="2" fill="none" />
              <path d="M24 6v36M6 15l18 9 18-9" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            </svg>
            <div style={{ fontSize: 13, fontWeight: 600 }}>暂无 Embedding 配置</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
              添加配置以启用向量检索功能
            </div>
            <button
              onClick={() => setShowForm(true)}
              style={{
                marginTop: 8,
                padding: '7px 16px',
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 7,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              添加第一个配置
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {configs.map((config, i) => (
              <div key={config.id} className="embedding-card-enter" style={{ animationDelay: `${i * 30}ms` }}>
                <ConfigCard
                  config={config}
                  onSetDefault={() => handleSetDefault(config.id)}
                  onTest={() => handleTest(config)}
                  onEdit={() => handleEdit(config)}
                  onDelete={() => handleDelete(config.id)}
                  testing={testingIds.has(config.id)}
                  testResult={testResults[config.id] ?? null}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
