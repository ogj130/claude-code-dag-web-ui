/**
 * 设置面板 — 主题 + Embedding 配置
 * 支持标签页切换：主题 / Embedding
 */
import { useState } from 'react';
import type { ThemeMode, AccentColor, Density, FontSize } from '../hooks/useTheme';
import { EmbeddingConfigPanel } from './EmbeddingConfigPanel';

// ── Props ────────────────────────────────────────────────────────────────────

interface ThemeSettingsProps {
  isOpen: boolean;
  /** 外部控制当前激活的标签页 */
  activeTab?: Tab;
  /** 标签页切换回调（外部控制时传入） */
  onTabChange?: (tab: Tab) => void;
  onClose: () => void;
  mode: ThemeMode;
  accent: AccentColor;
  density: Density;
  fontSize: FontSize;
  onModeChange: (m: ThemeMode) => void;
  onAccentChange: (a: AccentColor) => void;
  onDensityChange: (d: Density) => void;
  onFontSizeChange: (s: FontSize) => void;
}

// ── 常量 ───────────────────────────────────────────────────────────────────

const ACCENT_OPTIONS: { value: AccentColor; label: string; color: string }[] = [
  { value: 'blue',   label: '蓝', color: '#4a9eff' },
  { value: 'purple', label: '紫', color: '#8b5cf6' },
  { value: 'green',  label: '绿', color: '#22c55e' },
  { value: 'orange', label: '橙', color: '#f97316' },
  { value: 'red',    label: '红', color: '#ef4444' },
  { value: 'pink',   label: '粉', color: '#ec4899' },
];

const DENSITY_OPTIONS: { value: Density; label: string; desc: string }[] = [
  { value: 'compact',  label: '紧凑', desc: '节点更密集' },
  { value: 'standard', label: '标准', desc: '默认密度' },
  { value: 'loose',    label: '宽松', desc: '节点间距更大' },
];

const FONT_SIZE_OPTIONS: FontSize[] = [12, 13, 14, 15, 16, 17, 18];

const MODE_OPTIONS: { value: ThemeMode; label: string; icon: string }[] = [
  {
    value: 'dark',
    label: '暗黑',
    icon: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',
  },
  {
    value: 'light',
    label: '明亮',
    icon: 'M12 3v1m0 16v1m-8-9H3m18 0h-1M5.64 5.64L4.22 4.22m14.14 14.14l-1.42-1.42M5.64 18.36l-1.42 1.42m14.14-14.14l-1.42 1.42M12 8a4 4 0 100 8 4 4 0 000-8z',
  },
  {
    value: 'system',
    label: '跟随系统',
    icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  },
];

// ── 子组件 ─────────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 12,
      fontWeight: 600,
      color: 'var(--text-secondary)',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 10,
      marginTop: 4,
    }}>
      {children}
    </div>
  );
}

function OptionGroup({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: '14px 16px',
      background: 'var(--bg-input)',
      borderRadius: 8,
      marginBottom: 12,
    }}>
      {children}
    </div>
  );
}

// ── 标签页类型 ─────────────────────────────────────────────────────────────

type Tab = 'theme' | 'embedding';

const TABS: { key: Tab; label: string; icon: string }[] = [
  {
    key: 'theme',
    label: '主题',
    icon: 'M12 3v1m0 16v1m8.66-13.66l-.71.71M4.05 19.95l-.71.71M21 12h-1M4 12H3m16.66 6.66l-.71-.71M4.05 4.05l-.71-.71',
  },
  {
    key: 'embedding',
    label: 'Embedding',
    icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4',
  },
];

// ── 主题内容 ───────────────────────────────────────────────────────────────

