/**
 * WorkspacePresetEmptyState — 空状态占位组件
 * Extracted from WorkspacePresetPanel.tsx
 */

import { IconSparkle, IconPlus } from './WorkspacePresetIcons';
import { ThemedButton } from './WorkspacePresetFormKit';

export function EmptyState({ onAdd }: { onAdd: () => void }) {
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
