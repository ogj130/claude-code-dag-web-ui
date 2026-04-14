import React from 'react';
import type { ModelConfig } from '@/types/models';

interface ConfirmSwitchDialogProps {
  targetConfig: ModelConfig;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmSwitchDialog({ targetConfig, onConfirm, onCancel }: ConfirmSwitchDialogProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        animation: 'fadeIn 150ms ease-out',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 12,
          padding: 24,
          maxWidth: 400,
          width: '90%',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          animation: 'scaleIn 200ms ease-out',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Warning Icon */}
        <div style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          backgroundColor: 'var(--warn-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--warn)" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>

        <h3 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)' }}>确认切换模型</h3>

        <p style={{ margin: '0 0 16px 0', color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.5 }}>
          切换模型将重启当前会话，当前对话上下文将丢失。
        </p>

        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 8,
          padding: 12,
          marginBottom: 20,
        }}>
          <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
            {targetConfig.name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {targetConfig.model} · {targetConfig.provider}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
              transition: 'all 150ms ease',
            }}
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              backgroundColor: 'var(--accent)',
              color: 'white',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
              transition: 'all 150ms ease',
            }}
          >
            确认切换
          </button>
        </div>
      </div>
    </div>
  );
}
