/**
 * V1.4.1 - AttachmentDetailPanel Component
 * Expandable panel showing attachment details
 */

import { useAttachmentStore, usePendingAttachments } from '../../stores/useAttachmentStore';
import { AttachmentCard } from './AttachmentCard';
import type { PendingAttachment } from '../../types/attachment';

interface AttachmentDetailPanelProps {
  onRemove: (id: string) => void;
  onPreview: (attachment: PendingAttachment) => void;
}

export function AttachmentDetailPanel({ onRemove, onPreview }: AttachmentDetailPanelProps) {
  const { isPreviewExpanded, setPreviewExpanded } = useAttachmentStore();
  const attachments = usePendingAttachments();

  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className={`attachment-detail-panel ${isPreviewExpanded ? 'expanded' : ''}`}>
      {/* Panel header */}
      <div
        className="panel-header"
        onClick={() => setPreviewExpanded(!isPreviewExpanded)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setPreviewExpanded(!isPreviewExpanded)}
      >
        <div className="panel-title">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
          </svg>
          <span>附件</span>
          <span className="attachment-count">{attachments.length}</span>
        </div>
        <div className="panel-toggle">
          {isPreviewExpanded ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="18 15 12 9 6 15" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          )}
          <span>{isPreviewExpanded ? '收起' : '展开'}</span>
        </div>
      </div>

      {/* Attachment cards */}
      {isPreviewExpanded && (
        <div className="attachment-cards">
          {attachments.map((attachment) => (
            <AttachmentCard
              key={attachment.id}
              attachment={attachment}
              onRemove={() => onRemove(attachment.id)}
              onPreview={() => onPreview(attachment)}
            />
          ))}
        </div>
      )}

      <style>{`
        .attachment-detail-panel {
          background: var(--bg-card, #1e1e2e);
          border: 1px solid rgba(99, 102, 241, 0.2);
          border-top: none;
          max-height: 0;
          overflow: hidden;
          transition: max-height 0.25s ease-out;
        }

        .attachment-detail-panel.expanded {
          max-height: 400px;
          overflow-y: auto;
        }

        .panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          background: rgba(99, 102, 241, 0.06);
          border-bottom: 1px solid rgba(99, 102, 241, 0.15);
          cursor: pointer;
          user-select: none;
          transition: background 0.15s;
        }

        .panel-header:hover {
          background: rgba(99, 102, 241, 0.1);
        }

        .panel-title {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 600;
          color: var(--attachment-primary, #6366F1);
          letter-spacing: 0.02em;
        }

        .attachment-count {
          background: var(--attachment-primary, #6366F1);
          color: white;
          padding: 1px 6px;
          border-radius: 10px;
          font-size: 9px;
          font-weight: 600;
        }

        .panel-toggle {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 10px;
          color: var(--text-secondary, #8b8b9e);
        }

        .attachment-cards {
          padding: 4px;
        }
      `}</style>
    </div>
  );
}
