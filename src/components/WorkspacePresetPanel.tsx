import { useState, useEffect } from 'react';
import type { WorkspacePreset, ModelConfig } from '@/types/models';
import { getAllConfigs as dbGetAllConfigs } from '@/stores/modelConfigStorage';
import { getAllPresets as dbGetAllPresets, savePreset as dbSavePreset, updatePreset as dbUpdatePreset, deletePreset as dbDeletePreset } from '@/stores/workspacePresetStorage';

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconFolder() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
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

function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
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

// ── StatusBadge ───────────────────────────────────────────────────────────────

function EnabledBadge({ enabled }: { enabled: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 20,
      fontSize: 11, fontWeight: 600, letterSpacing: '0.02em',
      background: enabled ? 'color-mix(in srgb, var(--success) 12%, transparent)' : 'color-mix(in srgb, var(--text-muted) 12%, transparent)',
      color: enabled ? 'var(--success)' : 'var(--text-muted)',
      border: `1px solid ${enabled ? 'color-mix(in srgb, var(--success) 30%, transparent)' : 'color-mix(in srgb, var(--text-muted) 20%, transparent)'}`,
    }}>
      {enabled ? (
        <>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          已启用
        </>
      ) : (
        <>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          已禁用
        </>
      )}
    </span>
  );
}

function InvalidBadge() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 20,
      fontSize: 11, fontWeight: 600,
      background: 'color-mix(in srgb, #f97316 12%, transparent)',
      color: '#f97316',
      border: '1px solid color-mix(in srgb, #f97316 30%, transparent)',
    }}>
      <IconWarning />
      已失效
    </span>
  );
}

// ── PresetCard ───────────────────────────────────────────────────────────────

interface PresetCardProps {
  preset: WorkspacePreset;
  configName: string;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function PresetCard({ preset, configName, onToggle, onEdit, onDelete }: PresetCardProps) {
  const [hovered, setHovered] = useState(false);
  const isInvalid = !preset.configId;

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
        opacity: preset.isEnabled ? 1 : 0.55,
        cursor: 'default',
      }}
    >
      {/* 图标 */}
      <div style={{
        width: 36, height: 36, borderRadius: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: isInvalid
          ? 'color-mix(in srgb, #f97316 12%, transparent)'
          : 'color-mix(in srgb, var(--accent) 10%, transparent)',
        color: isInvalid ? '#f97316' : 'var(--accent)',
        flexShrink: 0,
      }}>
        <IconFolder />
      </div>

      {/* 信息 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          marginBottom: 4,
        }}>
          {preset.workspacePath}
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {configName}
          </span>
          {isInvalid && <InvalidBadge />}
          {!isInvalid && <EnabledBadge enabled={preset.isEnabled} />}
          {preset.description && (
            <span style={{
              fontSize: 11, color: 'var(--text-muted)',
              padding: '1px 6px', borderRadius: 4,
              background: 'var(--border)', maxWidth: 160,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {preset.description}
            </span>
          )}
        </div>
      </div>

      {/* 操作 */}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <ActionButton
          title={preset.isEnabled ? '禁用' : '启用'}
          icon={preset.isEnabled ? <IconX /> : <IconCheck />}
          variant={preset.isEnabled ? 'default' : 'success'}
          onClick={onToggle}
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

interface ActionButtonProps {
  title: string;
  icon: React.ReactNode;
  variant: 'default' | 'success' | 'danger';
  onClick: () => void;
}

function ActionButton({ title, icon, variant, onClick }: ActionButtonProps) {
  const [hovered, setHovered] = useState(false);

  const colors = {
    default: { color: 'var(--text-secondary)', hoverBg: 'var(--bg-input)', hoverColor: 'var(--text-primary)' },
    success: { color: 'var(--success)', hoverBg: 'color-mix(in srgb, var(--success) 12%, transparent)', hoverColor: 'var(--success)' },
    danger: { color: 'var(--error)', hoverBg: 'color-mix(in srgb, var(--error) 12%, transparent)', hoverColor: 'var(--error)' },
  }[variant];

  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={title}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 30, height: 30, borderRadius: 6,
        background: hovered ? colors.hoverBg : 'transparent',
        color: hovered ? colors.hoverColor : colors.color,
        border: 'none',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
    >
      {icon}
    </button>
  );
}

// ── FormModal ────────────────────────────────────────────────────────────────