function ThemeContent(props: Omit<ThemeSettingsProps, 'isOpen' | 'onClose'>) {
  const { mode, accent, density, fontSize, onModeChange, onAccentChange, onDensityChange, onFontSizeChange } = props;

  return (
    <>
      <OptionGroup>
        <SectionTitle>主题模式</SectionTitle>
        <div style={{ display: 'flex', gap: 8 }}>
          {MODE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => onModeChange(opt.value)}
              title={opt.label}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                padding: '10px 8px',
                borderRadius: 8,
                border: mode === opt.value ? '2px solid var(--accent)' : '1px solid var(--border)',
                background: mode === opt.value ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
                color: mode === opt.value ? 'var(--accent)' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontSize: 12,
                fontFamily: 'inherit',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d={opt.icon} />
              </svg>
              {opt.label}
            </button>
          ))}
        </div>
      </OptionGroup>

      <OptionGroup>
        <SectionTitle>主题色</SectionTitle>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {ACCENT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => onAccentChange(opt.value)}
              title={opt.label}
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                border: accent === opt.value ? `3px solid ${opt.color}` : '2px solid var(--border)',
                background: opt.color,
                cursor: 'pointer',
                transition: 'all 0.2s',
                position: 'relative',
                boxShadow: accent === opt.value ? `0 0 0 3px var(--bg-card), 0 0 0 5px ${opt.color}40` : 'none',
              }}
            >
              {accent === opt.value && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>
      </OptionGroup>

      <OptionGroup>
        <SectionTitle>节点密度</SectionTitle>
        <div style={{ display: 'flex', gap: 8 }}>
          {DENSITY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => onDensityChange(opt.value)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                padding: '10px 8px',
                borderRadius: 8,
                border: density === opt.value ? '2px solid var(--accent)' : '1px solid var(--border)',
                background: density === opt.value ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
                color: density === opt.value ? 'var(--accent)' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontSize: 12,
                fontFamily: 'inherit',
              }}
            >
              <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{opt.label}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{opt.desc}</span>
            </button>
          ))}
        </div>
      </OptionGroup>

      <OptionGroup>
        <SectionTitle>字体大小：{fontSize}px</SectionTitle>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>A</span>
          <input
            type="range"
            min={12}
            max={18}
            step={1}
            value={fontSize}
            onChange={e => onFontSizeChange(Number(e.target.value) as FontSize)}
            style={{ flex: 1, accentColor: 'var(--accent)', height: 4, cursor: 'pointer' }}
          />
          <span style={{ fontSize: 18, color: 'var(--text-muted)' }}>A</span>
          <span style={{ minWidth: 32, textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>
            {fontSize}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          {FONT_SIZE_OPTIONS.map(size => (
            <button
              key={size}
              onClick={() => onFontSizeChange(size)}
              style={{
                flex: 1,
                padding: '6px 0',
                borderRadius: 6,
                border: fontSize === size ? '2px solid var(--accent)' : '1px solid var(--border)',
                background: fontSize === size ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
                color: fontSize === size ? 'var(--accent)' : 'var(--text-muted)',
                fontSize: 12,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.2s',
              }}
            >
              {size}
            </button>
          ))}
        </div>
      </OptionGroup>
    </>
  );
}

// ── 主组件 ─────────────────────────────────────────────────────────────────

export function ThemeSettings(props: ThemeSettingsProps) {
  // 外部控制优先，内部 state 作为降级
  const [internalTab, setInternalTab] = useState<Tab>('theme');
  const activeTab = props.activeTab ?? internalTab;

  function handleTabChange(tab: Tab) {
    if (props.onTabChange) {
      props.onTabChange(tab);
    } else {
      setInternalTab(tab);
    }
  }

  if (!props.isOpen) return null;

  return (
    <>
      {/* 遮罩层 */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 999,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)',
        }}
        onClick={props.onClose}
      />
      {/* 设置面板 */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1000,
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '24px',
        width: 440,
        maxWidth: '90vw',
        maxHeight: '80vh',
        overflow: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
      }}>
        {/* 标题栏 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
            设置
          </h3>
          <button
            onClick={props.onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 标签页切换 */}
        <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: 8, padding: 3, marginBottom: 16, gap: 2 }}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '7px 12px',
                borderRadius: 6,
                border: 'none',
                background: activeTab === tab.key ? 'var(--bg-card)' : 'transparent',
                color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-muted)',
                fontSize: 12,
                fontWeight: activeTab === tab.key ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s',
                boxShadow: activeTab === tab.key ? '0 1px 4px rgba(0,0,0,0.15)' : 'none',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d={tab.icon} />
              </svg>
              {tab.label}
            </button>
          ))}
        </div>

        {/* 标签页内容 */}
        {activeTab === 'theme' ? (
          <ThemeContent {...props} />
        ) : (
          <div style={{ maxHeight: 'calc(80vh - 140px)', overflowY: 'auto' }}>
            <EmbeddingConfigPanel />
          </div>
        )}
      </div>
    </>
  );
}
