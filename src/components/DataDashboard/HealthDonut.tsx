/**
 * HealthDonut — 健康度环形图
 * Extracted from DataDashboard.tsx
 */

export interface HealthDonutProps {
  health: number;
}

export function HealthDonut({ health }: HealthDonutProps) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const fill = (health / 100) * circ;
  const color = health >= 80 ? '#4ade80' : health >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ position: 'relative', width: 88, height: 88, flexShrink: 0 }}>
      <svg width="88" height="88" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={r} fill="none" stroke="var(--bg-input)" strokeWidth="10" />
        <circle
          cx="44" cy="44" r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={`${fill} ${circ}`}
          strokeDashoffset={circ * 0.25}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
        <text x="44" y="40" textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--text-primary)" fontFamily="'JetBrains Mono', monospace">
          {health}%
        </text>
        <text x="44" y="53" textAnchor="middle" fontSize="8" fill="var(--text-muted)">
          健康度
        </text>
      </svg>
    </div>
  );
}
