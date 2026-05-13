/**
 * PanelSkeleton — RAG 检索面板骨架屏
 * Extracted from RAGRetrievalPanel.tsx
 */

export function PanelSkeleton() {
  return (
    <div style={{ padding: '14px' }}>
      {/* 筛选区 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        {[80, 60].map((w, i) => (
          <div key={i} style={{
            height: 10,
            width: `${w}%`,
            background: 'var(--bg-input)',
            borderRadius: 5,
            opacity: 0.5,
            animation: 'shimmer 1.5s infinite',
            backgroundImage: 'linear-gradient(90deg, var(--bg-input) 25%, var(--border) 50%, var(--bg-input) 75%)',
            backgroundSize: '200% 100%',
          }} />
        ))}
      </div>
      {/* 结果占位 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[90, 70, 85, 65].map((w, i) => (
          <div key={i} style={{
            height: 60,
            width: `${w}%`,
            background: 'var(--bg-input)',
            borderRadius: 8,
            opacity: 0.4,
            animation: 'shimmer 1.5s infinite',
            backgroundImage: 'linear-gradient(90deg, var(--bg-input) 25%, var(--border) 50%, var(--bg-input) 75%)',
            backgroundSize: '200% 100%',
          }} />
        ))}
      </div>
    </div>
  );
}
