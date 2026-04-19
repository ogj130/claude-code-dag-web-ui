/**
 * WorkspaceCard — 单个工作区执行状态卡片
 *
 * 视觉规格:
 * - 按钮式卡片，border: 1px solid var(--border), border-radius: 8px
 * - Active: border-color: var(--accent) + accent 背景色
 * - 状态徽章: running(脉冲动画)/success(绿色)/partial(黄色)/failed(红色)
 * - 显示首条 prompt（截断至 30 字符 + "…"）
 * - 显示 errorMessage（红色，字号 11）
 */

import React, { memo } from 'react';
import type { Workspace } from '@/types/workspace';
import type { DispatchWorkspaceResult } from '@/types/global-dispatch';

export interface WorkspaceCardProps {
  workspace: Workspace;
  /** null = 执行中 */
  result: DispatchWorkspaceResult | null;
  isActive: boolean;
  onFocus: () => void;
}

// ── 状态徽章配置 ─────────────────────────────────────────────────────────────

type Status = 'running' | 'success' | 'partial' | 'failed';

const STATUS_LABEL: Record<Status, string> = {
  running: '执行中',
  success: '成功',
  partial: '部分成功',
  failed: '失败',
};

interface BadgeStyle {
  bg: string;
  color: string;
}

const BADGE_STYLES: Record<Status, BadgeStyle> = {
  running: { bg: 'rgba(74,142,255,0.12)', color: 'var(--accent)' },
  success: { bg: 'var(--success-bg)', color: 'var(--success)' },
  partial: { bg: 'var(--warn-bg)', color: 'var(--warn)' },
  failed: { bg: 'var(--error-bg)', color: 'var(--error)' },
};

// ── 样式 ─────────────────────────────────────────────────────────────────────

const cardBaseStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: '10px 12px',
  border: '1px solid var(--border)',
  borderRadius: 8,
  cursor: 'pointer',
  background: 'var(--bg-card)',
  transition: 'border-color 0.15s, background 0.15s',
  userSelect: 'none',
  /** button 元素重置样式 */
  borderTopWidth: 1,
  borderLeftWidth: 1,
  borderRightWidth: 1,
  borderBottomWidth: 1,
  borderTopStyle: 'solid',
  borderLeftStyle: 'solid',
  borderRightStyle: 'solid',
  borderBottomStyle: 'solid',
  font: 'inherit',
  textAlign: 'left' as const,
};

const cardActiveStyle: React.CSSProperties = {
  borderColor: 'var(--accent)',
  background: 'rgba(74,142,255,0.05)',
};

const headerRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
};

const nameStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text-primary)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  flex: 1,
};

const badgeBaseStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '2px 7px',
  borderRadius: 20,
  fontSize: 11,
  fontWeight: 500,
  flexShrink: 0,
};

const runningDotStyle: React.CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: '50%',
  background: 'var(--accent)',
  flexShrink: 0,
};

const promptStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-muted)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const errorStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--error)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

// ── 组件 ─────────────────────────────────────────────────────────────────────

const TRUNCATE_LEN = 30;

function truncate(text: string, maxLen = TRUNCATE_LEN): string {
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '…';
}

function WorkspaceCardInner({ workspace, result, isActive, onFocus }: WorkspaceCardProps) {
  const status: Status = result === null ? 'running' : result.status;

  const badgeStyle: BadgeStyle = BADGE_STYLES[status];

  const cardStyle: React.CSSProperties = {
    ...cardBaseStyle,
    ...(isActive ? cardActiveStyle : {}),
  };

  // 提取首条 prompt
  const firstPrompt = result?.promptResults?.[0]?.prompt ?? '';

  // errorMessage
  const errorMessage = result?.errorMessage ?? '';

  return (
    <>
      <style>{`
        @keyframes pulse-running {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
      <button
        data-testid="workspace-card"
        data-status={status}
        style={cardStyle}
        onClick={onFocus}
        title={workspace.name}
        type="button"
      >
        {/* Header: 名称 + 状态徽章 */}
        <div style={headerRowStyle}>
          <span style={nameStyle}>{workspace.name}</span>
          <span style={{ ...badgeBaseStyle, background: badgeStyle.bg, color: badgeStyle.color }}>
            {status === 'running' && (
              <span
                style={{
                  ...runningDotStyle,
                  animation: 'pulse-running 1.2s ease-in-out infinite',
                }}
              />
            )}
            {STATUS_LABEL[status]}
          </span>
        </div>

        {/* 首条 prompt（截断） */}
        {firstPrompt && (
          <span style={promptStyle} title={firstPrompt}>
            {truncate(firstPrompt)}
          </span>
        )}

        {/* 错误信息 */}
        {errorMessage && (
          <span style={errorStyle} title={errorMessage}>
            {errorMessage}
          </span>
        )}
      </button>
    </>
  );
}

export const WorkspaceCard = memo(WorkspaceCardInner);