interface FormModalProps {
  editing: Partial<WorkspacePreset> | null;
  configs: ModelConfig[];
  onSave: () => void;
  onCancel: () => void;
  onChange: (partial: Partial<WorkspacePreset>) => void;
}

function FormModal({ editing, configs, onSave, onCancel, onChange }: FormModalProps) {
  const isEdit = !!editing?.id;
  const canSave = !!editing?.workspacePath?.trim() && !!editing?.configId;

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
          {isEdit ? '编辑预设' : '新建预设'}
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
        <Field label="工作目录路径" required>
          <ThemedInput
            placeholder="例如 /Users/ouguangji/project"
            value={editing?.workspacePath || ''}
            onChange={v => onChange({ workspacePath: v })}
          />
        </Field>

        <Field label="模型配置" required>
          <ThemedSelect
            value={editing?.configId || ''}
            onChange={v => onChange({ configId: v || null })}
            options={configs.map(c => ({ value: c.id, label: `${c.name} (${c.model})` }))}
            placeholder="选择模型配置"
          />
        </Field>

        <Field label="备注">
          <ThemedTextarea
            placeholder="可选描述，例如「前端项目」"
            value={editing?.description || ''}
            onChange={v => onChange({ description: v })}
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
        <ThemedButton variant="secondary" onClick={onCancel}>
          取消
        </ThemedButton>
        <ThemedButton
          variant="primary"
          onClick={onSave}
          disabled={!canSave}
        >
          {isEdit ? '保存更改' : '添加预设'}
        </ThemedButton>
      </div>
    </div>
  );
}

// ── Field ────────────────────────────────────────────────────────────────────

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{
        fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)',
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        {label}
        {required && (
          <span style={{ color: 'var(--error)', fontSize: 11 }}>*</span>
        )}
      </label>
      {children}
    </div>
  );
}

// ── ThemedInput ───────────────────────────────────────────────────────────────

function ThemedInput({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%',
        padding: '8px 12px',
        background: 'var(--bg-input)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        color: 'var(--text-primary)',
        fontSize: 13,
        fontFamily: 'inherit',
        outline: 'none',
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

// ── ThemedSelect ──────────────────────────────────────────────────────────────

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
        width: '100%',
        padding: '8px 12px',
        background: 'var(--bg-input)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        color: value ? 'var(--text-primary)' : 'var(--text-muted)',
        fontSize: 13,
        fontFamily: 'inherit',
        outline: 'none',
        cursor: 'pointer',
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

// ── ThemedTextarea ───────────────────────────────────────────────────────────

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
        width: '100%',
        padding: '8px 12px',
        background: 'var(--bg-input)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        color: 'var(--text-primary)',
        fontSize: 13,
        fontFamily: 'inherit',
        outline: 'none',
        resize: 'vertical',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        boxSizing: 'border-box',
        minHeight: 60,
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
  variant: 'primary' | 'secondary';
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);

  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '7px 16px', borderRadius: 8,
    fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
    border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.15s ease',
    opacity: disabled ? 0.5 : 1,
  };

  const primary = {
    ...base,
    background: hovered && !disabled ? 'var(--accent-dim)' : 'var(--accent)',
    color: 'white',
  };

  const secondary = {
    ...base,
    background: hovered ? 'var(--bg-input)' : 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={variant === 'primary' ? primary : secondary}
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
          暂无工作区预设
        </div>
        <div style={{ fontSize: 12 }}>
          添加预设后可在全局终端中向多个工作区<br />同时发送 prompt
        </div>
      </div>
      <ThemedButton variant="primary" onClick={onAdd}>
        <IconPlus />
        添加第一个预设
      </ThemedButton>
    </div>
  );
}

// ── StatsBar ─────────────────────────────────────────────────────────────────

function StatsBar({ presets }: { presets: WorkspacePreset[] }) {
  const enabled = presets.filter(p => p.isEnabled && p.configId).length;
  const total = presets.length;
  const invalid = presets.filter(p => !p.configId).length;

  return (
    <div style={{
      display: 'flex', gap: 12, padding: '0 0 12px 0',
      borderBottom: '1px solid var(--border)',
      marginBottom: 12,
    }}>
      <StatPill label="总计" value={total} />
      <StatPill label="启用" value={enabled} color="var(--success)" />
      {invalid > 0 && (
        <StatPill label="失效" value={invalid} color="#f97316" />
      )}
    </div>
  );
}

