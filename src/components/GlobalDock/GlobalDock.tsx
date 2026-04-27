import React, { useState } from 'react';
import { DockItem } from './DockItem';
import { DOCK_GROUPS } from './dockConfig';
import { useDockStore } from '@/stores/useDockStore';

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
  const activeItemId = useDockStore(s => s.activeItemId);
  const openPanel = useDockStore(s => s.openPanel);

  return (
    <>
      {/* Keyframe animations -- single <style> tag for all Dock animations */}
      <style>{`
        @keyframes dock-glow-pulse {
          0%, 100% { box-shadow: 0 0 6px rgba(59,130,246,0.3); }
          50% { box-shadow: 0 0 14px rgba(59,130,246,0.6); }
        }
        @keyframes dock-panel-slide-up {
          from { opacity: 0; transform: translateX(-50%) translateY(12px) scale(0.97); }
          to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
        @keyframes dock-panel-slide-down {
          from { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
          to { opacity: 0; transform: translateX(-50%) translateY(8px) scale(0.97); }
        }
        .dock-scroll::-webkit-scrollbar { display: none; }
      `}</style>

      <div
        role="toolbar"
        aria-label="功能坞"
        className="dock-scroll"
        onMouseLeave={() => setHoveredIndex(null)}
        style={{
          height: 52,
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          padding: '4px 12px',
          background: 'var(--bg-bar)',
          borderTop: '1px solid var(--border)',
          overflowX: 'auto',
          zIndex: 50,
          scrollbarWidth: 'none',
          flexShrink: 0,
        }}
      >
        {DOCK_GROUPS.map((group, groupIdx) => (
          <React.Fragment key={group.groupId}>
            {groupIdx > 0 && (
              <div
                role="separator"
                style={{
                  width: 1,
                  height: 28,
                  background: 'var(--border)',
                  margin: '0 6px',
                  flexShrink: 0,
                }}
              />
            )}
            <DockItem
              icon={group.icon}
              label={group.label}
              scale={getItemScale(hoveredIndex, groupIdx)}
              isHovered={hoveredIndex === groupIdx}
              isActive={activeItemId === group.groupId}
              onClick={() => openPanel(group.groupId)}
              onMouseEnter={() => setHoveredIndex(groupIdx)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
          </React.Fragment>
        ))}
      </div>
    </>
  );
}
