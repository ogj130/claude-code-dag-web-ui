import React from 'react';
import { TerminalView } from './TerminalView';
import { ToolCards } from './ToolCards';
import { TerminalIcon, GridIcon } from '../Icons';

interface Props {
  viewMode: 'terminal' | 'cards';
  onViewModeChange: (m: 'terminal' | 'cards') => void;
  theme: 'dark' | 'light';
  onInput?: (input: string) => void;
  style?: React.CSSProperties;
}

const TABS = [
  { key: 'terminal' as const, label: '终端', Icon: TerminalIcon },
  { key: 'cards' as const, label: '卡片', Icon: GridIcon },
];

export function ToolViewPanel({ viewMode, onViewModeChange, theme, onInput, style }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-root)', ...style }}>
      {/* Tab 栏 */}
      <div style={{
        display: 'flex',
        background: 'var(--bg-bar)',
        borderBottom: '1px solid var(--border)',
        padding: '0 12px',
        position: 'relative',
        transition: 'background 0.3s',
      }}>
        {TABS.map(({ key, label, Icon }) => {
          const active = viewMode === key;
          return (
            <button
              key={key}
              onClick={() => onViewModeChange(key)}
              aria-label={label}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '11px 14px',
                background: 'transparent',
                border: 'none',
                borderBottom: '2px solid transparent',
                marginBottom: -1,
                color: active ? 'var(--accent)' : 'var(--text-dim)',
                fontSize: 12, fontWeight: active ? 600 : 400,
                cursor: 'pointer',
                transition: 'color 0.2s, border-color 0.2s',
                fontFamily: 'inherit',
                letterSpacing: '0.02em',
              }}
            >
              <Icon size={14} style={{
                opacity: active ? 1 : 0.55,
                transition: 'opacity 0.2s',
                flexShrink: 0,
              }} />
              {label}
            </button>
          );
        })}
      </div>

      {/* 内容区 */}
      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {viewMode === 'terminal'
          ? <TerminalView theme={theme} onInput={onInput} />
          : <ToolCards />
        }
      </div>
    </div>
  );
}
