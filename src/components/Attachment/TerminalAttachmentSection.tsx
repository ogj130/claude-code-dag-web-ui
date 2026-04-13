/**
 * V1.4.1 - TerminalAttachmentSection Component
 * Displays sent attachments in the terminal
 */

import {
  formatFileSize,
  getFileIcon,
  getFileTypeColor,
  type PendingAttachment,
} from '../../types/attachment';

interface TerminalAttachmentSectionProps {
  attachments: PendingAttachment[];
  onPreview: (attachment: PendingAttachment) => void;
}

export function TerminalAttachmentSection({ attachments, onPreview }: TerminalAttachmentSectionProps) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="terminal-attachment-section">
      {/* Header */}
      <div className="terminal-attachment-header">
        <div className="terminal-attachment-title">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
          </svg>
          <span>附件</span>
          <span className="terminal-attachment-count">{attachments.length}</span>
        </div>
      </div>

      {/* Attachment list */}
      <div className="terminal-attachment-list">
        {attachments.map((attachment) => (
          <div
            key={attachment.id}
            className="terminal-attachment-item"
            onClick={() => onPreview(attachment)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onPreview(attachment)}
          >
            {/* Thumbnail */}
            <div className="terminal-attachment-thumb">
              {attachment.type === 'image' && attachment.thumbnailData ? (
                <img src={attachment.thumbnailData} alt={attachment.fileName} />
              ) : (
                <span
                  className="terminal-attachment-icon"
                  style={{ backgroundColor: `${getFileTypeColor(attachment.type)}15` }}
                >
                  {getFileIcon(attachment.type, attachment.mimeType)}
                </span>
              )}
            </div>

            {/* Info */}
            <div className="terminal-attachment-info">
              <span className="terminal-attachment-name">{attachment.fileName}</span>
              <span className="terminal-attachment-meta">
                {formatFileSize(attachment.fileSize)}
              </span>
            </div>

            {/* Preview hint */}
            <span className="terminal-attachment-hint">点击预览</span>
          </div>
        ))}
      </div>

      <style>{`
        .terminal-attachment-section {
          margin: 8px 12px;
          border: 1px solid rgba(99, 102, 241, 0.3);
          border-radius: 8px;
          overflow: hidden;
          background: rgba(99, 102, 241, 0.02);
        }

        .terminal-attachment-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 10px;
          background: rgba(99, 102, 241, 0.06);
          border-bottom: 1px solid rgba(99, 102, 241, 0.15);
        }

        .terminal-attachment-title {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 10px;
          font-weight: 600;
          color: #6366F1;
          letter-spacing: 0.03em;
          text-transform: uppercase;
        }

        .terminal-attachment-count {
          background: #6366F1;
          color: white;
          padding: 1px 6px;
          border-radius: 10px;
          font-size: 9px;
        }

        .terminal-attachment-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          padding: 8px;
        }

        .terminal-attachment-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 10px;
          background: var(--bg-card, #1e1e2e);
          border: 1px solid var(--border, #2a2a3a);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s;
          min-width: 140px;
        }

        .terminal-attachment-item:hover {
          border-color: #6366F1;
          background: rgba(99, 102, 241, 0.08);
        }

        .terminal-attachment-thumb {
          width: 32px;
          height: 32px;
          border-radius: 4px;
          overflow: hidden;
          flex-shrink: 0;
        }

        .terminal-attachment-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .terminal-attachment-icon {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          border-radius: 4px;
        }

        .terminal-attachment-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .terminal-attachment-name {
          font-size: 11px;
          font-weight: 500;
          color: var(--text-primary, #e2e2ef);
          font-family: 'JetBrains Mono', monospace;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .terminal-attachment-meta {
          font-size: 9px;
          color: var(--text-muted, #6b6b7e);
        }

        .terminal-attachment-hint {
          font-size: 9px;
          color: var(--text-dim, #4a4a5e);
          opacity: 0;
          transition: opacity 0.15s;
          white-space: nowrap;
        }

        .terminal-attachment-item:hover .terminal-attachment-hint {
          opacity: 1;
        }
      `}</style>
    </div>
  );
}
