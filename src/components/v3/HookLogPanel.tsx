/**
 * HookLogPanel — Hook 执行日志面板
 *
 * 展示 Hook 执行历史，支持筛选和调试模式。
 * 所有样式使用内联 style + CSS 变量（本项目未安装 Tailwind CSS）。
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getLogs,
  list as listHooks,
  emit,
  type HookLog,
  type Hook,
  type TriggerType,
} from '../../services/hookEngine';

// ── 状态样式 ────────────────────────────────────────────────

const STATUS_STYLES: Record<HookLog['status'], { icon: string; color: string }> = {
  success: { icon: '✓', color: '#34D399' },
  failed: { icon: '✗', color: '#F87171' },
  skipped: { icon: '○', color: '#64748B' },
};

const TRIGGER_SHORT: Record<TriggerType, string> = {
  task_complete: '任务完成',
  task_fail: '任务失败',
  file_change: '文件变更',
  model_switch: '模型切换',
  session_start: '会话开始',
  session_end: '会话结束',
  error_detected: '错误检测',
  user_feedback: '用户反馈',
  manual: '手动',
};

// ── 日志行 ──────────────────────────────────────────────────

function LogRow({ log }: { log: HookLog }) {
  const [expanded, setExpanded] = useState(false);
  const style = STATUS_STYLES[log.status];

  return (
    <div style={{
      border: '1px solid rgba(148, 163, 184, 0.1)',
      borderRadius: 8,
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          background: 'transparent',
          border: 'none',
          color: '#94A3B8',
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'inherit',
          fontSize: 12,
          transition: 'all 0.15s ease-out',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(148,163,184,0.03)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
      >
        <span style={{ color: style.color, fontSize: 11 }}>{style.icon}</span>
        <span style={{
          fontSize: 12,
          fontWeight: 500,
          color: '#CBD5E1',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {log.hookName}
        </span>
        <span style={{ fontSize: 10, color: '#64748B' }}>{TRIGGER_SHORT[log.trigger]}</span>
        <span style={{ fontSize: 10, color: '#475569' }}>{log.durationMs}ms</span>
        <span style={{ fontSize: 10, color: '#475569' }}>
          {new Date(log.timestamp).toLocaleTimeString()}
        </span>
      </button>

      {expanded && (
        <div style={{
          padding: '4px 12px 8px',
          fontSize: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}>
          {log.details && (
            <div style={{ color: '#94A3B8' }}>
              <span style={{ color: '#64748B' }}>详情：</span>{log.details}
            </div>
          )}
          {log.error && (
            <div style={{ color: '#F87171' }}>
              <span style={{ color: '#64748B' }}>错误：</span>{log.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 调试模式 ────────────────────────────────────────────────

function DebugPanel({ hooks }: { hooks: Hook[] }) {
  const [selectedHook, setSelectedHook] = useState('');
  const [isRunning, setIsRunning] = useState(false);

  const handleTrigger = useCallback(async () => {
    if (!selectedHook || isRunning) return;
    setIsRunning(true);
    try {
      await emit(selectedHook as TriggerType, { debug: true }, true);
    } finally {
      setIsRunning(false);
    }
  }, [selectedHook, isRunning]);

  return (
    <div style={{
      padding: 12,
      borderRadius: 8,
      border: '1px solid rgba(251, 191, 36, 0.2)',
      background: 'rgba(251, 191, 36, 0.05)',
      marginBottom: 16,
    }}>
      <h4 style={{
        margin: '0 0 8px',
        fontSize: 12,
        fontWeight: 500,
        color: '#FCD34D',
      }}>调试模式</h4>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <select
          value={selectedHook}
          onChange={(e) => setSelectedHook(e.target.value)}
          style={{
            fontSize: 12,
            padding: '4px 8px',
            borderRadius: 6,
            background: '#1E293B',
            border: '1px solid rgba(148, 163, 184, 0.1)',
            color: '#CBD5E1',
            fontFamily: 'inherit',
          }}
        >
          <option value="">选择触发器</option>
          {hooks.map((h) => (
            <option key={h.id} value={h.trigger}>
              {h.name} ({h.trigger})
            </option>
          ))}
        </select>
        <button
          onClick={handleTrigger}
          disabled={!selectedHook || isRunning}
          style={{
            fontSize: 12,
            padding: '4px 10px',
            borderRadius: 6,
            background: 'rgba(251, 191, 36, 0.2)',
            color: '#FBBF24',
            border: '1px solid rgba(251, 191, 36, 0.3)',
            cursor: !selectedHook || isRunning ? 'default' : 'pointer',
            fontFamily: 'inherit',
            opacity: !selectedHook || isRunning ? 0.5 : 1,
            transition: 'all 0.15s ease-out',
          }}
          onMouseEnter={e => {
            if (selectedHook && !isRunning)
              e.currentTarget.style.background = 'rgba(251, 191, 36, 0.3)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(251, 191, 36, 0.2)';
          }}
        >
          {isRunning ? '执行中...' : '手动触发'}
        </button>
      </div>
    </div>
  );
}

// ── 主组件 ──────────────────────────────────────────────────

export interface HookLogPanelProps {
  className?: string;
}

export default function HookLogPanel({}: HookLogPanelProps) {
  const [logs, setLogs] = useState<HookLog[]>([]);
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showDebug, setShowDebug] = useState(false);

  const refresh = useCallback(() => {
    const status = statusFilter === 'all' ? undefined : (statusFilter as HookLog['status']);
    setLogs(getLogs({ status, limit: 50 }));
    setHooks(listHooks());
  }, [statusFilter]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div style={{
      padding: 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{
          margin: 0,
          fontSize: 14,
          fontWeight: 500,
          color: '#CBD5E1',
        }}>Hook 日志</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setShowDebug(!showDebug)}
            style={{
              fontSize: 10,
              padding: '4px 8px',
              borderRadius: 6,
              cursor: 'pointer',
              fontFamily: 'inherit',
              border: showDebug ? '1px solid rgba(251, 191, 36, 0.3)' : 'none',
              background: showDebug ? 'rgba(251, 191, 36, 0.2)' : 'rgba(148, 163, 184, 0.07)',
              color: showDebug ? '#FBBF24' : '#64748B',
              transition: 'all 0.15s ease-out',
            }}
            onMouseEnter={e => {
              if (!showDebug) e.currentTarget.style.background = 'rgba(148, 163, 184, 0.12)';
            }}
            onMouseLeave={e => {
              if (!showDebug) e.currentTarget.style.background = 'rgba(148, 163, 184, 0.07)';
            }}
          >
            调试
          </button>
          <button
            onClick={refresh}
            style={{
              fontSize: 10,
              padding: '4px 8px',
              borderRadius: 6,
              background: 'rgba(148, 163, 184, 0.07)',
              color: '#64748B',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.15s ease-out',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(148, 163, 184, 0.15)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(148, 163, 184, 0.07)'; }}
          >
            刷新
          </button>
        </div>
      </div>

      {/* 筛选 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {['all', 'success', 'failed', 'skipped'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              fontSize: 10,
              padding: '2px 8px',
              borderRadius: 6,
              cursor: 'pointer',
              fontFamily: 'inherit',
              border: 'none',
              background: statusFilter === s
                ? 'rgba(59, 130, 246, 0.2)'
                : 'rgba(148, 163, 184, 0.05)',
              color: statusFilter === s ? '#60A5FA' : '#64748B',
              transition: 'all 0.15s ease-out',
            }}
            onMouseEnter={e => {
              if (statusFilter !== s)
                e.currentTarget.style.color = '#94A3B8';
            }}
            onMouseLeave={e => {
              if (statusFilter !== s)
                e.currentTarget.style.color = '#64748B';
            }}
          >
            {s === 'all' ? '全部' : s}
          </button>
        ))}
      </div>

      {/* 调试面板 */}
      {showDebug && <DebugPanel hooks={hooks} />}

      {/* 日志列表 */}
      {logs.length === 0 ? (
        <div style={{
          textAlign: 'center',
          color: '#64748B',
          fontSize: 12,
          padding: '32px 0',
        }}>
          暂无日志
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {logs.map((log) => (
            <LogRow key={log.id} log={log} />
          ))}
        </div>
      )}
    </div>
  );
}
