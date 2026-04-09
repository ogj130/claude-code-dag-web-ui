import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { DAGNode as DAGNodeType } from '../../types/events';

// ── 浅比较函数：仅当核心属性变化时才重渲染 ─────────────
function arePropsEqual(prev: DAGNodeProps, next: DAGNodeProps): boolean {
  const pd = prev.data;
  const nd = next.data;
  return (
    pd.id === nd.id &&
    pd.status === nd.status &&
    pd.label === nd.label &&
    pd.type === nd.type &&
    pd.isCollapsed === nd.isCollapsed &&
    pd.groupCollapsed === nd.groupCollapsed &&
    pd.count === nd.count &&
    pd.queryId === nd.queryId &&
    pd.summaryContent === nd.summaryContent &&
    pd.args === nd.args &&
    pd.onOpenDetail === nd.onOpenDetail &&
    pd.onToggleCollapse === nd.onToggleCollapse &&
    pd.onToggleGroup === nd.onToggleGroup &&
    pd.containerWidth === nd.containerWidth &&
    pd.toolMessage === nd.toolMessage
  );
}


// ── 内联 SVG 图标 ──────────────────────────────────────
function AgentSvgIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function QuerySvgIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
function ToolSvgIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}
function SummarySvgIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

const statusStyle: Record<string, React.CSSProperties> = {
  pending: { borderColor: 'var(--dag-node-border)', opacity: 0.7 },
  running: {
    borderColor: 'var(--warn)',
    background: 'var(--warn-bg)',
    animation: 'node-pulse 1.5s infinite',
  },
  completed: { borderColor: 'var(--success)', background: 'var(--success-bg)' },
  failed: { borderColor: 'var(--error)', background: 'var(--error-bg)' },
};

const STATUS_LABEL: Record<string, string> = {
  pending: '等待', running: '运行中', completed: '完成', failed: '失败',
};

const STATUS_COLOR: Record<string, string> = {
  pending: 'var(--text-dim)',
  running: 'var(--warn)',
  completed: 'var(--success)',
  failed: 'var(--error)',
};

const TOOL_ACCENT_COLOR: Record<string, string> = {
  Bash: 'var(--accent)',
  Read: 'var(--success)',
  Edit: 'var(--warn)',
  Search: '#a78bfa',
  Write: '#f472b6',
  Grep: '#fb923c',
};

function getToolAccentColor(label: string): string {
  return TOOL_ACCENT_COLOR[label] ?? 'var(--accent)';
}

interface DAGNodeProps {
  data: DAGNodeType & {
    onOpenDetail?: (node: Pick<DAGNodeType, 'id' | 'type' | 'label' | 'status' | 'args' | 'summaryContent'>) => void;
    onToggleCollapse?: (queryId: string) => void;
    onToggleGroup?: (groupId: string) => void;
    isCollapsed?: boolean;
    groupCollapsed?: boolean;
    count?: number;
    queryId?: string;
    nodeIds?: string[];
    isExpanded?: boolean;
    /** 容器模式下固定子节点宽度 */
    containerWidth?: number;
  };
  onOpenDetail?: (node: Pick<DAGNodeType, 'id' | 'type' | 'label' | 'status' | 'args' | 'summaryContent'>) => void;
}

