/**
 * V1.4.0 - CompactionDrawer Component
 * Context History side drawer for compression reports
 */

import { useState } from 'react';
import { useCompactionStore } from '../../stores/useCompactionStore';
import { useCompressionStatusDisplay, useCompressionTrigger } from '../../hooks/useCompressionTrigger';
import type { CompactionReport } from '../../types/compaction';

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  const time = date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  if (isToday) return `今天 ${time}`;
  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return tokens.toString();
}

// ---------------------------------------------------------------------------
// Report card component
// ---------------------------------------------------------------------------

interface ReportCardProps {
  report: CompactionReport;
  isSelected: boolean;
  onClick: () => void;
}

function ReportCard({ report, isSelected, onClick }: ReportCardProps) {
  const savingsColor =
    report.savingsPct >= 50
      ? '#10B981'
      : report.savingsPct >= 30
      ? '#F59E0B'
      : '#EF4444';

  return (
    <div
      className={`compaction-report-card ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <div className="report-card__header">
        <span className="report-id">{report.id}</span>
        <span
          className="report-savings"
          style={{ color: savingsColor }}
        >
          -{report.savingsPct.toFixed(0)}%
        </span>
      </div>
      <div className="report-card__meta">
        <span>{formatTime(report.timestamp)}</span>
        <span>{formatTokens(report.beforeTokens)} → {formatTokens(report.afterTokens)} tokens</span>
      </div>
      {isSelected && (
        <div className="report-card__details">
          <div className="detail-section">
            <h4>已保留</h4>
            <ul>
              <li>文件: {report.preserved.codeStructure.files}</li>
              <li>函数: {report.preserved.codeStructure.functions}</li>
              <li>决策: {report.preserved.decisions.length}</li>
              <li>钩子: {report.preserved.hooks.length}</li>
            </ul>
          </div>
          <div className="detail-section">
            <h4>已压缩</h4>
            <ul>
              <li>
                工具调用: {report.compressed.toolCalls.original} → {report.compressed.toolCalls.compressed}
              </li>
              <li>错误: {report.compressed.errors.summary}</li>
            </ul>
          </div>
          <div className="detail-section">
            <h4>压缩说明</h4>
            <p className="ai-rationale">{report.aiRationale}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stats overview component
// ---------------------------------------------------------------------------

function StatsOverview() {
  const { reports, getTotalSavings, contextUsage } = useCompactionStore();
  const { label, color, pct } = useCompressionStatusDisplay();
  const totalSavings = getTotalSavings();

  return (
    <div className="compaction-stats">
      <div className="stats-card">
        <div className="stats-row">
          <span className="stats-label">上下文使用</span>
          <span className="stats-value" style={{ color }}>
            {pct.toFixed(0)}%
          </span>
        </div>
        <div className="stats-bar">
          <div
            className="stats-bar__fill"
            style={{
              width: `${Math.min(pct, 100)}%`,
              backgroundColor: color,
            }}
          />
        </div>
        <span className="stats-status">{label}</span>
      </div>

      <div className="stats-row-group">
        <div className="stats-mini">
          <span className="stats-mini__value">{reports.length}</span>
          <span className="stats-mini__label">压缩次数</span>
        </div>
        <div className="stats-mini">
          <span className="stats-mini__value" style={{ color: '#10B981' }}>
            {totalSavings > 0 ? `${totalSavings.toFixed(0)}%` : '-'}
          </span>
          <span className="stats-mini__label">总节省</span>
        </div>
        <div className="stats-mini">
          <span className="stats-mini__value">
            {formatTokens(contextUsage.totalInputTokens)}
          </span>
          <span className="stats-mini__label">已用 Token</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings panel component
// ---------------------------------------------------------------------------

function SettingsPanel() {
  const { settings, updateSettings } = useCompactionStore();
  const { triggerManualCompression, isCompressing } = useCompressionTrigger();

  return (
    <div className="compaction-settings">
      <h3 className="settings-title">压缩设置</h3>

      <div className="settings-row">
        <label className="settings-label">
          触发阈值
          <span className="settings-hint">当上下文超过此百分比时自动压缩</span>
        </label>
        <div className="settings-control">
          <input
            type="range"
            min="50"
            max="95"
            step="5"
            value={settings.triggerThreshold}
            onChange={(e) =>
              updateSettings({ triggerThreshold: parseInt(e.target.value, 10) })
            }
          />
          <span className="settings-value">{settings.triggerThreshold}%</span>
        </div>
      </div>

      <div className="settings-row">
        <label className="settings-label">
          保留策略
        </label>
        <select
          className="settings-select"
          value={settings.preservationStrategy}
          onChange={(e) =>
            updateSettings({
              preservationStrategy: e.target.value as 'smart' | 'conservative' | 'aggressive',
            })
          }
        >
          <option value="conservative">保守（保留更多）</option>
          <option value="smart">智能（平衡）</option>
          <option value="aggressive">激进（压缩更多）</option>
        </select>
      </div>

      <div className="settings-row">
        <label className="settings-label">
          自动清理
          <span className="settings-hint">保留压缩记录天数</span>
        </label>
        <div className="settings-control">
          <input
            type="number"
            min="7"
            max="90"
            value={settings.autoCleanupDays}
            onChange={(e) =>
              updateSettings({ autoCleanupDays: parseInt(e.target.value, 10) })
            }
          />
          <span className="settings-unit">天</span>
        </div>
      </div>

      <button
        className="manual-trigger-btn"
        onClick={triggerManualCompression}
        disabled={isCompressing}
      >
        {isCompressing ? (
          <>
            <span className="spinner" />
            压缩中...
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            立即压缩
          </>
        )}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main drawer component
// ---------------------------------------------------------------------------

interface CompactionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CompactionDrawer({ isOpen, onClose }: CompactionDrawerProps) {
  const { reports, selectedReportId, selectReport } = useCompactionStore();
  const [activeTab, setActiveTab] = useState<'history' | 'settings'>('history');

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div className="rag-panel__overlay" onClick={onClose} />

      {/* Drawer */}
      <div className="rag-panel__drawer compaction-drawer">
        {/* Header */}
        <div className="rag-panel__header">
          <h2 className="rag-panel__title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L22 20H2L12 2Z" strokeDasharray="4 2" />
            </svg>
            上下文历史
          </h2>

          {/* Tab switcher */}
          <div className="compaction-tabs">
            <button
              className={`compaction-tab ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              历史
            </button>
            <button
              className={`compaction-tab ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              设置
            </button>
          </div>

          {/* Close button */}
          <button className="rag-panel__close" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="rag-panel__body">
          {activeTab === 'history' ? (
            <div className="compaction-history">
              {/* Stats overview */}
              <StatsOverview />

              {/* Report list */}
              <div className="report-list">
                {reports.length === 0 ? (
                  <div className="empty-state">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M12 2L22 20H2L12 2Z" strokeDasharray="4 2" />
                    </svg>
                    <p>暂无压缩历史</p>
                    <span>当上下文被压缩时，记录将显示在这里</span>
                  </div>
                ) : (
                  reports.map((report) => (
                    <ReportCard
                      key={report.id}
                      report={report}
                      isSelected={selectedReportId === report.id}
                      onClick={() =>
                        selectReport(selectedReportId === report.id ? null : report.id)
                      }
                    />
                  ))
                )}
              </div>
            </div>
          ) : (
            <SettingsPanel />
          )}
        </div>
      </div>

      {/* Styles */}
      <style>{`
        .compaction-drawer {
          z-index: 902;
        }

        .compaction-tabs {
          display: flex;
          gap: 4px;
          margin-left: auto;
          margin-right: 8px;
        }

        .compaction-tab {
          padding: 4px 12px;
          border-radius: 6px;
          border: none;
          background: transparent;
          color: var(--text-secondary, #8b8b9e);
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.15s, color 0.15s;
        }

        .compaction-tab:hover {
          background: var(--bg-hover, #1e1e2e);
        }

        .compaction-tab.active {
          background: var(--accent, #6366f1);
          color: white;
        }

        /* History tab */
        .compaction-history {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 0;
        }

        .compaction-stats {
          background: var(--bg-card, #1e1e2e);
          border: 1px solid var(--border, #2a2a3a);
          border-radius: 8px;
          padding: 12px;
        }

        .stats-card {
          margin-bottom: 12px;
        }

        .stats-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }

        .stats-label {
          font-size: 12px;
          color: var(--text-secondary, #8b8b9e);
        }

        .stats-value {
          font-size: 14px;
          font-weight: 600;
        }

        .stats-bar {
          height: 4px;
          background: var(--border, #2a2a3a);
          border-radius: 2px;
          overflow: hidden;
          margin-bottom: 4px;
        }

        .stats-bar__fill {
          height: 100%;
          border-radius: 2px;
          transition: width 0.3s ease;
        }

        .stats-status {
          font-size: 11px;
          color: var(--text-secondary, #8b8b9e);
        }

        .stats-row-group {
          display: flex;
          gap: 12px;
        }

        .stats-mini {
          flex: 1;
          text-align: center;
        }

        .stats-mini__value {
          display: block;
          font-size: 16px;
          font-weight: 700;
          color: var(--text-primary, #e2e2ef);
        }

        .stats-mini__label {
          font-size: 10px;
          color: var(--text-secondary, #8b8b9e);
        }

        /* Report list */
        .report-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .compaction-report-card {
          background: var(--bg-card, #1e1e2e);
          border: 1px solid var(--border, #2a2a3a);
          border-radius: 8px;
          padding: 10px 12px;
          cursor: pointer;
          transition: border-color 0.15s, background-color 0.15s;
        }

        .compaction-report-card:hover {
          border-color: var(--accent, #6366f1);
        }

        .compaction-report-card.selected {
          border-color: var(--accent, #6366f1);
          background: rgba(99, 102, 241, 0.08);
        }

        .report-card__header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .report-id {
          font-size: 11px;
          color: var(--text-secondary, #8b8b9e);
          font-family: monospace;
        }

        .report-savings {
          font-size: 14px;
          font-weight: 700;
        }

        .report-card__meta {
          display: flex;
          justify-content: space-between;
          margin-top: 4px;
          font-size: 11px;
          color: var(--text-secondary, #8b8b9e);
        }

        .report-card__details {
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid var(--border, #2a2a3a);
        }

        .detail-section {
          margin-bottom: 8px;
        }

        .detail-section h4 {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-secondary, #8b8b9e);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin: 0 0 4px;
        }

        .detail-section ul {
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .detail-section li {
          font-size: 11px;
          color: var(--text-primary, #e2e2ef);
          padding: 2px 0;
        }

        .ai-rationale {
          font-size: 11px;
          color: var(--text-secondary, #8b8b9e);
          line-height: 1.5;
          margin: 0;
        }

        /* Empty state */
        .empty-state {
          text-align: center;
          padding: 32px 16px;
          color: var(--text-secondary, #8b8b9e);
        }

        .empty-state svg {
          opacity: 0.4;
          margin-bottom: 12px;
        }

        .empty-state p {
          font-size: 13px;
          margin: 0 0 4px;
          color: var(--text-primary, #e2e2ef);
        }

        .empty-state span {
          font-size: 11px;
        }

        /* Settings panel */
        .compaction-settings {
          padding: 0 4px;
        }

        .settings-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary, #e2e2ef);
          margin: 0 0 16px;
        }

        .settings-row {
          margin-bottom: 16px;
        }

        .settings-label {
          display: block;
          font-size: 12px;
          font-weight: 500;
          color: var(--text-primary, #e2e2ef);
          margin-bottom: 6px;
        }

        .settings-hint {
          display: block;
          font-size: 10px;
          color: var(--text-secondary, #8b8b9e);
          font-weight: 400;
          margin-top: 2px;
        }

        .settings-control {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .settings-control input[type="range"] {
          flex: 1;
          accent-color: var(--accent, #6366f1);
        }

        .settings-control input[type="number"] {
          width: 60px;
          padding: 4px 8px;
          background: var(--bg-input, #0f0f17);
          border: 1px solid var(--border, #2a2a3a);
          border-radius: 4px;
          color: var(--text-primary, #e2e2ef);
          font-size: 12px;
        }

        .settings-value {
          font-size: 12px;
          color: var(--text-secondary, #8b8b9e);
          min-width: 32px;
          text-align: right;
        }

        .settings-unit {
          font-size: 11px;
          color: var(--text-secondary, #8b8b9e);
        }

        .settings-select {
          width: 100%;
          padding: 6px 10px;
          background: var(--bg-input, #0f0f17);
          border: 1px solid var(--border, #2a2a3a);
          border-radius: 4px;
          color: var(--text-primary, #e2e2ef);
          font-size: 12px;
          cursor: pointer;
        }

        .manual-trigger-btn {
          width: 100%;
          padding: 10px;
          margin-top: 16px;
          background: var(--accent, #6366f1);
          border: none;
          border-radius: 6px;
          color: white;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: opacity 0.15s;
        }

        .manual-trigger-btn:hover:not(:disabled) {
          opacity: 0.9;
        }

        .manual-trigger-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .manual-trigger-btn .spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
