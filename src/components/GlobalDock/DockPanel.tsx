import React, { useEffect, useState } from 'react';

interface DockPanelProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export function DockPanel({ isOpen, title, onClose, children }: DockPanelProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      requestAnimationFrame(() => setIsAnimating(true));
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => setVisible(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!visible) return null;

  return (
    <>
      {/* Invisible backdrop — click to close */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99,
          background: 'transparent',
        }}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-label={title}
        aria-modal="false"
        style={{
          position: 'fixed',
          bottom: 60,
          left: '50%',
          transform: `translateX(-50%) ${isAnimating ? 'translateY(0)' : 'translateY(8px)'}`,
          width: 'calc(100vw - 32px)',
          maxWidth: 480,
          maxHeight: 'min(70vh, 600px)',
          minHeight: 200,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
          opacity: isAnimating ? 1 : 0,
          transition: 'opacity 0.25s ease-out, transform 0.25s ease-out',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Title bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
            {title}
          </h3>
          <button
            onClick={onClose}
            aria-label="关闭面板"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 18,
              padding: '4px 8px',
              borderRadius: 4,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          {children}
        </div>
      </div>
    </>
  );
}
