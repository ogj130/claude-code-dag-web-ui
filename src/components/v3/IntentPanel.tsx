/**
 * IntentPanel — 意图解析面板
 *
 * 可视化展示 AI 如何理解用户输入，用户可修正误解析的实体。
 * 所有样式使用内联 style + CSS 变量（本项目未安装 Tailwind CSS）。
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { getConfidenceColor, TYPE_COLORS } from './v3DesignTokens';

export interface IntentResult {
  type: string;
  confidence: number;
  entities: Record<string, unknown>;
  suggestions?: string[];
  source?: string;
}

interface IntentPanelProps {
  intent: IntentResult;
  inputText: string;
  onCorrect?: (entity: string, newValue: string) => void;
}

const PencilIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
    strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
  </svg>
);

export const IntentPanel: React.FC<IntentPanelProps> = ({ intent, inputText, onCorrect }) => {
  const { t } = useTranslation();
  const typeLabel = t(`intent.type.${intent.type}`, intent.type);
  const typeColor = TYPE_COLORS[intent.type] ?? TYPE_COLORS.query;
  const confidenceColor = getConfidenceColor(intent.confidence);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header: type badge + confidence bar */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          padding: '4px 10px',
          borderRadius: 6,
          fontSize: 11,
          fontFamily: '"JetBrains Mono", monospace',
          ...parseTypeColor(typeColor),
        }}>
          {typeLabel}
        </div>

        {/* Confidence bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 48 }}>{t('intent.confidence_label')}</span>
          <div style={{
            flex: 1,
            height: 6,
            borderRadius: 3,
            background: 'var(--bg-input)',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              borderRadius: 3,
              width: `${intent.confidence * 100}%`,
              background: confidenceColor === 'green' ? '#34D399'
                : confidenceColor === 'yellow' ? '#FBBF24'
                : '#F87171',
              transition: 'width 0.5s ease-out',
            }} />
          </div>
          <span style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', color: 'var(--text-muted)', width: 32, textAlign: 'right' }}>
            {Math.round(intent.confidence * 100)}%
          </span>
        </div>
      </div>

      {/* Input quote card */}
      <div style={{
        padding: '10px 14px',
        borderRadius: 8,
        background: 'var(--bg-input)',
        border: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 6,
      }}>
        <span style={{ color: 'var(--accent)', fontSize: 13, opacity: 0.5, lineHeight: '20px' }}>"</span>
        <p style={{
          margin: 0,
          fontSize: 13,
          color: 'var(--text-secondary)',
          fontFamily: '"JetBrains Mono", monospace',
          fontStyle: 'italic',
          lineHeight: 1.6,
          flex: 1,
        }}>
          {inputText}
        </p>
        <span style={{ color: 'var(--accent)', fontSize: 13, opacity: 0.5, lineHeight: '20px', alignSelf: 'flex-end' }}>"</span>
      </div>

      {/* Entities section */}
      {Object.keys(intent.entities).length > 0 && (
        <div>
          <span style={{
            fontSize: 10,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            display: 'block',
            marginBottom: 8,
          }}>
            {t('intent.entities_label')}
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {Object.entries(intent.entities).map(([key, value]) => (
              <button
                key={key}
                onClick={() => onCorrect?.(key, String(value))}
                title={t('intent.click_to_correct')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '5px 10px',
                  fontSize: 12,
                  borderRadius: 6,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s ease-out',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'var(--accent-dim)';
                  e.currentTarget.style.borderColor = 'var(--accent)';
                  e.currentTarget.style.color = 'var(--accent)';
                  const icon = e.currentTarget.querySelector('.v3-entity-edit-icon') as HTMLElement;
                  if (icon) icon.style.opacity = '1';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'var(--bg-card)';
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                  const icon = e.currentTarget.querySelector('.v3-entity-edit-icon') as HTMLElement;
                  if (icon) icon.style.opacity = '0';
                }}
              >
                <span style={{ color: 'var(--text-muted)' }}>{key}:</span>
                <span>{String(value)}</span>
                <span className="v3-entity-edit-icon" style={{
                  opacity: 0,
                  transition: 'opacity 0.15s ease-out',
                  display: 'flex',
                  color: 'var(--accent)',
                }}>
                  <PencilIcon />
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions */}
      {intent.suggestions && intent.suggestions.length > 0 && (
        <div>
          <span style={{
            fontSize: 10,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            display: 'block',
            marginBottom: 8,
          }}>
            {t('intent.suggestions', '建议操作')}
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {intent.suggestions.map((s, i) => (
              <span
                key={i}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  borderRadius: 12,
                  background: 'var(--accent-dim)',
                  border: '1px solid var(--accent)',
                  borderColor: 'var(--accent)',
                  color: 'var(--text-secondary)',
                }}
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// 解析 TYPE_COLORS 字符串（格式如 "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"）
function parseTypeColor(cls: string): React.CSSProperties {
  const style: React.CSSProperties = {};
  if (cls.includes('text-emerald-400')) style.color = '#34D399';
  else if (cls.includes('text-red-400')) style.color = '#F87171';
  else if (cls.includes('text-amber-400')) style.color = '#FBBF24';
  else if (cls.includes('text-blue-400')) style.color = '#60A5FA';
  else if (cls.includes('text-purple-400')) style.color = '#A78BFA';
  else if (cls.includes('text-[var(--accent)]')) style.color = 'var(--accent)';
  else style.color = 'var(--text-muted)';

  if (cls.includes('bg-emerald-500/15')) style.background = 'rgba(52, 211, 153, 0.15)';
  else if (cls.includes('bg-red-500/15')) style.background = 'rgba(248, 113, 113, 0.15)';
  else if (cls.includes('bg-amber-500/15')) style.background = 'rgba(251, 191, 36, 0.15)';
  else if (cls.includes('bg-blue-500/15')) style.background = 'rgba(96, 165, 250, 0.15)';
  else if (cls.includes('bg-purple-500/15')) style.background = 'rgba(167, 139, 250, 0.15)';
  else if (cls.includes('bg-[var(--accent)]/15')) style.background = 'var(--accent-dim)';
  else style.background = 'var(--bg-card-hover)';

  if (cls.includes('border-emerald-500/25')) style.borderColor = 'rgba(52, 211, 153, 0.25)';
  else if (cls.includes('border-red-500/25')) style.borderColor = 'rgba(248, 113, 113, 0.25)';
  else if (cls.includes('border-amber-500/25')) style.borderColor = 'rgba(251, 191, 36, 0.25)';
  else if (cls.includes('border-blue-500/25')) style.borderColor = 'rgba(96, 165, 250, 0.25)';
  else if (cls.includes('border-purple-500/25')) style.borderColor = 'rgba(167, 139, 250, 0.25)';
  else if (cls.includes('border-[var(--accent)]/25')) style.borderColor = 'var(--accent)';
  else style.borderColor = 'transparent';

  return style;
}
