/**
 * WorkspaceStatsBar — 预设统计栏 + StatPill
 * Extracted from WorkspacePresetPanel.tsx
 */

import type { WorkspacePreset } from '@/types/models';

function StatPill({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontWeight: 700, fontSize: 13, color: color || 'var(--text-primary)' }}>
        {value}
      </span>
    </div>
  );
}

export function StatsBar({ presets }: { presets: WorkspacePreset[] }) {
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
      {invalid > 0 && <StatPill label="失效" value={invalid} color="#f97316" />}
    </div>
  );
}
