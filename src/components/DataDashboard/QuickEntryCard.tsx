/**
 * QuickEntryCard — 快速入口卡片
 * Extracted from DataDashboard.tsx
 */

export interface QuickEntryCardProps {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

export function QuickEntryCard({ label, icon, onClick }: QuickEntryCardProps) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        minWidth: 80,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        padding: '14px 8px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        cursor: 'pointer',
        transition: 'all 0.15s',
        color: 'var(--text-secondary)',
      }}
      onMouseEnter={e => {
        const btn = e.currentTarget as HTMLButtonElement;
        btn.style.borderColor = 'var(--accent)';
        btn.style.background = 'var(--bg-input)';
        btn.style.color = 'var(--accent)';
        btn.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={e => {
        const btn = e.currentTarget as HTMLButtonElement;
        btn.style.borderColor = 'var(--border)';
        btn.style.background = 'var(--bg-card)';
        btn.style.color = 'var(--text-secondary)';
        btn.style.transform = 'translateY(0)';
      }}
    >
      <div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </div>
      <span style={{ fontSize: 10, fontWeight: 600 }}>{label}</span>
    </button>
  );
}
