/**
 * V3.0 — Enhanced AgentGroupNode Component
 * Agent 分组卡片：类型标签 + 状态颜色 + 进度条 + 折叠/展开
 */

import React, { memo, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { DAGNode } from '../../types/events';

// Agent 类型配色
const AGENT_TYPE_COLORS: Record<string, { border: string; bg: string; text: string; accent: string }> = {
  context:   { border: '#3b82f6', bg: 'rgba(59,130,246,0.08)', text: '#93c5fd', accent: '#3b82f6' },
  planning:  { border: '#f59e0b', bg: 'rgba(245,158,11,0.08)', text: '#fcd34d', accent: '#f59e0b' },
  execution: { border: '#10b981', bg: 'rgba(16,185,129,0.08)', text: '#6ee7b7', accent: '#10b981' },
  review:    { border: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', text: '#c4b5fd', accent: '#8b5cf6' },
  default:   { border: '#6b7280', bg: 'rgba(107,114,128,0.06)', text: '#9ca3af', accent: '#6b7280' },
};

const STATUS_STYLES: Record<string, { border: string; bg: string; glow: string }> = {
  completed: { border: '#10b981', bg: 'rgba(16,185,129,0.06)', glow: 'none' },
  running:   { border: '#3b82f6', bg: 'rgba(59,130,246,0.10)', glow: '0 0 16px rgba(59,130,246,0.25)' },
  failed:    { border: '#ef4444', bg: 'rgba(239,68,68,0.08)', glow: '0 0 12px rgba(239,68,68,0.2)' },
  pending:   { border: '#4b5563', bg: 'transparent', glow: 'none' },
};

export interface AgentGroupNodeData extends DAGNode {
  agentType?: string;
  agentName?: string;
  collapsed?: boolean;
  childCount?: number;
  progress?: number;
  onToggleCollapse?: (nodeId: string) => void;
  onOpenDetail?: (node: Pick<DAGNode, 'id'|'type'|'label'|'status'|'args'|'summaryContent'|'content'>) => void;
}

interface AgentGroupNodeProps {
  data: AgentGroupNodeData;
  selected?: boolean;
}

const AgentGroupNode: React.FC<AgentGroupNodeProps> = memo(({ data, selected }) => {
  const {
    id, label, status = 'pending', agentType = 'default',
    agentName, collapsed = false, childCount = 0,
    progress, onToggleCollapse, onOpenDetail,
  } = data;

  const colors = AGENT_TYPE_COLORS[agentType] ?? AGENT_TYPE_COLORS['default'];
  const ss = STATUS_STYLES[status] ?? STATUS_STYLES['pending'];
  const isRunning = status === 'running';
  const isFailed = status === 'failed';

  const handleToggle = useCallback(() => onToggleCollapse?.(id), [id, onToggleCollapse]);
  const handleDetail = useCallback(() => {
    onOpenDetail?.({ id, type: 'agent', label: agentName ?? label, status, args: undefined, summaryContent: undefined, content: undefined });
  }, [id, agentName, label, status, onOpenDetail]);

  return (
    <div style={{
      background: ss.bg,
      border: `1.5px solid ${isRunning ? colors.border : ss.border}`,
      borderRadius: 10,
      overflow: 'hidden',
      minWidth: 200,
      maxWidth: 360,
      boxShadow: isRunning ? ss.glow : (selected ? '0 0 0 2px rgba(139,92,246,0.3)' : 'none'),
      animation: isRunning ? 'agent-pulse 2s infinite' : (isFailed ? 'agent-blink 1s infinite' : 'none'),
      opacity: status === 'pending' ? 0.6 : 1,
      transition: 'all 0.3s ease',
      position: 'relative',
    }}>
      <style>{`
        @keyframes agent-pulse {
          0%, 100% { border-color: ${colors.border}; box-shadow: ${ss.glow}; }
          50% { border-color: ${colors.text}; box-shadow: 0 0 20px ${colors.border}44; }
        }
        @keyframes agent-blink {
          0%, 100% { border-color: #ef4444; }
          50% { border-color: #f87171; }
        }
      `}</style>

      <Handle type="target" position={Position.Top} style={{ background: colors.border, width: 8, height: 8 }} />

      {/* 卡片头部 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 10px',
        background: `${colors.border}15`,
        borderBottom: `1px solid ${colors.border}30`,
        cursor: 'pointer',
      }} onClick={handleToggle}>
        <span style={{ fontSize: 10, color: colors.text }}>
          {collapsed ? '\u25B8' : '\u25BE'}
        </span>
        <span style={{
          background: colors.border, color: '#fff',
          padding: '1px 5px', borderRadius: 3,
          fontSize: 9, fontWeight: 600, textTransform: 'capitalize',
        }}>{agentType}</span>
        <span style={{ flex: 1, fontSize: 11, fontWeight: 500, color: 'var(--text-primary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }} title={agentName ?? label}>
          {agentName ?? label}
        </span>
        {isRunning && <span style={{ fontSize: 10, color: colors.text }}>{'\u23F3'}</span>}
        {status === 'completed' && <span style={{ fontSize: 10, color: '#10b981' }}>{'\u2713'}</span>}
        {isFailed && <span style={{ fontSize: 10, color: '#ef4444' }}>{'\u2717'}</span>}
      </div>

      {/* 未折叠：进度条 + 详情按钮 */}
      {!collapsed && (
        <div style={{ padding: '6px 10px' }}>
          {isRunning && progress !== undefined && (
            <div style={{ height: 3, background: '#30363d', borderRadius: 2, marginBottom: 6 }}>
              <div style={{
                width: `${Math.min(progress, 100)}%`, height: '100%',
                background: `linear-gradient(90deg, ${colors.border}, ${colors.text})`,
                borderRadius: 2, transition: 'width 0.5s ease',
              }} />
            </div>
          )}
          <button onClick={handleDetail} style={{
            background: 'none', border: 'none', padding: 0,
            cursor: 'pointer', fontSize: 10, color: colors.text,
            fontFamily: 'monospace',
          }}>
            {'\u25B6'} 查看 {agentType} 详情
          </button>
        </div>
      )}

      {/* 折叠态：子节点数 */}
      {collapsed && (
        <div style={{ padding: '4px 10px', fontSize: 10, color: '#6b7280' }}>
          {childCount} 个子工具
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={{ background: colors.border, width: 8, height: 8 }} />
    </div>
  );
});

AgentGroupNode.displayName = 'AgentGroupNode';

export default AgentGroupNode;
export const AGENT_GROUP_NODE_TYPE = 'agent_group';
