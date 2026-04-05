import React from 'react';
import { TerminalView } from './TerminalView';
import { ToolCards } from './ToolCards';

interface Props {
  viewMode: 'terminal' | 'cards';
  onViewModeChange: (m: 'terminal' | 'cards') => void;
  style?: React.CSSProperties;
}

export function ToolViewPanel({ viewMode, onViewModeChange, style }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-root)', ...style }}>
      <div style={{
        display: 'flex', borderBottom: '1px solid var(--border)',
        padding: '0 12px', background: 'var(--bg-bar)',
      }}>
        {(['terminal', 'cards'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => onViewModeChange(tab)}
            style={{
              padding: '10px 14px', fontSize: 12, cursor: 'pointer',
              color: viewMode === tab ? 'var(--accent)' : 'var(--text-dim)',
              borderBottom: `2px solid ${viewMode === tab ? 'var(--accent)' : 'transparent'}`,
              background: 'transparent', border: 'none', borderTop: 0, borderRight: 0, borderLeft: 0,
              borderRadius: 0, marginBottom: -1,
              transition: 'all 0.2s', fontFamily: 'inherit',
            }}
          >
            {tab === 'terminal' ? '终端' : '卡片'}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {viewMode === 'terminal' ? <TerminalView /> : <ToolCards />}
      </div>
    </div>
  );
}
