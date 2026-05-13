/**
 * WorkspacePresetFormKit — 表单组件套件
 * Extracted from WorkspacePresetPanel.tsx
 * Contains: FormModal, Field, ThemedInput, ThemedSelect, ThemedTextarea, ThemedButton
 */

import { useState } from 'react';
import type { WorkspacePreset, ModelConfig } from '@/types/models';
import { IconX } from './WorkspacePresetIcons';

// ── Field ──

export function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
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

// ── ThemedInput ──

export function ThemedInput({ value, onChange, placeholder }: {
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

// ── ThemedSelect ──

export function ThemedSelect({ value, onChange, options, placeholder }: {
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

// ── ThemedTextarea ──

export function ThemedTextarea({ value, onChange, placeholder, rows = 3 }: {
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

// ── ThemedButton ──

export function ThemedButton({ variant, onClick, disabled, children }: {
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

// ── FormModal ──

interface FormModalProps {
  editing: Partial<WorkspacePreset> | null;
  configs: ModelConfig[];
  onSave: () => void;
  onCancel: () => void;
  onChange: (partial: Partial<WorkspacePreset>) => void;
}

export function FormModal({ editing, configs, onSave, onCancel, onChange }: FormModalProps) {
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
        <ThemedButton variant="primary" onClick={onSave} disabled={!canSave}>
          {isEdit ? '保存更改' : '添加预设'}
        </ThemedButton>
      </div>
    </div>
  );
}
