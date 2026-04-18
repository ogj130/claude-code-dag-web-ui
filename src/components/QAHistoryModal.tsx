/**
 * QAHistoryModal — 问答历史弹窗包装器
 */

import { useEffect } from 'react';
import { QAHistoryListView } from '@/components/QAHistory/QAHistoryListView';
import '@/styles/qa-history-modal.css';

export interface QAHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId?: string;
  sessionId?: string;
}

export function QAHistoryModal({ isOpen, onClose, workspaceId, sessionId }: QAHistoryModalProps) {
  // ESC 关闭
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div className="qah-overlay" onClick={onClose} />
      <div className="qah-container" role="dialog" aria-modal="true" aria-label="问答历史">
        {/* Header */}
        <div className="qah-header">
          <h2 className="qah-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            问答历史
          </h2>
          <button className="qah-close" onClick={onClose} aria-label="关闭">×</button>
        </div>
        {/* Content */}
        <div className="qah-body">
          <QAHistoryListView
            workspaceId={workspaceId}
            sessionId={sessionId}
          />
        </div>
      </div>
    </>
  );
}
