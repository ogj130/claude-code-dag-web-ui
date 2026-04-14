import { useState } from 'react';
import { ModelConfigPanel } from './ModelConfigPanel';
import { WorkspacePresetPanel } from './WorkspacePresetPanel';

type Tab = 'configs' | 'presets';

interface ModelSettingsTabProps {
  onClose: () => void;
}

export function ModelSettingsTab({ onClose }: ModelSettingsTabProps) {
  const [activeTab, setActiveTab] = useState<Tab>('configs');

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: 'var(--bg-primary)',
    }}>
      {/* Tab 头部 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-color)',
      }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => setActiveTab('configs')}
            style={{
              padding: '6px 16px',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: activeTab === 'configs' ? 600 : 400,
              backgroundColor: activeTab === 'configs' ? 'var(--accent)' : 'transparent',
              color: activeTab === 'configs' ? 'white' : 'var(--text-primary)',
            }}
          >
            模型配置
          </button>
          <button
            onClick={() => setActiveTab('presets')}
            style={{
              padding: '6px 16px',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: activeTab === 'presets' ? 600 : 400,
              backgroundColor: activeTab === 'presets' ? 'var(--accent)' : 'transparent',
              color: activeTab === 'presets' ? 'white' : 'var(--text-primary)',
            }}
          >
            工作目录预设
          </button>
        </div>
        <button
          onClick={onClose}
          style={{
            padding: '4px 12px',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            backgroundColor: 'var(--bg-secondary)',
          }}
        >
          关闭
        </button>
      </div>

      {/* Tab 内容 */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {activeTab === 'configs' && <ModelConfigPanel />}
        {activeTab === 'presets' && <WorkspacePresetPanel />}
      </div>
    </div>
  );
}
