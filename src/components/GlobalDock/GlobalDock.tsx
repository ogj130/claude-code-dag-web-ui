import React, { useState, useCallback } from 'react';
import { DockItem } from './DockItem';
import { DOCK_GROUPS } from './dockConfig';
import { useDockStore } from '@/stores/useDockStore';
import { useModeStore } from '@/stores/useModeStore';

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
  const mode = useModeStore(s => s.mode);
  const visibleGroups = mode === 'guided'
    ? DOCK_GROUPS.filter(g => g.groupId === 'core' || g.groupId === 'system')
    : DOCK_GROUPS;

  // Mouse-move event delegation: find closest button to cursor position
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const buttons = container.querySelectorAll('[role="button"]');
    const containerRect = container.getBoundingClientRect();

    let closestIndex: number | null = null;
    let closestDistance = Infinity;

    buttons.forEach((btn, index) => {
      const rect = btn.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const distance = Math.abs(e.clientX - centerX);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    setHoveredIndex(closestIndex);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredIndex(null);
  }, []);

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
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
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
        {visibleGroups.map((group, groupIdx) => (
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
            />
          </React.Fragment>
        ))}
      </div>
    </>
  );
}
