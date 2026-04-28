/**
 * WorkingMemoryPanel — 工作记忆可视化面板
 *
 * 展示当前工作记忆条目、Token 使用量、自动压缩状态。
 * 支持条目的查看、编辑、删除操作。
 * 所有样式使用内联 style + CSS 变量（本项目未安装 Tailwind CSS）。
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useWorkingMemoryStore,
  useWorkingMemoryEntries,
  useWorkingMemoryTokens,
  type WorkingMemoryEntry,
} from '../../stores/useWorkingMemoryStore';

// ── 条目类型配色 ────────────────────────────────────────────

const TYPE_STYLES: Record<WorkingMemoryEntry['type'], { labelKey: string; bg: string; color: string; border: string }> = {
  context:     { labelKey: 'memory.type.context',     bg: 'rgba(96, 165, 250, 0.1)',  color: '#60A5FA', border: 'rgba(96, 165, 250, 0.2)' },
  instruction: { labelKey: 'memory.type.instruction',  bg: 'rgba(52, 211, 153, 0.1)', color: '#34D399', border: 'rgba(52, 211, 153, 0.2)' },
  constraint:  { labelKey: 'memory.type.constraint',   bg: 'rgba(248, 113, 113, 0.1)', color: '#F87171', border: 'rgba(248, 113, 113, 0.2)' },
  reference:   { labelKey: 'memory.type.reference',    bg: 'rgba(167, 139, 250, 0.1)', color: '#A78BFA', border: 'rgba(167, 139, 250, 0.2)' },
  checkpoint:  { labelKey: 'memory.type.checkpoint',   bg: 'rgba(251, 191, 36, 0.1)',  color: '#FBBF24', border: 'rgba(251, 191, 36, 0.2)' },
};

// ── 单条记忆卡片 ──────────────────────────────────────────

function EntryCard({
  entry,
  onRemove,
}: {
  entry: WorkingMemoryEntry;
  onRemove: (id: string) => void;
}) {
  const { t } = useTranslation();
  const style = TYPE_STYLES[entry.type] ?? TYPE_STYLES.context;

  return (
    <div
      style={{
        padding: 12,
        borderRadius: 6,
        border: '1px solid rgba(148, 163, 184, 0.1)',
        background: '#0F172A',
        transition: 'all 0.15s ease-out',
        position: 'relative',
      }}
      onMouseEnter={e => {
        const delBtn = e.currentTarget.querySelector('.v3-wm-del-btn') as HTMLElement;
        if (delBtn) delBtn.style.opacity = '1';
      }}
      onMouseLeave={e => {
        const delBtn = e.currentTarget.querySelector('.v3-wm-del-btn') as HTMLElement;
        if (delBtn) delBtn.style.opacity = '0';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '1px 8px',
            borderRadius: 4,
            fontSize: 10,
            fontWeight: 500,
            background: style.bg,
            color: style.color,
            border: `1px solid ${style.border}`,
          }}>
            {t(style.labelKey)}
          </span>
          <span style={{ fontSize: 10, color: '#64748B' }}>p{entry.priority}</span>
          <span style={{ fontSize: 10, color: '#64748B' }}>~{entry.tokenEstimate} tok</span>
        </div>
        <button
          onClick={() => onRemove(entry.id)}
          className="v3-wm-del-btn"
          style={{
            opacity: 0,
            fontSize: 10,
            color: 'rgba(248, 113, 113, 0.6)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            padding: '2px 4px',
            transition: 'all 0.15s ease-out',
            borderRadius: 4,
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#F87171'; e.currentTarget.style.background = 'rgba(248,113,113,0.1)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(248, 113, 113, 0.6)'; e.currentTarget.style.background = 'none'; }}
        >
          {t('common.delete')}
        </button>
      </div>
      <p style={{
        margin: 0,
        fontSize: 12,
        color: '#94A3B8',
        lineHeight: 1.6,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
      }}>
        {entry.content.length > 200 ? entry.content.slice(0, 200) + '...' : entry.content}
      </p>
    </div>
  );
}

// ── 主组件 ────────────────────────────────────────────────

export const WorkingMemoryPanel: React.FC = () => {
  const { t } = useTranslation();
  const entries = useWorkingMemoryEntries();
  const totalTokens = useWorkingMemoryTokens();
  const { contextUsage, getCompressionStatus, removeEntry, clearEntries, serialize } = useWorkingMemoryStore();
  const [showSerialized, setShowSerialized] = useState(false);

  const status = getCompressionStatus();
  const usagePct = contextUsage.usagePct;
  const MAX_TOKENS = contextUsage.estimatedWindow;

  const statusConfig: Record<string, { color: 'red' | 'yellow' | 'green'; labelKey: string; textColor: string }> = {
    critical:    { color: 'red', labelKey: 'memory.status.critical',    textColor: '#F87171' },
    warning:     { color: 'yellow', labelKey: 'memory.status.warning',  textColor: '#FBBF24' },
    normal:      { color: 'green', labelKey: 'memory.status.ok',        textColor: '#34D399' },
    compressing: { color: 'yellow', labelKey: 'memory.status.compressing', textColor: '#FBBF24' },
  };
  const currentStatus = statusConfig[status] ?? statusConfig.normal;

  const statusBarColor = currentStatus.color === 'red' ? '#F87171'
    : currentStatus.color === 'yellow' ? '#FBBF24'
    : '#34D399';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      padding: 16,
      gap: 8,
    }}>
      {/* 标题 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{
          margin: 0,
          fontSize: 14,
          fontWeight: 600,
          color: '#F1F5F9',
        }}>
          {t('memory.working')}
        </h2>
        <span style={{ fontSize: 10, color: '#64748B' }}>
          {entries.length} {t('memory.entries_count')}
        </span>
      </div>

      {/* Token 使用概览 */}
      <div style={{
        padding: 12,
        borderRadius: 6,
        border: '1px solid rgba(148, 163, 184, 0.1)',
        background: '#0F172A',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
          <span style={{ color: '#94A3B8' }}>{t('memory.token_usage')}</span>
          <span style={{ color: '#94A3B8', fontFamily: '"JetBrains Mono", monospace' }}>
            {totalTokens.toLocaleString()} / {(MAX_TOKENS / 1000).toFixed(0)}k
          </span>
        </div>
        <div style={{
          height: 8,
          borderRadius: 4,
          background: 'var(--bg-input)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            borderRadius: 4,
            background: statusBarColor,
            width: `${Math.min(usagePct, 100)}%`,
            transition: 'width 0.5s ease-out',
          }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10 }}>
          <span style={{ color: currentStatus.textColor }}>
            {t(currentStatus.labelKey)} ({usagePct.toFixed(1)}%)
          </span>
          {status === 'critical' && (
            <span style={{ color: '#F87171', animation: 'pulseDot 1.2s ease-in-out infinite' }}>
              {t('memory.need_compression')}
            </span>
          )}
        </div>
      </div>

      {/* 条目列表 */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        {entries.length === 0 ? (
          <div style={{
            textAlign: 'center',
            fontSize: 12,
            color: '#64748B',
            padding: '32px 0',
          }}>
            {t('memory.no_results')}
          </div>
        ) : (
          entries.map((entry) => (
            <EntryCard key={entry.id} entry={entry} onRemove={removeEntry} />
          ))
        )}
      </div>

      {/* 底部操作栏 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        paddingTop: 8,
        borderTop: '1px solid var(--border)',
      }}>
        <button
          onClick={() => setShowSerialized(!showSerialized)}
          style={{
            flex: 1,
            padding: '6px 0',
            fontSize: 10,
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
          {showSerialized ? t('common.hide') : t('common.view')}{t('memory.serialize')}
        </button>
        <button
          onClick={clearEntries}
          style={{
            flex: 1,
            padding: '6px 0',
            fontSize: 10,
            borderRadius: 6,
            background: 'rgba(248, 113, 113, 0.1)',
            color: '#F87171',
            border: '1px solid rgba(248, 113, 113, 0.2)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'all 0.15s ease-out',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248, 113, 113, 0.2)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(248, 113, 113, 0.1)'; }}
        >
          {t('memory.clear_all')}
        </button>
      </div>

      {/* 序列化预览 */}
      {showSerialized && (
        <div style={{
          padding: 12,
          borderRadius: 6,
          background: '#050508',
          border: '1px solid rgba(148, 163, 184, 0.1)',
          maxHeight: 160,
          overflowY: 'auto',
        }}>
          <pre style={{
            margin: 0,
            fontSize: 10,
            color: '#64748B',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            fontFamily: '"JetBrains Mono", monospace',
          }}>
            {serialize() || `(${t('common.empty')})`}
          </pre>
        </div>
      )}
    </div>
  );
};
