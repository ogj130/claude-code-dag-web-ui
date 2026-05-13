/**
 * KPICard — KPI 指标卡片
 * Extracted from DataDashboard.tsx
 */

export interface KPICardProps {
  label: string;
  value: string | number;
  accent?: boolean;
  mono?: boolean;
  subValue?: string;
}

export function KPICard({ label, value, accent = false, mono = true, subValue }: KPICardProps) {
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${accent ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 10,
        padding: '14px 16px',
        flex: 1,
        minWidth: 100,
        transition: 'transform 0.2s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; }}
    >
      <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: accent ? 'var(--accent)' : 'var(--text-primary)',
          fontFamily: mono ? "'JetBrains Mono', monospace" : 'inherit',
        }}
      >
        {value}
      </div>
      {subValue && (
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{subValue}</div>
      )}
    </div>
  );
}
