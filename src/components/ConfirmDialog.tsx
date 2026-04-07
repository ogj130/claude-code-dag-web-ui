import React from 'react';

interface ButtonDef {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'danger' | 'ghost';
}

interface Props {
  title: string;
  message: React.ReactNode;
  buttons: ButtonDef[];
}

export function ConfirmDialog({ title, message, buttons }: Props) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '24px 28px',
        minWidth: 360, maxWidth: 480,
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <h3 style={{
          margin: '0 0 12px',
          fontSize: 15, fontWeight: 600,
          color: 'var(--text-primary)',
        }}>{title}</h3>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
          {message}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {buttons.map((btn, i) => (
            <button
              key={i}
              onClick={btn.onClick}
              style={{
                padding: '7px 16px', borderRadius: 7, fontSize: 12,
                cursor: 'pointer', fontFamily: 'inherit',
                border: btn.variant === 'ghost' ? 'none' : '1px solid',
                background: btn.variant === 'danger'
                  ? 'var(--error)'
                  : btn.variant === 'ghost'
                  ? 'transparent'
                  : 'var(--bg-input)',
                color: btn.variant === 'danger'
                  ? 'white'
                  : btn.variant === 'ghost'
                  ? 'var(--text-dim)'
                  : 'var(--text-primary)',
                borderColor: btn.variant === 'danger'
                  ? 'var(--error)'
                  : 'var(--border)',
                fontWeight: btn.variant === 'danger' ? 600 : 400,
                transition: 'all 0.15s',
              }}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
