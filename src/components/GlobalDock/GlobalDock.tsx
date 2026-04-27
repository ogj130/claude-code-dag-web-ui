import { useState } from 'react';
import { DockItem } from './DockItem';

// Temporary mock SVG icon for stress testing
const MockIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
  </svg>
);

const MOCK_ITEMS = Array.from({ length: 23 }, (_, i) => ({
  id: `item-${i}`,
  label: `功能 ${i + 1}`,
  icon: MockIcon,
}));

function getItemScale(hoveredIndex: number | null, itemIndex: number): number {
  if (hoveredIndex === null) return 1;
  const distance = Math.abs(itemIndex - hoveredIndex);
  if (distance === 0) return 1.3;
  if (distance === 1) return 1.15;
  if (distance === 2) return 1.05;
  return 1;
}

export function GlobalDock() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  return (
    <div
      role="toolbar"
      aria-label="功能坞"
      onMouseLeave={() => setHoveredIndex(null)}
      style={{
        height: 52,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: '4px 12px',
        background: 'var(--bg-bar)',
        borderTop: '1px solid var(--border)',
        overflowX: 'auto',
        zIndex: 50,
        scrollbarWidth: 'none',
        flexShrink: 0,
      }}
    >
      {MOCK_ITEMS.map((item, index) => (
        <DockItem
          key={item.id}
          icon={item.icon}
          label={item.label}
          scale={getItemScale(hoveredIndex, index)}
          isHovered={hoveredIndex === index}
          isActive={activeItemId === item.id}
          onClick={() => setActiveItemId(prev => prev === item.id ? null : item.id)}
          onMouseEnter={() => setHoveredIndex(index)}
          onMouseLeave={() => setHoveredIndex(null)}
        />
      ))}
    </div>
  );
}
