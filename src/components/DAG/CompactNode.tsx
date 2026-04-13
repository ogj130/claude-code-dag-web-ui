/**
 * V1.4.0 - CompactNode Component
 * Context compaction indicator for DAG visualization
 */

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { DAGNode } from '../../types/events';

interface CompactNodeData extends DAGNode {
  savingsPct?: number;
  beforeTokens?: number;
  afterTokens?: number;
  onClick?: (nodeId: string) => void;
}

interface CompactNodeProps {
  data: CompactNodeData;
  selected?: boolean;
}

/**
 * CompactNode component
 * Displays as a dashed orange triangle with token savings
 */
const CompactNode: React.FC<CompactNodeProps> = memo(({
  data,
  selected,
}) => {
  const {
    id,
    savingsPct = 0,
    beforeTokens = 0,
    afterTokens = 0,
    onClick,
  } = data;

  // Handle click to open context history drawer
  const handleClick = () => {
    onClick?.(id);
  };

  return (
    <div
      className={`compact-node ${selected ? 'selected' : ''}`}
      onClick={handleClick}
      title={`Context compressed: saved ${savingsPct.toFixed(1)}% tokens\nBefore: ${beforeTokens.toLocaleString()} tokens\nAfter: ${afterTokens.toLocaleString()} tokens`}
    >
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="compact-handle"
      />

      {/* Triangle indicator */}
      <div className="compact-indicator">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2L22 20H2L12 2Z" strokeDasharray="4 2" />
        </svg>
      </div>

      {/* Savings percentage */}
      <div className="compact-savings">
        <span className="savings-value">-{savingsPct.toFixed(0)}%</span>
        <span className="savings-label">compressed</span>
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="compact-handle"
      />

      <style>{`
        .compact-node {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(245, 158, 11, 0.1);
          border: 2px dashed #F59E0B;
          border-radius: 8px;
          padding: 6px 10px;
          cursor: pointer;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 11px;
          color: #F59E0B;
          transition: border-color 0.2s, background-color 0.2s;
          min-width: 100px;
        }

        .compact-node:hover {
          background: rgba(245, 158, 11, 0.2);
          border-color: #FBBF24;
        }

        .compact-node.selected {
          border-color: #FBBF24;
          box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.3);
        }

        .compact-indicator {
          color: #F59E0B;
          flex-shrink: 0;
        }

        .compact-savings {
          display: flex;
          flex-direction: column;
          line-height: 1.2;
        }

        .savings-value {
          font-weight: 700;
          font-size: 14px;
          color: #FBBF24;
        }

        .savings-label {
          font-size: 9px;
          color: #D97706;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .compact-handle {
          width: 8px !important;
          height: 8px !important;
          background: #F59E0B !important;
          border: 2px solid rgba(245, 158, 11, 0.1) !important;
        }
      `}</style>
    </div>
  );
});

CompactNode.displayName = 'CompactNode';

export default CompactNode;

/**
 * Node type registration helper
 */
export const COMPACT_NODE_TYPE = 'compact';
