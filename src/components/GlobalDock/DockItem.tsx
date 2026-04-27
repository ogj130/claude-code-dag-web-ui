import React, { memo } from 'react';

interface DockItemProps {
  icon: React.ReactNode;
  label: string;
  scale: number;
  isHovered: boolean;
  isActive: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export const DockItem = memo(function DockItem({
  icon,
  label,
  scale,
  isHovered,
  isActive,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: DockItemProps) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      role="button"
      aria-pressed={isActive}
      aria-label={label}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 44,
        height: 44,
        flexShrink: 0,
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        transform: `scale(${scale})`,
        transition: 'transform 0.15s ease-out',
        outline: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* Tooltip label — absolute positioned above icon, not in flex flow */}
      <span
        style={{
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: 4,
          padding: '2px 8px',
          borderRadius: 4,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          color: 'var(--text-primary)',
          fontSize: 11,
          whiteSpace: 'nowrap',
          opacity: isHovered ? 1 : 0,
          transition: 'opacity 0.15s ease-out',
          pointerEvents: 'none',
          zIndex: 100,
        }}
      >
        {label}
      </span>

      {/* Icon wrapper — color changes on active */}
      <span
        style={{
          color: isActive ? 'var(--accent, #3B82F6)' : 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'color 0.2s',
        }}
      >
        {icon}
      </span>

      {/* Active indicator glow bar at bottom */}
      {isActive && (
        <span
          style={{
            position: 'absolute',
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 6,
            height: 3,
            borderRadius: '0 0 3px 3px',
            background: 'var(--accent, #3B82F6)',
            boxShadow: '0 0 8px var(--accent-glow, rgba(59,130,246,0.4))',
          }}
        />
      )}
    </button>
  );
});
