/**
 * ExpertModeLayout — 专家模式布局
 *
 * 终端 + Agent 画布 + 高级面板。
 * 默认布局与 V2 一致，确保向后兼容。
 * 所有样式使用内联 style + CSS 变量（本项目未安装 Tailwind CSS）。
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

interface ExpertModeLayoutProps {
  children?: React.ReactNode;
}

const TabItem: React.FC<{ label: string; active?: boolean }> = ({ label, active }) => (
  <button
    style={{
      padding: '6px 12px',
      fontSize: 14,
      borderRadius: 6,
      border: active ? '1px solid rgba(168, 85, 247, 0.25)' : 'none',
      background: active ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
      color: active ? '#C4B5FD' : '#94A3B8',
      cursor: 'pointer',
      fontFamily: 'inherit',
      transition: 'all 0.15s ease-out',
    }}
    onMouseEnter={e => {
      if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#CBD5E1'; }
    }}
    onMouseLeave={e => {
      if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94A3B8'; }
    }}
  >
    {label}
  </button>
);

export const ExpertModeLayout: React.FC<ExpertModeLayoutProps> = ({ children }) => {
  const { t } = useTranslation();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 专家模式 Tab 栏 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '8px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.04)',
      }}>
        <TabItem label={t('expert.terminal')} active />
        <TabItem label={t('expert.agent_canvas')} />
        <TabItem label={t('expert.hooks')} />
        <TabItem label={t('expert.mcp')} />
      </div>

      {/* 内容区 — 默认渲染 V2 现有内容 */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {children ?? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#64748B',
            fontSize: 14,
          }}>
            {t('expert.terminal')} — V2 兼容模式
          </div>
        )}
      </div>
    </div>
  );
};
