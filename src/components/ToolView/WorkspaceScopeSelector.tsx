/**
 * WorkspaceScopeSelector — 工作区多选范围选择器
 *
 * 用于全局发送和分析范围选择，支持 disabled workspace 可见不可选
 */

import { useState } from 'react';

interface ScopeWorkspace {
  id: string;
  name: string;
  enabled: boolean;
}

interface WorkspaceScopeSelectorProps {
  label: string;
  workspaces: ScopeWorkspace[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

export function WorkspaceScopeSelector({
  label,
  workspaces,
  selectedIds,
  onChange,
  disabled,
}: WorkspaceScopeSelectorProps) {
  const [expanded, setExpanded] = useState(false);
  const enabledWs = workspaces.filter((ws) => ws.enabled);
  const selectedCount = selectedIds.filter((id) => workspaces.some((w) => w.id === id && w.enabled)).length;
  const total = enabledWs.length;

  const handleToggleAll = () => {
    if (selectedCount === total) {
      onChange([]);
    } else {
      onChange(enabledWs.map((ws) => ws.id));
    }
  };

  return (
    <div
      style={{
        fontSize: 12,
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm, 6px)',
        background: 'var(--bg-card)',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => setExpanded((v) => !v)}
        aria-label={label}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--text-secondary)',
          background: 'transparent',
          border: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <span>
          {label}（已选 {selectedCount}/{total}）
        </span>
        <span style={{ fontSize: 10, transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : undefined }}>
          ▼
        </span>
      </button>
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '2px 0',
            }}
          >
            <input
              type="checkbox"
              checked={selectedCount === total && total > 0}
              onChange={handleToggleAll}
              style={{ accentColor: 'var(--accent)' }}
            />
            全选
          </label>
          {workspaces.map((ws) => (
            <label
              key={ws.id}
              aria-label={ws.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
                color: ws.enabled ? 'var(--text-primary)' : 'var(--text-muted)',
                cursor: ws.enabled ? 'pointer' : 'not-allowed',
                opacity: ws.enabled ? 1 : 0.5,
                padding: '2px 0',
              }}
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(ws.id)}
                disabled={!ws.enabled}
                onChange={(e) => {
                  if (!ws.enabled) return;
                  const next = e.target.checked
                    ? [...selectedIds, ws.id]
                    : selectedIds.filter((id) => id !== ws.id);
                  onChange(next);
                }}
                style={{ accentColor: 'var(--accent)' }}
              />
              {ws.name}
              {!ws.enabled && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>(已禁用)</span>}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
