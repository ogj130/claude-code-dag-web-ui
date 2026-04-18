/**
 * DataDashboardModal — 数据总览仪表盘弹窗包装器
 */

import { useEffect } from 'react';
import { DataDashboard } from '@/components/DataDashboard';
import '@/styles/DataDashboardModal.css';

export interface DataDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DataDashboardModal({ isOpen, onClose }: DataDashboardModalProps) {
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
      <div className="dd-overlay" onClick={onClose} />
      <div className="dd-container" role="dialog" aria-modal="true" aria-label="数据总览">
        {/* Header */}
        <div className="dd-header">
          <h2 className="dd-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/>
              <path d="M22 12A10 10 0 0 0 12 2v10z"/>
            </svg>
            数据总览
          </h2>
          <button className="dd-close" onClick={onClose} aria-label="关闭">×</button>
        </div>
        {/* Dashboard 主体 */}
        <div className="dd-body">
          <DataDashboard />
        </div>
      </div>
    </>
  );
}
