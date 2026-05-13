/**
 * WorkspacePresetBadges — 状态徽章组件
 * Extracted from WorkspacePresetPanel.tsx
 */

import { IconWarning } from './WorkspacePresetIcons';

export function EnabledBadge({ enabled }: { enabled: boolean }) {
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

export function InvalidBadge() {
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