function DAGNodeInner({ data, onOpenDetail }: DAGNodeProps) {
  const isCollapsed = data.isCollapsed ?? false;
  const isGroupCollapsed = data.groupCollapsed ?? false;
  const handleToggleCollapse = data.onToggleCollapse;
  const s = statusStyle[data.status] ?? statusStyle.pending;
  const accentColor = getToolAccentColor(data.label);

  const nodeArgs = (data.args ?? null) as Record<string, unknown> | null;
  const hasArgs = nodeArgs !== null && Object.keys(nodeArgs).length > 0;

  // Summary 节点固定宽度，防止 Markdown 内容撑大节点
  const isSummaryNode = data.type === 'summary';
  // 容器模式下固定子节点宽度
  const fixedWidth = data.containerWidth;

  const handleOpenDetail = () => {
    const cb = data.onOpenDetail ?? onOpenDetail;
    cb?.({
      id: data.id,
      type: data.type,
      label: data.label,
      status: data.status,
      args: data.args,
      summaryContent: data.summaryContent,
    });
  };

  const handleToggleCollapseClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.type === 'query' && handleToggleCollapse) {
      handleToggleCollapse(data.id);
    }
  };

  const handleToggleGroupClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isGroupCollapsed && data.onToggleGroup && data.queryId) {
      data.onToggleGroup(`group_${data.queryId}_${data.label}`);
    }
  };

  if (isGroupCollapsed) {
    return (
      <div style={{
        background: 'var(--dag-node, var(--bg-card))',
        border: '1.5px solid',
        borderColor: `${accentColor}66`,
        borderRadius: 10,
        padding: '10px 14px',
        position: 'relative',
        minWidth: 120,
        textAlign: 'left',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        transition: 'all 0.3s',
        cursor: 'pointer',
        opacity: 0.96,
      }} onClick={handleToggleGroupClick}>
        {data.parentId && (
          <Handle type="target" position={Position.Top} style={{ background: accentColor }} />
        )}

        <div style={{
          display: 'flex', justifyContent: 'center',
          color: accentColor,
          marginBottom: 5,
        }}>
          <ToolSvgIcon />
        </div>

        <div style={{
          color: 'var(--text-primary)', fontWeight: 500, fontSize: 12,
          fontFamily: "'JetBrains Mono', monospace",
          textAlign: 'center',
        }}>
          {data.label}
        </div>

        <div style={{
          fontSize: 10,
          marginTop: 4,
          textAlign: 'center',
          color: 'var(--text-dim)',
          fontFamily: 'monospace',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          flexWrap: 'wrap',
        }}>
          <span>分组</span>
          <span style={{
            color: accentColor,
            fontWeight: 600,
            fontFamily: "'JetBrains Mono', monospace",
            background: `${accentColor}18`,
            border: `1px solid ${accentColor}2e`,
            padding: '1px 6px',
            borderRadius: 999,
            lineHeight: 1.2,
          }}>
            {data.count ?? 0} 个
          </span>
        </div>

        <div style={{
          marginTop: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          fontSize: 10,
          color: accentColor,
          fontFamily: 'monospace',
        }}>
          <span>展开</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill={accentColor}>
            <path d="M10 17l5-5-5-5z"/>
          </svg>
        </div>

        <Handle type="source" position={Position.Bottom} style={{ background: accentColor }} />
      </div>
    );
  }

  return (
    <div style={{
      background: 'var(--dag-node, var(--bg-card))',
      border: '1.5px solid',
      borderRadius: 10, padding: '10px 14px',
      position: 'relative',  // 给折叠图标提供定位上下文
      width: isSummaryNode ? 280 : fixedWidth,
      minWidth: isSummaryNode ? 280 : (fixedWidth ?? 120),
      maxWidth: isSummaryNode ? 280 : (fixedWidth ?? undefined),
      textAlign: 'left',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      transition: 'all 0.3s', ...s,
      opacity: isCollapsed ? 0.85 : 1,
    }}>
      <style>{`
        @keyframes tool-bubble-in {
          from { opacity: 0; transform: translateX(-50%) translateY(4px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
      {/* 折叠图标（仅 query 节点显示） */}
      {data.type === 'query' && (
        <div
          onClick={handleToggleCollapseClick}
          title={isCollapsed ? '展开' : '折叠'}
          style={{
            position: 'absolute',
            top: 6,
            left: 6,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 1,
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--text-primary)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent)')}
        >
          <svg width="8" height="8" viewBox="0 0 24 24" fill="var(--bg-root)">
            {isCollapsed
              ? <path d="M10 17l5-5-5-5z"/>
              : <path d="M7 10l5 5 5-5z"/>}
          </svg>
        </div>
      )}
      {data.parentId && (
        <Handle type="target" position={Position.Top} style={{ background: 'var(--accent)' }} />
      )}

      {/* 图标 */}
      <div style={{
        display: 'flex', justifyContent: 'center',
        color: STATUS_COLOR[data.status] ?? 'var(--text-dim)',
        marginBottom: 5,
      }}>
        {data.type === 'agent' ? <AgentSvgIcon /> :
         data.type === 'query' ? <QuerySvgIcon /> :
         data.type === 'summary' ? <SummarySvgIcon /> :
         <ToolSvgIcon />}
      </div>

      {/* 标签 */}
      <div style={{
        color: 'var(--text-primary)', fontWeight: 500, fontSize: 12,
        fontFamily: "'JetBrains Mono', monospace",
        textAlign: 'center',
      }}>
        {data.type === 'query' && data.label.length > 20
          ? data.label.slice(0, 20) + '…' : data.label}
      </div>

      {/* 状态 */}
      <div style={{
        fontSize: 10, marginTop: 4, textAlign: 'center',
        color: STATUS_COLOR[data.status] ?? 'var(--text-dim)',
        fontFamily: 'monospace',
      }}>
        {STATUS_LABEL[data.status] ?? '等待'}
      </div>

      {/* 详情按钮（工具节点+有参数 / 总结节点+有内容） */}
      {((data.type === 'tool' && hasArgs) || (data.type === 'summary' && data.summaryContent)) && (
        <button
          onClick={handleOpenDetail}
          style={{
            marginTop: 6,
            background: 'none', border: 'none', padding: 0,
            cursor: 'pointer', fontSize: 10,
            color: data.type === 'summary' ? 'var(--success)' : 'var(--accent-dim)',
            fontFamily: 'monospace', transition: 'color 0.15s',
            display: 'flex', alignItems: 'center', gap: 3,
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
          onMouseLeave={e => e.currentTarget.style.color = data.type === 'summary' ? 'var(--success)' : 'var(--accent-dim)'}
        >
          <span>▶</span>
          {data.type === 'tool' ? '参数' : '查看总结'}
        </button>
      )}

      <Handle type="source" position={Position.Bottom} style={{ background: 'var(--accent)' }} />

      {/* 工具交互提示气泡（running 状态 + 有提示文字时显示） */}
      {data.type === 'tool' && data.status === 'running' && data.toolMessage && (
        <div style={{
          position: 'absolute',
          bottom: -30,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.88)',
          border: '1px solid var(--accent)',
          borderRadius: 5,
          padding: '3px 10px',
          fontSize: 9,
          color: 'var(--accent)',
          fontFamily: "'JetBrains Mono', monospace",
          whiteSpace: 'nowrap',
          maxWidth: 200,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          zIndex: 10,
          pointerEvents: 'none',
          animation: 'tool-bubble-in 0.2s ease-out',
        }}>
          {data.toolMessage}
        </div>
      )}
    </div>
  );
}

export const DAGNodeComponent = memo(DAGNodeInner, arePropsEqual);
DAGNodeComponent.displayName = 'DAGNodeComponent';
