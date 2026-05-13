/**
 * WorkspacePresetCard — 工作区预设卡片 + ActionButton
 * Extracted from WorkspacePresetPanel.tsx
 */

import { useState } from 'react';
import type { WorkspacePreset } from '@/types/models';
import { IconFolder, IconEdit, IconTrash, IconX, IconCheck } from './WorkspacePresetIcons';
import { EnabledBadge, InvalidBadge } from './WorkspacePresetBadges';

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

interface PresetCardProps {
  preset: WorkspacePreset;
  configName: string;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function PresetCard({ preset, configName, onToggle, onEdit, onDelete }: PresetCardProps) {
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

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          marginBottom: 4,
        }}>
          {preset.workspacePath}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
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

      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <ActionButton
          title={preset.isEnabled ? '禁用' : '启用'}
          icon={preset.isEnabled ? <IconX /> : <IconCheck />}
          variant={preset.isEnabled ? 'default' : 'success'}
          onClick={onToggle}
        />
        <ActionButton title="编辑" icon={<IconEdit />} variant="default" onClick={onEdit} />
        <ActionButton title="删除" icon={<IconTrash />} variant="danger" onClick={onDelete} />
      </div>
    </div>
  );
}
