/**
 * RAGRetrievalModal — RAG 检索侧边面板（支持抽屉/弹窗双模式）
 *
 * 功能：
 * - 抽屉模式：右侧滑入，宽度 420px
 * - 弹窗模式：屏幕居中，宽度 720px，高度 80vh
 * - 面板内切换按钮，模式偏好持久化到 localStorage
 * - Cmd+Shift+R 切换显示
 */

import { useState } from 'react';
import { RAGRetrievalPanel } from './RAGRetrievalPanel';

const STORAGE_KEY = 'rag-panel-mode';

interface RAGRetrievalModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 打开设置面板并切换到指定标签页 */
  onOpenSettings?: (tab?: 'theme' | 'embedding') => void;
}

export function RAGRetrievalModal({ isOpen, onClose, onOpenSettings }: RAGRetrievalModalProps) {
  // 模式状态：drawer | modal，默认从 localStorage 读取
  const [mode, setMode] = useState<'drawer' | 'modal'>(() => {
    return (localStorage.getItem(STORAGE_KEY) as 'drawer' | 'modal') ?? 'drawer';
  });

  // 切换模式并持久化
  const toggleMode = () => {
    const next = mode === 'drawer' ? 'modal' : 'drawer';
    setMode(next);
    localStorage.setItem(STORAGE_KEY, next);
  };

  if (!isOpen) return null;

  const isDrawer = mode === 'drawer';

  return (
    <>
      {/* 遮罩层 */}
      <div className="rag-panel__overlay" onClick={onClose} />

      {/* 面板容器 */}
      <div className={isDrawer ? 'rag-panel__drawer' : 'rag-panel__modal'}>
        {/* 标题栏 */}
        <div className="rag-panel__header">
          <h2 className="rag-panel__title">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M9.5 9.5L12.5 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            RAG 检索
          </h2>

          {/* 切换按钮 */}
          <button
            className="rag-panel__toggle"
            onClick={toggleMode}
            title={isDrawer ? '切换到弹窗模式' : '切换到抽屉模式'}
          >
            {isDrawer ? (
              // 弹窗图标（4个角的方框）
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="1" y="1" width="5" height="5" rx="0.5" />
                <rect x="10" y="1" width="5" height="5" rx="0.5" />
                <rect x="1" y="10" width="5" height="5" rx="0.5" />
                <rect x="10" y="10" width="5" height="5" rx="0.5" />
              </svg>
            ) : (
              // 抽屉图标（侧边栏轮廓）
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="1" y="1" width="6" height="14" rx="0.5" />
                <line x1="9" y1="4" x2="15" y2="4" />
                <line x1="9" y1="8" x2="15" y2="8" />
                <line x1="9" y1="12" x2="15" y2="12" />
              </svg>
            )}
          </button>

          {/* 关闭按钮 */}
          <button className="rag-panel__close" onClick={onClose} aria-label="关闭 RAG 检索">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* 面板内容 */}
        <div className="rag-panel__body">
          <RAGRetrievalPanel onOpenSettings={onOpenSettings} />
        </div>
      </div>
    </>
  );
}
