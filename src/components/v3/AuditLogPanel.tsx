/**
 * AuditLogPanel — 审计日志面板
 *
 * 筛选 + 时间范围 + 操作类型，展示安全审计日志。
 * 所有样式使用内联 style + CSS 变量（本项目未安装 Tailwind CSS）。
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getAuditLogs,
  getCurrentLevel,
  getLevelLabel,
  getTokenBudget,
  setLevel,
  type AuditLogEntry,
  type PermissionLevel,
  type ActionType,
} from '../../services/permissionEngine';

// ── 样式 ────────────────────────────────────────────────────

const RESULT_STYLES = {
  allowed: { icon: '✓', color: '#34D399' },
  denied: { icon: '✗', color: '#F87171' },
};

const ACTION_LABELS: Record<ActionType, string> = {
  read: 'audit.action.read',
  edit: 'audit.action.edit',
  create: 'audit.action.create',
  delete: 'audit.action.delete',
  shell: 'audit.action.shell',
  config: 'audit.action.config',
  admin: 'audit.action.admin',
};

// ── Token 预算条 ────────────────────────────────────────────

function TokenBudgetBar() {
  const { t } = useTranslation();
  const budget = getTokenBudget();
  const budgetColor = budget.isPaused ? '#F87171'
    : budget.isWarning ? '#FBBF24'
    : '#34D399';

  return (
    <div style={{
      padding: 12,
      borderRadius: 6,
      border: '1px solid rgba(148, 163, 184, 0.1)',
      background: '#0F172A',
      marginBottom: 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: '#94A3B8' }}>{t('audit.token_budget')}</span>
        <span style={{
          fontSize: 10,
          color: budget.isWarning ? '#FBBF24' : '#64748B',
        }}>
          {budget.used.toLocaleString()} / {budget.total.toLocaleString()} ({(budget.usagePercent * 100).toFixed(1)}%)
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
          background: budgetColor,
          width: `${Math.min(budget.usagePercent * 100, 100)}%`,
          transition: 'width 0.5s ease-out',
        }} />
      </div>
      {budget.isWarning && !budget.isPaused && (
        <div style={{ fontSize: 10, color: '#FBBF24', marginTop: 4 }}>⚠ {t('audit.token_warning')}</div>
      )}
      {budget.isPaused && (
        <div style={{ fontSize: 10, color: '#F87171', marginTop: 4 }}>⚠ {t('audit.token_paused')}</div>
      )}
    </div>
  );
}

// ── 权限等级选择 ────────────────────────────────────────────

function LevelSelector() {
  const { t } = useTranslation();
  const current = getCurrentLevel();

  return (
    <div style={{
      padding: 12,
      borderRadius: 6,
      border: '1px solid rgba(148, 163, 184, 0.1)',
      background: '#0F172A',
      marginBottom: 12,
    }}>
      <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 8 }}>
        {t('audit.permission_level')}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {([1, 2, 3, 4, 5, 6] as PermissionLevel[]).map((l) => {
          const bg = l === current ? 'rgba(59, 130, 246, 0.15)' : 'transparent';
          const color = l === current ? '#60A5FA'
            : l <= current ? '#34D399'
            : '#64748B';
          const border = l === current ? '1px solid rgba(59, 130, 246, 0.25)' : 'none';

          return (
            <button
              key={l}
              onClick={() => setLevel(l)}
              title={getLevelLabel(l)}
              style={{
                fontSize: 10,
                padding: '4px 8px',
                borderRadius: 6,
                background: bg,
                color: color,
                border: border,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.15s ease-out',
              }}
              onMouseEnter={e => {
                if (l !== current) e.currentTarget.style.background = 'rgba(148,163,184,0.05)';
              }}
              onMouseLeave={e => {
                if (l !== current) e.currentTarget.style.background = 'transparent';
              }}
            >
              L{l}
            </button>
          );
        })}
        <span style={{ fontSize: 10, color: '#64748B', marginLeft: 8 }}>
          {t('audit.current')}: {getLevelLabel(current)}
        </span>
      </div>
    </div>
  );
}

// ── 日志行 ──────────────────────────────────────────────────

function LogRow({ log }: { log: AuditLogEntry }) {
  const { t } = useTranslation();
  const resultStyle = RESULT_STYLES[log.result];

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 12px',
      transition: 'all 0.15s ease-out',
    }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-card-hover)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{ color: resultStyle.color, fontSize: 12, width: 16 }}>{resultStyle.icon}</span>
      <span style={{ fontSize: 10, color: '#64748B', width: 64 }}>{t(ACTION_LABELS[log.action])}</span>
      <span style={{
        fontSize: 12,
        color: '#94A3B8',
        flex: 1,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontFamily: '"JetBrains Mono", monospace',
      }}>
        {log.resource}
      </span>
      <span style={{ fontSize: 10, color: '#64748B' }}>L{log.level}</span>
      <span style={{ fontSize: 10, color: '#64748B' }}>{new Date(log.timestamp).toLocaleTimeString()}</span>
    </div>
  );
}

// ── 主组件 ──────────────────────────────────────────────────

export interface AuditLogPanelProps {
  className?: string;
}

export default function AuditLogPanel({}: AuditLogPanelProps) {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [actionFilter, setActionFilter] = useState<string>('');
  const [resultFilter, setResultFilter] = useState<string>('');

  const refresh = useCallback(() => {
    const options: Parameters<typeof getAuditLogs>[0] = { limit: 50 };
    if (actionFilter) options.action = actionFilter as ActionType;
    if (resultFilter) options.result = resultFilter as 'allowed' | 'denied';
    setLogs(getAuditLogs(options));
  }, [actionFilter, resultFilter]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 2000);
    return () => clearInterval(timer);
  }, [refresh]);

  return (
    <div style={{ padding: 12 }}>
      <h3 style={{
        margin: '0 0 12px',
        fontSize: 14,
        fontWeight: 600,
        color: '#F1F5F9',
      }}>
        {t('audit.title')}
      </h3>

      <TokenBudgetBar />
      <LevelSelector />

      {/* 筛选 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          style={{
            fontSize: 10,
            padding: '4px 8px',
            borderRadius: 6,
            background: '#0F172A',
            border: '1px solid var(--border)',
            color: '#94A3B8',
            fontFamily: 'inherit',
          }}
        >
          <option value="">{t('audit.all_actions')}</option>
          {Object.entries(ACTION_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{t(v)}</option>
          ))}
        </select>
        <select
          value={resultFilter}
          onChange={(e) => setResultFilter(e.target.value)}
          style={{
            fontSize: 10,
            padding: '4px 8px',
            borderRadius: 6,
            background: '#0F172A',
            border: '1px solid var(--border)',
            color: '#94A3B8',
            fontFamily: 'inherit',
          }}
        >
          <option value="">{t('audit.all_results')}</option>
          <option value="allowed">{t('audit.allowed')}</option>
          <option value="denied">{t('audit.denied')}</option>
        </select>
      </div>

      {/* 日志列表 */}
      {logs.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#64748B', fontSize: 12, padding: '32px 0' }}>
          {t('audit.no_logs')}
        </div>
      ) : (
        <div style={{
          borderRadius: 8,
          border: '1px solid var(--border)',
          overflow: 'hidden',
        }}>
          {logs.map((log) => (
            <LogRow key={log.id} log={log} />
          ))}
        </div>
      )}
    </div>
  );
}
