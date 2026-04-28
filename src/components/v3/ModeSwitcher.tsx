/**
 * ModeSwitcher — 双模式切换器
 *
 * 切换初级模式（Guided）/ 专家模式（Expert），带动画过渡。
 * V3 首次启动默认专家模式（与 V2 兼容）。
 * 所有样式使用内联 style + CSS 变量（本项目未安装 Tailwind CSS）。
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

export type AppMode = 'guided' | 'expert';

interface ModeSwitcherProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
}

const GuidedIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
    strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </svg>
);

const ExpertIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
    strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20V10" />
    <path d="M18 20V4" />
    <path d="M6 20v-4" />
  </svg>
);

const cardBase: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  padding: '16px 24px',
  minWidth: 140,
  border: '1px solid var(--border)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'all 0.3s ease-out',
};

export const ModeSwitcher: React.FC<ModeSwitcherProps> = ({ mode, onModeChange }) => {
  const { t } = useTranslation();
  const [isAnimating, setIsAnimating] = useState(false);
  const isGuided = mode === 'guided';

  const handleToggle = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    onModeChange(isGuided ? 'expert' : 'guided');
    setTimeout(() => setIsAnimating(false), 300);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '12px 0', userSelect: 'none' }}>
      {/* Mode cards row */}
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        {/* Guided card */}
        <button
          onClick={isGuided ? undefined : handleToggle}
          disabled={isAnimating}
          style={{
            ...cardBase,
            borderRadius: '10px 0 0 10px',
            background: isGuided
              ? 'linear-gradient(180deg, var(--accent-dim) 0%, rgba(59, 130, 246, 0.05) 100%)'
              : 'var(--bg-card)',
            borderColor: isGuided ? 'var(--accent)' : 'var(--border)',
            color: isGuided ? 'var(--text-primary)' : 'var(--text-muted)',
            zIndex: isGuided ? 10 : 1,
            boxShadow: isGuided ? '0 0 20px var(--accent-dim)' : 'none',
          }}
          onMouseEnter={e => {
            if (!isGuided) {
              e.currentTarget.style.background = 'var(--bg-card-hover)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }
          }}
          onMouseLeave={e => {
            if (!isGuided) {
              e.currentTarget.style.background = 'var(--bg-card)';
              e.currentTarget.style.color = 'var(--text-muted)';
            }
          }}
        >
          <span style={{
            display: 'flex',
            transition: 'all 0.3s ease-out',
            color: isGuided ? 'var(--accent)' : 'currentColor',
            transform: isGuided ? 'scale(1.1)' : 'scale(1)',
          }}>
            <GuidedIcon />
          </span>
          <span style={{
            fontSize: 14,
            fontWeight: 500,
            transition: 'all 0.3s ease-out',
            color: isGuided ? 'var(--accent)' : 'inherit',
          }}>
            {t('mode.guided')}
          </span>
          <span style={{
            fontSize: 10,
            lineHeight: 1.4,
            textAlign: 'center',
            transition: 'all 0.3s ease-out',
            color: isGuided ? 'var(--text-secondary)' : 'var(--text-muted)',
          }}>
            分步引导，新手友好
          </span>
        </button>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ width: 1, height: 32, background: 'var(--border)' }} />
        </div>

        {/* Expert card */}
        <button
          onClick={!isGuided ? undefined : handleToggle}
          disabled={isAnimating}
          style={{
            ...cardBase,
            borderRadius: '0 10px 10px 0',
            background: !isGuided
              ? 'linear-gradient(180deg, rgba(168, 85, 247, 0.2) 0%, rgba(168, 85, 247, 0.05) 100%)'
              : 'var(--bg-card)',
            borderColor: !isGuided ? 'rgba(168, 85, 247, 0.4)' : 'var(--border)',
            color: !isGuided ? 'var(--text-primary)' : 'var(--text-muted)',
            zIndex: !isGuided ? 10 : 1,
            boxShadow: !isGuided ? '0 0 20px rgba(168, 85, 247, 0.12)' : 'none',
          }}
          onMouseEnter={e => {
            if (isGuided) {
              e.currentTarget.style.background = 'var(--bg-card-hover)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }
          }}
          onMouseLeave={e => {
            if (isGuided) {
              e.currentTarget.style.background = 'var(--bg-card)';
              e.currentTarget.style.color = 'var(--text-muted)';
            }
          }}
        >
          <span style={{
            display: 'flex',
            transition: 'all 0.3s ease-out',
            color: !isGuided ? '#A78BFA' : 'currentColor',
            transform: !isGuided ? 'scale(1.1)' : 'scale(1)',
          }}>
            <ExpertIcon />
          </span>
          <span style={{
            fontSize: 14,
            fontWeight: 500,
            transition: 'all 0.3s ease-out',
            color: !isGuided ? '#A78BFA' : 'inherit',
          }}>
            {t('mode.expert')}
          </span>
          <span style={{
            fontSize: 10,
            lineHeight: 1.4,
            textAlign: 'center',
            transition: 'all 0.3s ease-out',
            color: !isGuided ? 'var(--text-secondary)' : 'var(--text-muted)',
          }}>
            全量控制，高效工作
          </span>
        </button>
      </div>

      {/* Active mode indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
        <span style={{
          display: 'inline-block',
          width: 6,
          height: 6,
          borderRadius: '50%',
          transition: 'all 0.3s ease-out',
          background: isGuided ? 'var(--accent)' : 'var(--text-muted)',
          boxShadow: isGuided ? '0 0 6px var(--accent-dim)' : 'none',
        }} />
        <span style={{ transition: 'all 0.5s ease-out' }}>
          {isGuided
            ? t('mode.current_guided', '当前：初级模式 — AI 会逐步引导您完成每个操作')
            : t('mode.current_expert', '当前：专家模式 — 您拥有完全的控制权和灵活性')}
        </span>
      </div>
    </div>
  );
};
