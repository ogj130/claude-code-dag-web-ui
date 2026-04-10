/**
 * HistoryPanel — 问答历史面板
 *
 * 显示所有已完成的问答记录（Markdown 卡片）
 * 按 Cmd/Ctrl+H 切换显示
 */

import { useState, useCallback, useRef } from 'react';
import { useTaskStore } from '../stores/useTaskStore';
import '@/styles/history-panel.css';

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 30) return `${days} 天前`;
  return new Date(timestamp).toLocaleDateString('zh-CN');
}

function truncate(text: string, maxLen: number): string {
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '…';
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function HistoryPanel({ isOpen, onClose }: Props) {
  const { markdownCards, currentCard } = useTaskStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  if (!isOpen) return null;

  const allCards = [...markdownCards].reverse();

  return (
    <div className="history-panel__overlay" onClick={onClose}>
      <div
        ref={panelRef}
        className="history-panel__panel"
        onClick={e => e.stopPropagation()}
      >
        <div className="history-panel__header">
          <h2 className="history-panel__title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 .49-3.51" />
            </svg>
            问答历史
            <span className="history-panel__count">{allCards.length}</span>
          </h2>
          <button className="history-panel__close" onClick={onClose} aria-label="关闭">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="history-panel__body">
          {/* 进行中的卡片 */}
          {currentCard && (
            <div className="history-panel__card history-panel__card--active">
              <div className="history-panel__card-header">
                <span className="history-panel__status-dot history-panel__status-dot--running" />
                <span className="history-panel__card-time">进行中</span>
              </div>
              <div className="history-panel__card-query">{truncate(currentCard.query, 80)}</div>
            </div>
          )}

          {/* 已完成的卡片 */}
          {allCards.length === 0 && !currentCard && (
            <div className="history-panel__empty">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              <p>暂无问答历史</p>
            </div>
          )}

          {allCards.map(card => {
            const isExpanded = expandedId === card.id;
            return (
              <div
                key={card.id}
                className={`history-panel__card ${isExpanded ? 'history-panel__card--expanded' : ''}`}
                onClick={() => handleToggleExpand(card.id)}
              >
                <div className="history-panel__card-header">
                  <span className="history-panel__status-dot history-panel__status-dot--done" />
                  <span className="history-panel__card-time">{formatRelativeTime(card.timestamp)}</span>
                </div>
                <div className="history-panel__card-query">
                  {isExpanded ? card.query : truncate(card.query, 60)}
                </div>
                {isExpanded && card.summary && (
                  <div className="history-panel__card-summary">
                    {truncate(card.summary, 300)}
                  </div>
                )}
                {card.summary && (
                  <div className="history-panel__card-expand-hint">
                    {isExpanded ? '收起' : '点击展开'}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="history-panel__footer">
          <kbd>Cmd+H</kbd> 切换此面板 &middot; <kbd>Esc</kbd> 关闭
        </div>
      </div>
    </div>
  );
}
