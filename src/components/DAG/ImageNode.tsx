/**
 * V1.4.0 - ImageNode Component
 * Image node for multimodal input visualization
 */

import React, { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { ImageNodeStatus } from '../../types/multimodal';

interface ImageNodeData {
  // Override DAGNode's status with ImageNodeStatus
  id: string;
  label: string;
  type: string;
  status: ImageNodeStatus;
  imageData?: string;
  thumbnailData?: string;
  mimeType?: string;
}

interface ImageNodeProps {
  data: ImageNodeData;
  selected?: boolean;
}

const statusConfig: Record<ImageNodeStatus, { color: string; label: string }> = {
  pending: { color: '#94A3B8', label: 'Pending' },
  analyzing: { color: '#6366F1', label: 'Analyzing...' },
  completed: { color: '#10B981', label: 'Completed' },
  failed: { color: '#EF4444', label: 'Failed' },
  timeout: { color: '#F59E0B', label: 'Timeout' },
};

const ImageNode: React.FC<ImageNodeProps> = memo(({
  data,
  selected,
}) => {
  const {
    label,
    status = 'pending',
    imageData,
    thumbnailData,
  } = data;
  const [showFull, setShowFull] = useState(false);

  const config = statusConfig[status as ImageNodeStatus] || statusConfig.pending;
  const displayImage = thumbnailData || imageData;

  return (
    <div
      className={`image-node ${selected ? 'selected' : ''}`}
      data-status={status}
      onClick={() => setShowFull(!showFull)}
    >
      <Handle type="target" position={Position.Left} className="image-handle" />

      <div className="image-header">
        <span className="image-icon">🖼️</span>
        <span className="image-label">{label}</span>
        <span
          className="status-badge"
          style={{ backgroundColor: config.color }}
        >
          {config.label}
        </span>
      </div>

      {displayImage && (
        <div className="image-preview">
          <img
            src={displayImage}
            alt={label}
            className="preview-img"
          />
        </div>
      )}

      {status === 'analyzing' && (
        <div className="analyzing-indicator">
          <span className="spinner" />
          <span>Analyzing image...</span>
        </div>
      )}

      <Handle type="source" position={Position.Right} className="image-handle" />

      {showFull && imageData && (
        <div className="full-image-overlay" onClick={(e) => e.stopPropagation()}>
          <img src={imageData} alt={label} className="full-image" />
          <button className="close-btn" onClick={() => setShowFull(false)}>×</button>
        </div>
      )}

      <style>{`
        .image-node {
          background: #1E1B4B;
          border: 2px solid #6366F1;
          border-radius: 10px;
          padding: 8px;
          min-width: 160px;
          max-width: 220px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 11px;
          color: #E2E8F0;
          cursor: pointer;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .image-node.selected {
          border-color: #818CF8;
          box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.3);
        }
        .image-header {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 6px;
        }
        .image-icon { font-size: 14px; }
        .image-label {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-weight: 500;
        }
        .status-badge {
          font-size: 9px;
          padding: 2px 6px;
          border-radius: 10px;
          color: white;
          font-weight: 600;
        }
        .image-preview {
          border-radius: 6px;
          overflow: hidden;
          background: #0F0D1A;
        }
        .preview-img {
          width: 100%;
          height: 80px;
          object-fit: cover;
        }
        .analyzing-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 6px;
          font-size: 10px;
          color: #6366F1;
        }
        .spinner {
          width: 12px;
          height: 12px;
          border: 2px solid #6366F1;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .image-handle {
          width: 8px !important;
          height: 8px !important;
          background: #6366F1 !important;
        }
        .full-image-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .full-image { max-width: 90vw; max-height: 90vh; object-fit: contain; }
        .close-btn {
          position: absolute;
          top: 20px;
          right: 20px;
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          font-size: 24px;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          cursor: pointer;
        }
        .close-btn:hover { background: rgba(255,255,255,0.3); }
      `}</style>
    </div>
  );
});

ImageNode.displayName = 'ImageNode';
export default ImageNode;
export const IMAGE_NODE_TYPE = 'image';
