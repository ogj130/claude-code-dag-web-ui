import React, { useEffect, useState, useRef, useCallback } from 'react';

interface DockDrawerProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Optional navigation tabs */
  navTabs?: { id: string; label: string }[];
  activeNavTab?: string;
  onNavTabChange?: (id: string) => void;
  /** Breadcrumb text for footer */
  breadcrumb?: string;
}

export function DockDrawer({
  isOpen,
  title,
  onClose,
  children,
  navTabs,
  activeNavTab,
  onNavTabChange,
  breadcrumb,
}: DockDrawerProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [visible, setVisible] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const hasNav = !!(navTabs && navTabs.length > 0);

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsAnimating(true));
      });
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => setVisible(false), 280);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Close on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (visible) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [visible, handleKeyDown]);

  // Lock body scroll while open
  useEffect(() => {
    if (visible) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <>
      {/* Keyframe animations */}
      <style>{`
        @keyframes dock-drawer-slide-in {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes dock-drawer-slide-out {
          from { transform: translateX(0); }
          to { transform: translateX(100%); }
        }
        @keyframes dock-drawer-backdrop-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes dock-drawer-backdrop-out {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .dock-drawer-backdrop,
          .dock-drawer-panel {
            animation: none !important;
            transition: none !important;
          }
        }
        .dock-drawer-content::-webkit-scrollbar {
          width: 6px;
        }
        .dock-drawer-content::-webkit-scrollbar-track {
          background: transparent;
        }
        .dock-drawer-content::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.15);
          border-radius: 3px;
        }
        .dock-drawer-content::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.25);
        }
      `}</style>

      {/* Backdrop */}
      <div
        className="dock-drawer-backdrop"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1000,
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          animation: isAnimating
            ? 'dock-drawer-backdrop-in 280ms cubic-bezier(0.16, 1, 0.3, 1) forwards'
            : 'dock-drawer-backdrop-out 280ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        className="dock-drawer-panel"
        role="dialog"
        aria-label={title}
        aria-modal="true"
        style={{
          position: 'fixed',
          top: 0,
          bottom: 0,
          right: 0,
          width: hasNav ? 760 : 620,
          maxWidth: '100vw',
          zIndex: 1001,
          background: 'var(--bg-card)',
          borderLeft: '1px solid var(--border)',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: isAnimating
            ? 'dock-drawer-slide-in 280ms cubic-bezier(0.16, 1, 0.3, 1) forwards'
            : 'dock-drawer-slide-out 280ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
            minHeight: 52,
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </h3>
          <button
            onClick={onClose}
            aria-label="关闭"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              padding: 0,
              background: 'none',
              border: 'none',
              borderRadius: 6,
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
              flexShrink: 0,
              transition: 'color 0.15s, background 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text-primary)';
              e.currentTarget.style.background = 'var(--bg-input)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-muted)';
              e.currentTarget.style.background = 'none';
            }}
          >
            ✕
          </button>
        </div>

        {/* Optional nav tabs */}
        {hasNav && (
          <div
            style={{
              display: 'flex',
              gap: 0,
              padding: '0 20px',
              borderBottom: '1px solid var(--border)',
              flexShrink: 0,
              overflowX: 'auto',
              scrollbarWidth: 'none',
            }}
          >
            {navTabs!.map((tab) => {
              const isActive = tab.id === activeNavTab;
              return (
                <button
                  key={tab.id}
                  onClick={() => onNavTabChange?.(tab.id)}
                  style={{
                    position: 'relative',
                    padding: '10px 16px',
                    background: 'none',
                    border: 'none',
                    borderBottom: isActive ? '2px solid var(--accent, #3B82F6)' : '2px solid transparent',
                    color: isActive ? 'var(--accent, #3B82F6)' : 'var(--text-secondary)',
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 400,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'color 0.15s, border-color 0.15s',
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.color = 'var(--text-primary)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.color = 'var(--text-secondary)';
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Content */}
        <div
          className="dock-drawer-content"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 20,
          }}
        >
          {children}
        </div>

        {/* Optional footer with breadcrumb */}
        {breadcrumb && (
          <div
            style={{
              padding: '10px 20px',
              borderTop: '1px solid var(--border)',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              fontSize: 12,
              color: 'var(--text-muted)',
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {breadcrumb}
            </span>
          </div>
        )}
      </div>
    </>
  );
}
