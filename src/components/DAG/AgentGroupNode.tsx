/**
 * V1.4.0 - AgentGroupNode Component
 * Collapsible Agent Group node for Subagent visualization
 */

import React, { memo, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { DAGNode } from '../../types/events';

interface AgentGroupNodeData extends DAGNode {
  agentName?: string;
  collapsed?: boolean;
  childCount?: number;
  onToggleCollapse?: (nodeId: string) => void;
}

interface AgentGroupNodeProps {
  data: AgentGroupNodeData;
  selected?: boolean;
}

/**
 * AgentGroupNode component
 * Displays as a dashed purple rectangle with collapse/expand toggle
 */
const AgentGroupNode: React.FC<AgentGroupNodeProps> = memo(({
  data,
  selected,
}) => {
  const {
    id,
    label,
    status,
    agentName,
    collapsed = false,
    childCount = 0,
    onToggleCollapse,
  } = data;

  // Determine status color
  const STATUS_COLORS: Record<string, string> = {
    idle: '#64748B',
    pending: '#94A3B8',
    running: '#8B5CF6',
    completed: '#10B981',
    failed: '#EF4444',
  };
  const statusColor = STATUS_COLORS[status || 'pending'] ?? '#8B5CF6';

  // Handle collapse toggle
  const handleToggle = useCallback(() => {
    onToggleCollapse?.(id);
  }, [id, onToggleCollapse]);

  return (
    <div
      className={`agent-group-node ${selected ? 'selected' : ''}`}
      data-status={status}
    >
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="agent-group-handle"
      />

      {/* Header */}
      <div className="agent-group-header">
        {/* Collapse/Expand toggle */}
        <button
          className="collapse-toggle"
          onClick={handleToggle}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? '▶' : '▼'}
        </button>

        {/* Agent icon */}
        <span className="agent-icon">👤</span>

        {/* Agent name */}
        <span className="agent-name" title={agentName || label}>
          {agentName || label}
        </span>

        {/* Status indicator */}
        <span
          className="status-indicator"
          style={{ backgroundColor: statusColor }}
          title={status}
        />
      </div>

      {/* Child count (when collapsed) */}
      {collapsed && (
        <div className="agent-group-collapsed-info">
          {childCount > 0 ? `${childCount} children` : 'No children'}
        </div>
      )}

      {/* Activity text (when collapsed) */}
      {collapsed && data.toolMessage && (
        <div className="agent-group-activity" title={data.toolMessage}>
          {data.toolMessage.length > 30
            ? data.toolMessage.slice(0, 30) + '...'
            : data.toolMessage}
        </div>
      )}

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="agent-group-handle"
      />

      <style>{`
        .agent-group-node {
          background: #1E1B4B;
          border: 2px dashed #8B5CF6;
          border-radius: 8px;
          padding: 8px 12px;
          min-width: 180px;
          max-width: 280px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 12px;
          color: #E2E8F0;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .agent-group-node.selected {
          border-color: #A78BFA;
          box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.3);
        }

        .agent-group-node[data-status="running"] {
          animation: pulse-border 2s infinite;
        }

        @keyframes pulse-border {
          0%, 100% { border-color: #8B5CF6; }
          50% { border-color: #A78BFA; }
        }

        .agent-group-header {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .collapse-toggle {
          background: transparent;
          border: none;
          color: #A78BFA;
          cursor: pointer;
          padding: 2px 4px;
          font-size: 10px;
          border-radius: 4px;
          transition: background-color 0.2s;
        }

        .collapse-toggle:hover {
          background: rgba(139, 92, 246, 0.2);
        }

        .agent-icon {
          font-size: 14px;
        }

        .agent-name {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-weight: 500;
        }

        .status-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .agent-group-collapsed-info {
          margin-top: 6px;
          padding-top: 6px;
          border-top: 1px solid rgba(139, 92, 246, 0.3);
          font-size: 11px;
          color: #94A3B8;
        }

        .agent-group-activity {
          margin-top: 4px;
          font-size: 10px;
          color: #64748B;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .agent-group-handle {
          width: 8px !important;
          height: 8px !important;
          background: #8B5CF6 !important;
          border: 2px solid #1E1B4B !important;
        }
      `}</style>
    </div>
  );
});

AgentGroupNode.displayName = 'AgentGroupNode';

export default AgentGroupNode;

/**
 * Node type registration helper
 */
export const AGENT_GROUP_NODE_TYPE = 'agent_group';
