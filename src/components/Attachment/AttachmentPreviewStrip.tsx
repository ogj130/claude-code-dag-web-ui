/**
 * V1.4.1 - AttachmentPreviewStrip Component
 * Compact preview strip for pending attachments
 */

import React, { useRef } from 'react';
import { usePendingAttachments } from '../../stores/useAttachmentStore';
import {
  formatFileSize,
  getFileIcon,
  getFileTypeColor,
  type PendingAttachment,
} from '../../types/attachment';

interface AttachmentPreviewStripProps {
  onRemove: (id: string) => void;
  onClearAll: () => void;
  onToggleExpand: () => void;
  onPreview: (attachment: PendingAttachment) => void;
  onFileSelect: (files: FileList | null) => void;
}

export function AttachmentPreviewStrip({
  onRemove,
  onClearAll,
  onToggleExpand,
  onPreview,
  onFileSelect,
}: AttachmentPreviewStripProps) {
  const attachments = usePendingAttachments();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Show max 4 thumbnails in strip
  const displayAttachments = attachments.slice(0, 4);
  const overflowCount = attachments.length - 4;

  const handleAddClick = () => {
    fileInputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFileSelect(e.target.files);
    e.target.value = ''; // Reset to allow selecting same file again
  };

  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="attachment-preview-strip">
      {/* Compact thumbnails */}
      {displayAttachments.map((attachment) => (
        <CompactThumbnail
          key={attachment.id}
          attachment={attachment}
          onRemove={() => onRemove(attachment.id)}
          onPreview={() => onPreview(attachment)}
        />
      ))}

      {/* Overflow badge */}
      {overflowCount > 0 && (
        <button
          className="attachment-overflow-badge"
          onClick={onToggleExpand}
          title={`还有 ${overflowCount} 个附件，点击展开查看全部`}
        >
          +{overflowCount}
        </button>
      )}

      {/* Add more button */}
      <button
        className="attachment-add-btn"
        onClick={handleAddClick}
        title="添加附件"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {/* Divider */}
      <span className="attachment-strip-divider" />

      {/* Clear all button */}
      <button
        className="attachment-clear-btn"
        onClick={onClearAll}
        title="清空所有附件"
      >
        清空
      </button>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,.txt,.md,.markdown,.json,.log"
        multiple
        style={{ display: 'none' }}
        onChange={handleInputChange}
      />

      <style>{`
        .attachment-preview-strip {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: rgba(99, 102, 241, 0.04);
          border: 1px solid rgba(99, 102, 241, 0.2);
          border-top: none;
          flex-wrap: wrap;
          min-height: 36px;
        }

        .attachment-thumbnail {
          position: relative;
          width: 44px;
          height: 44px;
          border-radius: 6px;
          overflow: hidden;
          border: 1px solid var(--border, #2a2a3a);
          flex-shrink: 0;
          cursor: pointer;
          transition: all 0.15s ease;
          background: var(--bg-card, #1e1e2e);
        }

        .attachment-thumbnail:hover {
          border-color: var(--attachment-primary, #6366F1);
          transform: scale(1.05);
        }

        .attachment-thumbnail img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .attachment-thumbnail .type-icon {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
        }

        .attachment-thumbnail .remove-btn {
          position: absolute;
          top: -4px;
          right: -4px;
          width: 16px;
          height: 16px;
          background: #EF4444;
          border: 2px solid var(--bg-card, #1e1e2e);
          border-radius: 50%;
          color: white;
          font-size: 10px;
          line-height: 1;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.15s;
        }

        .attachment-thumbnail:hover .remove-btn {
          opacity: 1;
        }

        .attachment-overflow-badge {
          width: 44px;
          height: 44px;
          border-radius: 6px;
          border: 1px dashed var(--border, #2a2a3a);
          background: var(--bg-card, #1e1e2e);
          color: var(--text-secondary, #8b8b9e);
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }

        .attachment-overflow-badge:hover {
          border-color: var(--attachment-primary, #6366F1);
          color: var(--attachment-primary, #6366F1);
        }

        .attachment-add-btn {
          width: 32px;
          height: 32px;
          border-radius: 6px;
          border: 1px dashed var(--border, #2a2a3a);
          background: transparent;
          color: var(--text-muted, #6b6b7e);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
        }

        .attachment-add-btn:hover {
          border-color: var(--attachment-primary, #6366F1);
          color: var(--attachment-primary, #6366F1);
          background: rgba(99, 102, 241, 0.08);
        }

        .attachment-strip-divider {
          width: 1px;
          height: 20px;
          background: var(--border, #2a2a3a);
          margin: 0 4px;
        }

        .attachment-clear-btn {
          padding: 4px 10px;
          border-radius: 4px;
          border: none;
          background: transparent;
          color: var(--text-muted, #6b6b7e);
          font-size: 11px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .attachment-clear-btn:hover {
          color: #EF4444;
          background: rgba(239, 68, 68, 0.1);
        }
      `}</style>
    </div>
  );
}

// Compact thumbnail component
interface CompactThumbnailProps {
  attachment: PendingAttachment;
  onRemove: () => void;
  onPreview: () => void;
}

function CompactThumbnail({ attachment, onRemove, onPreview }: CompactThumbnailProps) {
  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove();
  };

  const statusColor = attachment.status === 'error' ? '#EF4444' : undefined;

  return (
    <div
      className="attachment-thumbnail"
      onClick={onPreview}
      title={`${attachment.fileName} (${formatFileSize(attachment.fileSize)})`}
      style={statusColor ? { borderColor: statusColor } : undefined}
    >
      {attachment.type === 'image' && attachment.thumbnailData ? (
        <img src={attachment.thumbnailData} alt={attachment.fileName} />
      ) : (
        <div
          className="type-icon"
          style={{ backgroundColor: `${getFileTypeColor(attachment.type)}15` }}
        >
          {getFileIcon(attachment.type, attachment.mimeType)}
        </div>
      )}
      <button
        className="remove-btn"
        onClick={handleRemove}
        title="移除"
      >
        ×
      </button>
      {attachment.status === 'processing' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
          }}
        >
          <span className="spinner" />
        </div>
      )}
    </div>
  );
}
