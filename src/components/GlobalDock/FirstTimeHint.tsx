import { useState } from 'react';
import { hasSeenHint, markHintSeen, getFeatureHint } from './featureHints';

interface Props {
  featureId: string;
}

export function FirstTimeHint({ featureId }: Props) {
  const [dismissed, setDismissed] = useState(hasSeenHint(featureId));
  const hint = getFeatureHint(featureId);

  if (dismissed || !hint) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '10px 14px', borderRadius: 8, marginBottom: 14,
      background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
      border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
    }}>
      <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1.4 }}>💡</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
          {hint.title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {hint.body}
        </div>
      </div>
      <button
        onClick={() => {
          markHintSeen(featureId);
          setDismissed(true);
        }}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', fontSize: 11, fontFamily: 'inherit',
          whiteSpace: 'nowrap', padding: '2px 6px', flexShrink: 0,
          alignSelf: 'flex-start',
        }}
      >
        不再显示
      </button>
    </div>
  );
}
