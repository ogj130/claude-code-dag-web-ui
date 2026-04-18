/**
 * RoastCard — Agent 吐槽卡片
 */

interface RoastCardProps {
  roast: string;
}

export function RoastCard({ roast }: RoastCardProps) {
  return (
    <div style={{
      background: 'rgba(239, 68, 68, 0.06)',
      border: '1px solid rgba(239, 68, 68, 0.2)',
      borderRadius: 12,
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <div style={{
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--error)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        Agent 吐槽
      </div>
      <div style={{
        fontSize: 12,
        color: 'var(--text-secondary)',
        lineHeight: 1.7,
        fontStyle: 'italic',
        whiteSpace: 'pre-wrap',
      }}>
        {roast}
      </div>
    </div>
  );
}
