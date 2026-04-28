/**
 * ProfilePanel — 用户画像面板
 *
 * 透明展示 AI 对用户的理解，支持手动修正。
 * 含置信度条形图 + 导出功能。
 * 所有样式使用内联 style + CSS 变量（本项目未安装 Tailwind CSS）。
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getConfidenceColor } from './v3DesignTokens';

interface ProfileDimension {
  key: string;
  label: string;
  value: string;
  confidence: number;
  isManual: boolean;
}

interface ProfilePanelProps {
  workspaceId?: string;
}

const DEMO_DIMENSIONS: ProfileDimension[] = [
  { key: 'language', label: '偏好语言', value: 'TypeScript, Python', confidence: 0.92, isManual: false },
  { key: 'framework', label: '常用框架', value: 'React, Next.js, Express', confidence: 0.85, isManual: false },
  { key: 'pattern', label: '设计模式', value: 'MVC, Repository, Hooks', confidence: 0.68, isManual: false },
  { key: 'naming', label: '命名风格', value: 'camelCase', confidence: 0.95, isManual: false },
  { key: 'debugging', label: '调试习惯', value: 'Console.log → 断点调试', confidence: 0.73, isManual: false },
  { key: 'skill_level', label: '技能水平', value: '高级', confidence: 0.80, isManual: false },
  { key: 'verbosity', label: '注释风格', value: '简洁型（关键处注释）', confidence: 0.61, isManual: false },
  { key: 'testing', label: '测试偏好', value: 'TDD（先写测试）', confidence: 0.77, isManual: false },
];

const EditIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
    strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
    strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

export const ProfilePanel: React.FC<ProfilePanelProps> = () => {
  const { t } = useTranslation();
  const [dimensions, setDimensions] = useState(DEMO_DIMENSIONS);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleEdit = (dim: ProfileDimension) => {
    setEditingKey(dim.key);
    setEditValue(dim.value);
  };

  const handleSave = (key: string) => {
    setDimensions((prev) =>
      prev.map((d) =>
        d.key === key ? { ...d, value: editValue, isManual: true, confidence: 1.0 } : d
      )
    );
    setEditingKey(null);
  };

  const handleExport = () => {
    const data = JSON.stringify(dimensions, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'user-profile.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>
            {t('profile.title')}
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
            {t('profile.subtitle')}
          </p>
        </div>
        <button
          onClick={handleExport}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            fontSize: 13,
            borderRadius: 6,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'all 0.15s ease-out',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--bg-card-hover)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'var(--bg-card)';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          <DownloadIcon />
          {t('profile.export')}
        </button>
      </div>

      {/* Profile dimensions grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 10,
      }}>
        {dimensions.map((dim) => {
          const confidenceColor = getConfidenceColor(dim.confidence);
          return (
            <div
              key={dim.key}
              style={{
                padding: 12,
                borderRadius: 8,
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                transition: 'all 0.15s ease-out',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--border-hover)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
            >
              {/* Label row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.04em' }}>
                  {dim.label}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {dim.isManual && (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '1px 6px',
                      fontSize: 9,
                      borderRadius: 4,
                      background: 'rgba(251, 191, 36, 0.15)',
                      color: '#FBBF24',
                      border: '1px solid rgba(251, 191, 36, 0.25)',
                      fontWeight: 500,
                    }}>
                      {t('profile.manual_badge')}
                    </span>
                  )}
                  <button
                    onClick={() => handleEdit(dim)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3,
                      fontSize: 11,
                      color: 'var(--accent)',
                      opacity: 0,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      padding: 0,
                      transition: 'opacity 0.15s ease-out',
                    }}
                    className="v3-profile-edit-btn"
                    onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '0'; }}
                  >
                    <EditIcon />
                    {dim.isManual ? t('common.edit') : ''}
                  </button>
                </div>
              </div>

              {/* Value */}
              {editingKey === dim.key ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleSave(dim.key)}
                    style={{
                      flex: 1,
                      padding: '5px 8px',
                      fontSize: 13,
                      borderRadius: 6,
                      background: 'var(--bg-input)',
                      border: '1px solid var(--accent)',
                      color: 'var(--text-primary)',
                      outline: 'none',
                      fontFamily: 'inherit',
                    }}
                  />
                  <button
                    onClick={() => handleSave(dim.key)}
                    style={{
                      padding: '5px 10px',
                      fontSize: 12,
                      borderRadius: 6,
                      background: 'var(--accent-dim)',
                      border: '1px solid var(--accent)',
                      color: 'var(--accent)',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontWeight: 500,
                    }}
                  >
                    {t('common.save')}
                  </button>
                  <button
                    onClick={() => setEditingKey(null)}
                    style={{
                      padding: '5px 8px',
                      fontSize: 12,
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              ) : (
                <p style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>
                  {dim.value}
                </p>
              )}

              {/* Confidence bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  flex: 1,
                  height: 5,
                  borderRadius: 3,
                  background: 'var(--bg-input)',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    borderRadius: 3,
                    width: `${dim.confidence * 100}%`,
                    background: confidenceColor === 'green' ? '#34D399'
                      : confidenceColor === 'yellow' ? '#FBBF24'
                      : '#F87171',
                    transition: 'width 0.5s ease-out',
                  }} />
                </div>
                <span style={{
                  fontSize: 10,
                  fontFamily: '"JetBrains Mono", monospace',
                  color: 'var(--text-muted)',
                  width: 32,
                  textAlign: 'right',
                }}>
                  {Math.round(dim.confidence * 100)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Reset button */}
      <button
        onClick={() => setDimensions(DEMO_DIMENSIONS)}
        style={{
          width: '100%',
          padding: '8px 0',
          fontSize: 12,
          color: 'rgba(248, 113, 113, 0.5)',
          background: 'none',
          border: '1px solid transparent',
          borderRadius: 8,
          cursor: 'pointer',
          fontFamily: 'inherit',
          transition: 'all 0.15s ease-out',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.color = '#F87171';
          e.currentTarget.style.borderColor = 'rgba(248, 113, 113, 0.2)';
          e.currentTarget.style.background = 'rgba(248, 113, 113, 0.05)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.color = 'rgba(248, 113, 113, 0.5)';
          e.currentTarget.style.borderColor = 'transparent';
          e.currentTarget.style.background = 'none';
        }}
      >
        {t('profile.reset')}
      </button>
    </div>
  );
};
