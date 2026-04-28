import React, { useEffect, useState, useRef, useCallback } from 'react';

interface DockModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Optional tab bar */
  tabs?: { id: string; label: string }[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  /** Optional footer actions */
  footer?: React.ReactNode;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function DockModal({
  isOpen,
  title,
  onClose,
  children,
  tabs,
  activeTab,
  onTabChange,
  footer,
}: DockModalProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [visible, setVisible] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const hasTabs = !!(tabs && tabs.length > 0);

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      setVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsAnimating(true));
      });
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => {
        setVisible(false);
        // Restore focus to previously active element
        if (previousActiveElement.current && typeof previousActiveElement.current.focus === 'function') {
          previousActiveElement.current.focus();
        }
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Focus trap: when modal opens, focus first focusable or the modal itself
  useEffect(() => {
    if (!visible || !isAnimating) return;
    const raf = requestAnimationFrame(() => {
      if (modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        if (focusable.length > 0) {
          focusable[0].focus();
        } else {
          modalRef.current.focus();
        }
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [visible, isAnimating]);

  // Keyboard: Escape closes, Tab cycles within modal
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
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
        @keyframes dock-modal-backdrop-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes dock-modal-backdrop-out {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes dock-modal-enter {
          from {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.95) translateY(8px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1) translateY(0);
          }
        }
        @keyframes dock-modal-exit {
          from {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1) translateY(0);
          }
          to {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.95) translateY(8px);
          }
        }
        @keyframes dock-modal-tab-underline-in {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .dock-modal-backdrop,
          .dock-modal-panel {
            animation: none !important;
            transition: none !important;
          }
        }
        .dock-modal-content::-webkit-scrollbar {
          width: 6px;
        }
        .dock-modal-content::-webkit-scrollbar-track {
          background: transparent;
        }
        .dock-modal-content::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.15);
          border-radius: 3px;
        }
        .dock-modal-content::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.25);
        }
      `}</style>

      {/* Backdrop */}
      <div
        className="dock-modal-backdrop"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1000,
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          animation: isAnimating
            ? 'dock-modal-backdrop-in 250ms cubic-bezier(0.16, 1, 0.3, 1) forwards'
            : 'dock-modal-backdrop-out 250ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}
      />

      {/* Modal panel */}
      <div
        ref={modalRef}
        className="dock-modal-panel"
        role="dialog"
        aria-label={title}
        aria-modal="true"
        tabIndex={-1}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(80vw, 1100px)',
          height: 'min(85vh, 800px)',
          minWidth: 500,
          minHeight: 360,
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100vh - 32px)',
          zIndex: 1001,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          boxShadow: '0 8px 48px rgba(0,0,0,0.45)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: isAnimating
            ? 'dock-modal-enter 250ms cubic-bezier(0.16, 1, 0.3, 1) forwards'
            : 'dock-modal-exit 250ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
          outline: 'none',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
            minHeight: 56,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 600,
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </h2>
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

        {/* Optional tab bar — horizontal segmented control style */}
        {hasTabs && (
          <div
            style={{
              display: 'flex',
              gap: 4,
              padding: '8px 24px',
              borderBottom: '1px solid var(--border)',
              flexShrink: 0,
              overflowX: 'auto',
              scrollbarWidth: 'none',
            }}
          >
            {tabs!.map((tab) => {
              const isActive = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange?.(tab.id)}
                  style={{
                    padding: '8px 18px',
                    background: isActive ? 'var(--accent, #3B82F6)' : 'var(--bg-input)',
                    border: isActive
                      ? '1px solid var(--accent, #3B82F6)'
                      : '1px solid transparent',
                    borderRadius: 8,
                    color: isActive ? '#fff' : 'var(--text-secondary)',
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 400,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'background 0.15s, color 0.15s, border-color 0.15s',
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'var(--border)';
                      e.currentTarget.style.color = 'var(--text-primary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'var(--bg-input)';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }
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
          className="dock-modal-content"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 24,
          }}
        >
          {children}
        </div>

        {/* Optional footer with action buttons */}
        {footer && (
          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border)',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 12,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </>
  );
}
