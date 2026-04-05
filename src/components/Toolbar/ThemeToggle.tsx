interface Props {
  theme: 'dark' | 'light';
  onChange: (t: 'dark' | 'light') => void;
}

export function ThemeToggle({ theme, onChange }: Props) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      background: 'var(--bg-input)',
      border: '1px solid var(--border)',
      borderRadius: 20,
      padding: 4,
    }}>
      <button
        onClick={() => onChange('dark')}
        title="暗黑模式"
        style={{
          width: 26, height: 26, borderRadius: '50%', border: 'none',
          background: theme === 'dark' ? 'var(--accent)' : 'transparent',
          color: theme === 'dark' ? 'white' : 'var(--text-dim)',
          cursor: 'pointer', fontSize: 13, transition: 'all 0.2s',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >🌙</button>
      <button
        onClick={() => onChange('light')}
        title="明亮模式"
        style={{
          width: 26, height: 26, borderRadius: '50%', border: 'none',
          background: theme === 'light' ? 'var(--accent)' : 'transparent',
          color: theme === 'light' ? 'white' : 'var(--text-dim)',
          cursor: 'pointer', fontSize: 13, transition: 'all 0.2s',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >☀️</button>
    </div>
  );
}
