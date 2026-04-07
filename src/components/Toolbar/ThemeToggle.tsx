interface Props {
  theme: 'dark' | 'light';
  onChange: (t: 'dark' | 'light') => void;
}

// Inline SVG icons — no emoji, consistent stroke style
function MoonIcon({ size = 14 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function SunIcon({ size = 14 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

export function ThemeToggle({ theme, onChange }: Props) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4,
      background: 'var(--bg-input)', border: '1px solid var(--border)',
      borderRadius: 20, padding: 4,
    }}>
      <button
        onClick={() => onChange('dark')}
        title="暗黑模式"
        style={{
          width: 26, height: 26, borderRadius: '50%', border: 'none',
          background: theme === 'dark' ? 'var(--accent)' : 'transparent',
          color: theme === 'dark' ? 'white' : 'var(--text-dim)',
          cursor: 'pointer', transition: 'all 0.2s',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      ><MoonIcon size={13} /></button>
      <button
        onClick={() => onChange('light')}
        title="明亮模式"
        style={{
          width: 26, height: 26, borderRadius: '50%', border: 'none',
          background: theme === 'light' ? 'var(--accent)' : 'transparent',
          color: theme === 'light' ? 'white' : 'var(--text-dim)',
          cursor: 'pointer', transition: 'all 0.2s',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      ><SunIcon size={13} /></button>
    </div>
  );
}
