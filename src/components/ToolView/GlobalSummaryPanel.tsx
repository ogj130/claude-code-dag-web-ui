/**
 * GlobalSummaryPanel — 全局分发汇总面板
 *
 * 视觉规格:
 * - 折叠时返回 null（不渲染）
 * - 展开时 slide-up 动画面板，底部叠加 border
 * - 面板头部: "全局分发汇总" + workspace 数量 + [收起] 按钮 + [查看全局分析] 按钮（全部完成时）
 * - [查看全局分析] 按钮: 仅在 allDone=true 时显示
 * - 卡片列表: grid 布局，每个工作区一个 WorkspaceCard
 */

import React, { memo } from 'react';
import type { Workspace } from '@/types/workspace';
import type { DispatchWorkspaceResult } from '@/types/global-dispatch';
import { WorkspaceCard } from './WorkspaceCard';

export interface GlobalSummaryPanelProps {
  isExpanded: boolean;
  workspaces: Workspace[];
  batchResult: DispatchWorkspaceResult[] | null;
  activeWorkspaceId: string | null;
  onCollapse: () => void;
  onAnalyze: () => void;
}

// ── 辅助函数 ──────────────────────────────────────────────────────────────────

/**
 * 判断所有工作区是否已完成
 * - batchResult 不为 null
 * - batchResult 数量 >= workspace 数量
 * - 每个结果的 status 都不是 idle（即 running / success / partial / failed）
 */
function allDone(batchResult: DispatchWorkspaceResult[] | null, workspaceCount: number): boolean {
  if (!batchResult) return false;
  return batchResult.length >= workspaceCount && batchResult.every(r => r.status !== 'idle');
}

// ── 样式 ─────────────────────────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  borderTop: '1px solid var(--border)',
  padding: '8px 14px 10px',
  animation: 'slideUp 0.2s ease-out',
};

const headerRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
};

const titleStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-primary)',
};

const countStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-muted)',
  marginLeft: 6,
};

const btnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  fontSize: 11,
  padding: '2px 6px',
  borderRadius: 4,
  transition: 'color 0.15s, background 0.15s',
};

const analyzeBtnStyle: React.CSSProperties = {
  ...btnStyle,
  color: 'var(--accent)',
  fontWeight: 500,
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  gap: 8,
  marginTop: 10,
};

// ── 组件 ─────────────────────────────────────────────────────────────────────

const GlobalSummaryPanelInner = ({
  isExpanded,
  workspaces,
  batchResult,
  activeWorkspaceId,
  onCollapse,
  onAnalyze,
}: GlobalSummaryPanelProps) => {
  if (!isExpanded) return null;

  const done = allDone(batchResult, workspaces.length);

  return (
    <>
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
      <div data-testid="global-summary-panel" style={panelStyle}>
        {/* Header */}
        <div style={headerRowStyle}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={titleStyle}>全局分发汇总</span>
            <span style={countStyle}>({workspaces.length})</span>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {done && (
              <button
                data-testid="analyze-btn"
                style={analyzeBtnStyle}
                onClick={onAnalyze}
                title="全部完成，查看全局分析"
              >
                查看全局分析
              </button>
            )}
            <button
              data-testid="collapse-btn"
              style={btnStyle}
              onClick={onCollapse}
              title="收起汇总面板"
            >
              收起
            </button>
          </div>
        </div>

        {/* WorkspaceCard 列表 */}
        <div style={gridStyle}>
          {workspaces.map(ws => {
            const result = batchResult?.find(r => r.workspaceId === ws.id) ?? null;
            return (
              <WorkspaceCard
                key={ws.id}
                workspace={ws}
                result={result}
                isActive={ws.id === activeWorkspaceId}
                onFocus={() => {}}
              />
            );
          })}
        </div>
      </div>
    </>
  );
};

export const GlobalSummaryPanel = memo(GlobalSummaryPanelInner);
