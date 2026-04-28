/**
 * SkillRecommendationCard — Skill 推荐卡片
 *
 * 支持内联卡片和侧面板两种展示模式。
 * 所有样式使用内联 style + CSS 变量（本项目未安装 Tailwind CSS）。
 */

import { useTranslation } from 'react-i18next';
import { type Skill } from '../../services/skillStore';

export type CardMode = 'inline' | 'panel';

export interface SkillRecommendationCardProps {
  skill: Skill;
  mode?: CardMode;
  onUse?: (skillId: string) => void;
  onDetail?: (skillId: string) => void;
  className?: string;
}

const SOURCE_LABELS: Record<Skill['source'], string> = {
  user_created: 'skill.source.user_created',
  llm_extracted: 'skill.source.llm_extracted',
  imported: 'skill.source.imported',
};

const STATUS_STYLES: Record<Skill['status'], { bg: string; color: string; border: string }> = {
  active: { bg: 'rgba(52, 211, 153, 0.1)', color: '#34D399', border: 'rgba(52, 211, 153, 0.2)' },
  deprecated: { bg: 'rgba(148, 163, 184, 0.1)', color: '#64748B', border: 'rgba(148, 163, 184, 0.15)' },
  draft: { bg: 'rgba(251, 191, 36, 0.1)', color: '#FBBF24', border: 'rgba(251, 191, 36, 0.2)' },
};

export default function SkillRecommendationCard({
  skill,
  mode = 'inline',
  onUse,
  onDetail,
}: SkillRecommendationCardProps) {
  const { t } = useTranslation();
  const successRate = skill.usageStats.totalCalls > 0
    ? `${(skill.usageStats.successRate * 100).toFixed(0)}%`
    : 'N/A';

  const isInline = mode === 'inline';
  const statusStyle = STATUS_STYLES[skill.status];

  return (
    <div style={{
      borderRadius: 8,
      border: '1px solid var(--border-card)',
      background: 'var(--bg-card)',
      padding: isInline ? 12 : 16,
      transition: 'all 0.15s ease-out',
    }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--border-hover)';
        e.currentTarget.style.background = 'var(--bg-card-hover)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border-card)';
        e.currentTarget.style.background = 'var(--bg-card)';
      }}
    >
      {/* 头部 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <h4 style={{
              margin: 0,
              fontSize: isInline ? 12 : 14,
              fontWeight: 500,
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {skill.name}
            </h4>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '1px 8px',
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 500,
              background: statusStyle.bg,
              color: statusStyle.color,
              border: `1px solid ${statusStyle.border}`,
            }}>
              {t(`skill.status.${skill.status}`, skill.status)}
            </span>
          </div>
          {skill.description && (
            <p style={{
              margin: 0,
              fontSize: isInline ? 10 : 12,
              color: '#64748B',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}>
              {skill.description}
            </p>
          )}
        </div>
      </div>

      {/* 统计 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontSize: 10,
        color: '#64748B',
        marginBottom: 8,
      }}>
        <span>{t(SOURCE_LABELS[skill.source])}</span>
        <span>v{skill.version}</span>
        <span>{skill.usageStats.totalCalls} {t('skill.calls')}</span>
        <span>{t('skill.success_rate')} {successRate}</span>
      </div>

      {/* 标签 */}
      {skill.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
          {skill.tags.slice(0, isInline ? 3 : 10).map((tag) => (
            <span key={tag} style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '1px 8px',
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 500,
              background: 'rgba(148, 163, 184, 0.1)',
              color: '#64748B',
              border: '1px solid rgba(148, 163, 184, 0.15)',
            }}>
              {tag}
            </span>
          ))}
          {skill.tags.length > 3 && isInline && (
            <span style={{ fontSize: 10, color: '#64748B' }}>+{skill.tags.length - 3}</span>
          )}
        </div>
      )}

      {/* 操作按钮 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {onUse && (
          <button
            onClick={() => onUse(skill.id)}
            style={{
              fontSize: 10,
              padding: '4px 10px',
              borderRadius: 6,
              background: 'rgba(59, 130, 246, 0.15)',
              color: '#60A5FA',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.15s ease-out',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.25)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)'; }}
          >
            {t('skill.use')}
          </button>
        )}
        {onDetail && (
          <button
            onClick={() => onDetail(skill.id)}
            style={{
              fontSize: 10,
              padding: '4px 10px',
              borderRadius: 6,
              background: '#1E293B',
              color: '#94A3B8',
              border: '1px solid rgba(148, 163, 184, 0.1)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.15s ease-out',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#334155'; e.currentTarget.style.color = '#F1F5F9'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#1E293B'; e.currentTarget.style.color = '#94A3B8'; }}
          >
            {t('common.detail')}
          </button>
        )}
      </div>
    </div>
  );
}
