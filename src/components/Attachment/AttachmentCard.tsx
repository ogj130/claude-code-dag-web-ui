/**
 * V1.4.1 - AttachmentCard Component
 * Detail card for a single attachment in the expandable panel
 */

import {
  formatFileSize,
  getFileIcon,
  getFileTypeColor,
  type PendingAttachment,
} from '../../types/attachment';

interface AttachmentCardProps {
  attachment: PendingAttachment;
  onRemove: () => void;
  onPreview: () => void;
}

export function AttachmentCard({ attachment, onRemove, onPreview }: AttachmentCardProps) {
  const typeColor = getFileTypeColor(attachment.type);

  return (
    <div className="attachment-card" onClick={onPreview}>
      {/* Thumbnail */}
      <div className="card-thumbnail">
        {attachment.type === 'image' && attachment.thumbnailData ? (
          <img src={attachment.thumbnailData} alt={attachment.fileName} />
        ) : (
          <div
            className="type-icon"
            style={{ backgroundColor: `${typeColor}15` }}
          >
            {getFileIcon(attachment.type, attachment.mimeType)}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="card-info">
        <div className="card-filename">{attachment.fileName}</div>
        <div className="card-meta">
          <span className="card-type" style={{ color: typeColor }}>
            {getTypeLabel(attachment.mimeType)}
          </span>
          <span className="card-size">{formatFileSize(attachment.fileSize)}</span>
          {attachment.type === 'image' && (
            <span className="card-status-badge" style={{ color: typeColor }}>
              图片
            </span>
          )}
        </div>

        {/* Text preview */}
        {attachment.type === 'text' && attachment.textPreview && (
          <div className="card-preview">
            {attachment.textPreview}
            {attachment.textContent && attachment.textContent.length > 200 && '...'}
          </div>
        )}

        {/* Processing status */}
        {attachment.status === 'processing' && (
          <div className="card-status processing">
            <span className="spinner-small" />
            处理中...
          </div>
        )}

        {/* Error status */}
        {attachment.status === 'error' && (
          <div className="card-status error">
            {attachment.error || '处理失败'}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="card-actions">
        <button
          className="card-action-btn preview"
          onClick={(e) => {
            e.stopPropagation();
            onPreview();
          }}
          title="预览"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
        <button
          className="card-action-btn remove"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          title="移除"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <style>{`
        .attachment-card {
          display: flex;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.15s;
          border-bottom: 1px solid var(--border, #2a2a3a);
        }

        .attachment-card:last-child {
          border-bottom: none;
        }

        .attachment-card:hover {
          background: var(--bg-hover, #252536);
        }

        .card-thumbnail {
          width: 56px;
          height: 56px;
          border-radius: 6px;
          overflow: hidden;
          border: 1px solid var(--border, #2a2a3a);
          flex-shrink: 0;
        }

        .card-thumbnail img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .card-thumbnail .type-icon {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }

        .card-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .card-filename {
          font-size: 12px;
          font-weight: 500;
          color: var(--text-primary, #e2e2ef);
          font-family: 'JetBrains Mono', monospace;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .card-meta {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 10px;
          color: var(--text-muted, #6b6b7e);
        }

        .card-type {
          font-weight: 500;
        }

        .card-preview {
          margin-top: 4px;
          padding: 4px 8px;
          background: var(--bg-input, #0f0f17);
          border-radius: 4px;
          font-size: 10px;
          color: var(--text-secondary, #8b8b9e);
          font-family: 'JetBrains Mono', monospace;
          white-space: pre-wrap;
          overflow: hidden;
          max-height: 48px;
          line-height: 1.5;
        }

        .card-status {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          margin-top: 2px;
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 9px;
          font-weight: 500;
          width: fit-content;
        }

        .card-status.processing {
          background: rgba(99, 102, 241, 0.15);
          color: #6366F1;
        }

        .card-status.error {
          background: rgba(239, 68, 68, 0.15);
          color: #EF4444;
        }

        .spinner-small {
          width: 10px;
          height: 10px;
          border: 2px solid rgba(99, 102, 241, 0.3);
          border-top-color: #6366F1;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .card-actions {
          display: flex;
          flex-direction: column;
          gap: 4px;
          justify-content: center;
        }

        .card-action-btn {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          border: 1px solid var(--border, #2a2a3a);
          background: transparent;
          color: var(--text-muted, #6b6b7e);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
        }

        .card-action-btn:hover {
          border-color: var(--attachment-primary, #6366F1);
          color: var(--attachment-primary, #6366F1);
          background: rgba(99, 102, 241, 0.08);
        }

        .card-action-btn.remove:hover {
          border-color: #EF4444;
          color: #EF4444;
          background: rgba(239, 68, 68, 0.08);
        }
      `}</style>
    </div>
  );
}

function getTypeLabel(mimeType: string): string {
  if (mimeType.includes('image/png')) return 'PNG';
  if (mimeType.includes('image/jpeg')) return 'JPEG';
  if (mimeType.includes('image/webp')) return 'WebP';
  if (mimeType.includes('image/gif')) return 'GIF';
  if (mimeType.includes('markdown')) return 'Markdown';
  if (mimeType.includes('json')) return 'JSON';
  if (mimeType.includes('log')) return 'LOG';
  return 'Text';
}
