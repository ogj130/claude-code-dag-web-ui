/**
 * ShortcutHelp — 快捷键帮助面板
 *
 * 显示所有可用的快捷键及其描述
 * 按 ? 键或点击按钮打开，Esc 关闭
 */

import React from 'react';
import type { Shortcut } from '@/hooks/useKeyboardShortcuts';
import '@/styles/shortcut-help.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  shortcuts: Shortcut[];
  conflicts: Array<{ combo: string; description: string; warning: string }>;
}

export function ShortcutHelp({ isOpen, onClose, shortcuts, conflicts }: Props) {
  if (!isOpen) return null;

  return (
    <div className="shortcut-help__overlay" onClick={onClose}>
      <div
        className="shortcut-help__dialog"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="快捷键帮助"
      >
        <div className="shortcut-help__header">
          <h2 className="shortcut-help__title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x="2" y="6" width="20" height="12" rx="2" />
              <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" />
            </svg>
            快捷键
          </h2>
          <button className="shortcut-help__close" onClick={onClose} aria-label="关闭">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="shortcut-help__body">
          {/* 快捷键列表 */}
          <div className="shortcut-help__list">
            {shortcuts.map(s => (
              <div key={s.combo} className="shortcut-help__item">
                <span className="shortcut-help__key">
                  {s.key.split('+').map((part, i) => (
                    <React.Fragment key={part}>
                      {i > 0 && <span className="shortcut-help__plus">+</span>}
                      <kbd>{part}</kbd>
                    </React.Fragment>
                  ))}
                </span>
                <span className="shortcut-help__desc">{s.description}</span>
                <span className="shortcut-help__scope">
                  {s.scope === 'global' ? '全局' : s.scope === 'dag' ? 'DAG' : '弹窗'}
                </span>
              </div>
            ))}
          </div>

          {/* 冲突警告 */}
          {conflicts.length > 0 && (
            <div className="shortcut-help__conflicts">
              <div className="shortcut-help__conflicts-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                浏览器冲突提示
              </div>
              {conflicts.map(c => (
                <div key={c.combo} className="shortcut-help__conflict-item">
                  <kbd>{c.combo}</kbd>
                  <span>{c.warning}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="shortcut-help__footer">
          按 <kbd>?</kbd> 切换此面板 &middot; <kbd>Esc</kbd> 关闭
        </div>
      </div>
    </div>
  );
}
