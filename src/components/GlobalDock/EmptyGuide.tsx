import React from 'react';
import { getFeatureHint } from './featureHints';

interface Props {
  featureId: string;
  icon?: React.ReactNode;
  onAction?: () => void;
}

export function EmptyGuide({ featureId, icon, onAction }: Props) {
  const hint = getFeatureHint(featureId);

  if (!hint) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 24 }}>
        暂无数据
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '32px 20px', gap: 12,
      textAlign: 'center', minHeight: 200,
    }}>
      {icon && (
        <span style={{ opacity: 0.4, display: 'flex', marginBottom: 4 }}>
          {icon}
        </span>
      )}
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
        {hint.emptyTitle}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 320 }}>
        {hint.body}
      </div>

      {hint.emptySteps.length > 0 && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 6,
          marginTop: 8, textAlign: 'left', width: '100%', maxWidth: 340,
        }}>
          {hint.emptySteps.map((step, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              fontSize: 12, color: 'var(--text-secondary)',
            }}>
              <span style={{
                width: 20, height: 20, borderRadius: '50%',
                background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
                color: 'var(--accent)', fontSize: 11, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {i + 1}
              </span>
              <span style={{ lineHeight: 1.5, paddingTop: 1 }}>{step}</span>
            </div>
          ))}
        </div>
      )}

      {hint.emptyActionLabel && onAction && (
        <button
          onClick={onAction}
          style={{
            marginTop: 12, padding: '8px 20px', borderRadius: 8,
            background: 'var(--accent)', color: 'white', border: 'none',
            cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
            fontWeight: 500,
          }}
        >
          {hint.emptyActionLabel}
        </button>
      )}
    </div>
  );
}
