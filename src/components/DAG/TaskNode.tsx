/**
 * V1.4.0 - TaskNode Component
 * Root Task node for hierarchical DAG visualization
 */

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { DAGNode } from '../../types/events';

interface TaskNodeData extends DAGNode {
  taskDescription?: string;
}

interface TaskNodeProps {
  data: TaskNodeData;
  selected?: boolean;
}

/**
 * TaskNode component
 * Displays as a solid indigo rounded rectangle, non-collapsible
 */
const TaskNode: React.FC<TaskNodeProps> = memo(({
  data,
  selected,
}) => {
  const {
    id: _id,
    label,
    status,
    taskDescription,
  } = data;

  // Determine status color
  const statusColor = {
    pending: '#94A3B8',
    running: '#6366F1',
    completed: '#10B981',
    failed: '#EF4444',
  }[status || 'pending'] || '#6366F1';

  return (
    <div
      className={`task-node ${selected ? 'selected' : ''}`}
      data-status={status}
    >
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="task-handle"
      />

      {/* Header */}
      <div className="task-header">
        {/* Crown icon for root task */}
        <span className="task-icon">👑</span>

        {/* Task label */}
        <span className="task-label" title={label}>
          {label}
        </span>

        {/* Status indicator */}
        <span
          className="status-indicator"
          style={{ backgroundColor: statusColor }}
          title={status}
        />
      </div>

      {/* Task description */}
      {taskDescription && (
        <div className="task-description" title={taskDescription}>
          {taskDescription.length > 60
            ? taskDescription.slice(0, 60) + '...'
            : taskDescription}
        </div>
      )}

      {/* Running indicator */}
      {status === 'running' && (
        <div className="task-running-indicator">
          <span className="running-dot" />
          <span>Running</span>
        </div>
      )}

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="task-handle"
      />

      <style>{`
        .task-node {
          background: linear-gradient(135deg, #1E1B4B 0%, #312E81 100%);
          border: 2px solid #6366F1;
          border-radius: 12px;
          padding: 10px 14px;
          min-width: 200px;
          max-width: 320px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 12px;
          color: #E2E8F0;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .task-node.selected {
          border-color: #818CF8;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.3);
        }

        .task-node[data-status="running"] {
          animation: task-glow 2s infinite;
        }

        @keyframes task-glow {
          0%, 100% { box-shadow: 0 0 10px rgba(99, 102, 241, 0.3); }
          50% { box-shadow: 0 0 20px rgba(99, 102, 241, 0.5); }
        }

        .task-header {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .task-icon {
          font-size: 16px;
        }

        .task-label {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-weight: 600;
          font-size: 13px;
        }

        .status-indicator {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .task-description {
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid rgba(99, 102, 241, 0.3);
          font-size: 11px;
          color: #94A3B8;
          line-height: 1.4;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .task-running-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 8px;
          font-size: 10px;
          color: #6366F1;
        }

        .running-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #6366F1;
          animation: running-pulse 1s infinite;
        }

        @keyframes running-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        .task-handle {
          width: 10px !important;
          height: 10px !important;
          background: #6366F1 !important;
          border: 2px solid #1E1B4B !important;
        }
      `}</style>
    </div>
  );
});

TaskNode.displayName = 'TaskNode';

export default TaskNode;

/**
 * Node type registration helper
 */
export const TASK_NODE_TYPE = 'task';