function StatPill({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      fontSize: 12,
    }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{
        fontWeight: 700, fontSize: 13,
        color: color || 'var(--text-primary)',
      }}>
        {value}
      </span>
    </div>
  );
}

// ── WorkspacePresetPanel ───────────────────────────────────────────────────────

export function WorkspacePresetPanel() {
  const [presets, setPresets] = useState<WorkspacePreset[]>([]);
  const [configs, setConfigs] = useState<ModelConfig[]>([]);
  const [editing, setEditing] = useState<Partial<WorkspacePreset> | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [presetsData, configsData] = await Promise.all([
        window.electron?.invoke
          ? window.electron.invoke('workspace-preset:get-all') as Promise<WorkspacePreset[]>
          : dbGetAllPresets(),
        window.electron?.invoke
          ? window.electron.invoke('model-config:get-all') as Promise<ModelConfig[]>
          : dbGetAllConfigs(),
      ]);
      setPresets(presetsData || []);
      setConfigs(configsData || []);
    } catch (err) {
      console.error('[WorkspacePresetPanel] Failed to load:', err);
    }
  }

  function getConfigName(configId: string | null): string {
    if (!configId) return '(配置已失效)';
    const config = configs.find(c => c.id === configId);
    return config ? `${config.name} (${config.model})` : '(配置已失效)';
  }

  async function handleSave() {
    if (!editing?.workspacePath?.trim() || !editing?.configId) return;
    try {
      if (editing.id) {
        if (window.electron?.invoke) {
          await window.electron.invoke('workspace-preset:update', editing.id, {
            workspacePath: editing.workspacePath,
            configId: editing.configId,
            description: editing.description,
          });
        } else {
          await dbUpdatePreset(editing.id, {
            workspacePath: editing.workspacePath,
            configId: editing.configId,
            description: editing.description,
          });
        }
      } else {
        if (window.electron?.invoke) {
          await window.electron.invoke('workspace-preset:save', {
            workspacePath: editing.workspacePath,
            configId: editing.configId,
            description: editing.description,
            isEnabled: true,
          });
        } else {
          await dbSavePreset({
            workspacePath: editing.workspacePath,
            configId: editing.configId,
            description: editing.description,
            isEnabled: true,
          });
        }
      }
      await loadData();
      setEditing(null);
    } catch (err) {
      console.error('[WorkspacePresetPanel] Save failed:', err);
    }
  }

  async function handleDelete(id: string) {
    try {
      if (window.electron?.invoke) {
        await window.electron.invoke('workspace-preset:delete', id);
      } else {
        await dbDeletePreset(id);
      }
      await loadData();
    } catch (err) {
      console.error('[WorkspacePresetPanel] Delete failed:', err);
    }
  }

  async function handleToggle(preset: WorkspacePreset) {
    try {
      if (window.electron?.invoke) {
        await window.electron.invoke('workspace-preset:update', preset.id, { isEnabled: !preset.isEnabled });
      } else {
        await dbUpdatePreset(preset.id, { isEnabled: !preset.isEnabled });
      }
      await loadData();
    } catch (err) {
      console.error('[WorkspacePresetPanel] Toggle failed:', err);
    }
  }

  return (
    <div style={{ padding: 16 }}>
      {presets.length > 0 && <StatsBar presets={presets} />}

      {/* 列表 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {presets.map(preset => (
          <PresetCard
            key={preset.id}
            preset={preset}
            configName={getConfigName(preset.configId)}
            onToggle={() => handleToggle(preset)}
            onEdit={() => setEditing(preset)}
            onDelete={() => handleDelete(preset.id)}
          />
        ))}
      </div>

      {/* 表单 */}
      {editing && (
        <FormModal
          editing={editing}
          configs={configs}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
          onChange={partial => setEditing(prev => prev ? { ...prev, ...partial } : partial)}
        />
      )}

      {/* 空状态 */}
      {presets.length === 0 && !editing && (
        <EmptyState onAdd={() => setEditing({ isEnabled: true })} />
      )}

      {/* 添加按钮 */}
      {presets.length > 0 && !editing && (
        <button
          onClick={() => setEditing({ isEnabled: true })}
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
          添加预设
        </button>
      )}
    </div>
  );
}
