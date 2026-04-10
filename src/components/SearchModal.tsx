/**
 * SearchModal — 全局搜索 Modal
 *
 * 快捷键：Cmd/Ctrl+K 打开，Esc 关闭
 * 功能：
 * - 搜索输入框（带清除按钮）
 * - 搜索结果列表（会话 + 问答，支持高亮）
 * - 搜索历史（最近 10 条）
 * - 高级筛选面板（日期范围、工具类型、标签）
 * - 键盘上下箭头导航 + Enter 选择
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useId,
} from 'react';
import { useSearch } from '@/hooks/useSearch';
import type { SearchResult } from '@/stores/searchIndex';
import '@/styles/search-modal.css';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function truncate(text: string, maxLen: number): string {
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '…';
}

// ---------------------------------------------------------------------------
// ResultItem
// ---------------------------------------------------------------------------

interface ResultItemProps {
  result: SearchResult;
  isSelected: boolean;
  onClick: () => void;
  highlightQuery: (text: string) => string;
}

function ResultItem({ result, isSelected, onClick, highlightQuery }: ResultItemProps) {
  const { doc } = result;
  const isSession = doc.type === 'session';

  return (
    <div
      className={`search-modal__result-item ${isSelected ? 'search-modal__result-item--selected' : ''}`}
      onClick={onClick}
      role="option"
      aria-selected={isSelected}
    >
      <div className="search-modal__result-header">
        <span className={`search-modal__result-badge search-modal__result-badge--${doc.type}`}>
          {isSession ? '会话' : '问答'}
        </span>
        <span className="search-modal__result-time">{formatRelativeTime(doc.createdAt)}</span>
      </div>

      <div
        className="search-modal__result-title"
        dangerouslySetInnerHTML={{
          __html: highlightQuery(isSession ? (doc.title ?? '无标题') : truncate(doc.question ?? '', 80)),
        }}
      />

      {!isSession && doc.answer && (
        <div
          className="search-modal__result-preview"
          dangerouslySetInnerHTML={{
            __html: highlightQuery(truncate(doc.answer ?? '', 120)),
          }}
        />
      )}

      {doc.tags.length > 0 && (
        <div className="search-modal__result-tags">
          {doc.tags.map(tag => (
            <span key={tag} className="search-modal__tag">{tag}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FilterPanel
// ---------------------------------------------------------------------------

interface FilterPanelProps {
  filters: ReturnType<typeof useSearch>['filters'];
  availableTags: string[];
  availableToolTypes: string[];
  onUpdate: ReturnType<typeof useSearch>['updateFilters'];
  onClear: ReturnType<typeof useSearch>['clearFilters'];
}

function FilterPanel({
  filters,
  availableTags,
  availableToolTypes,
  onUpdate,
  onClear,
}: FilterPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const { dateRange, tags, toolTypes } = filters;
  const hasFilters = tags.length > 0 || toolTypes.length > 0 || dateRange.from || dateRange.to;

  return (
    <div className="search-modal__filter-panel">
      <button
        className={`search-modal__filter-toggle ${hasFilters ? 'search-modal__filter-toggle--active' : ''}`}
        onClick={() => setExpanded(v => !v)}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        筛选
        {hasFilters && <span className="search-modal__filter-badge" />}
      </button>

      {expanded && (
        <div className="search-modal__filter-content">
          {/* 日期范围 */}
          <div className="search-modal__filter-section">
            <div className="search-modal__filter-label">日期范围</div>
            <div className="search-modal__filter-row">
              <input
                type="date"
                className="search-modal__filter-input"
                value={dateRange.from ? formatDate(dateRange.from).replace(/\//g, '-') : ''}
                onChange={e => {
                  const val = e.target.value;
                  onUpdate({
                    dateRange: {
                      ...dateRange,
                      from: val ? new Date(val).getTime() : undefined,
                    },
                  });
                }}
              />
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>至</span>
              <input
                type="date"
                className="search-modal__filter-input"
                value={dateRange.to ? formatDate(dateRange.to).replace(/\//g, '-') : ''}
                onChange={e => {
                  const val = e.target.value;
                  onUpdate({
                    dateRange: {
                      ...dateRange,
                      to: val ? new Date(val).getTime() + 86399999 : undefined,
                    },
                  });
                }}
              />
            </div>
          </div>

          {/* 工具类型 */}
          {availableToolTypes.length > 0 && (
            <div className="search-modal__filter-section">
              <div className="search-modal__filter-label">工具类型</div>
              <div className="search-modal__filter-chips">
                {availableToolTypes.slice(0, 10).map(tool => (
                  <button
                    key={tool}
                    className={`search-modal__chip ${toolTypes.includes(tool) ? 'search-modal__chip--active' : ''}`}
                    onClick={() => {
                      const next = toolTypes.includes(tool)
                        ? toolTypes.filter(t => t !== tool)
                        : [...toolTypes, tool];
                      onUpdate({ toolTypes: next });
                    }}
                  >
                    {tool}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 标签 */}
          {availableTags.length > 0 && (
            <div className="search-modal__filter-section">
              <div className="search-modal__filter-label">标签</div>
              <div className="search-modal__filter-chips">
                {availableTags.slice(0, 10).map(tag => (
                  <button
                    key={tag}
                    className={`search-modal__chip ${tags.includes(tag) ? 'search-modal__chip--active' : ''}`}
                    onClick={() => {
                      const next = tags.includes(tag)
                        ? tags.filter(t => t !== tag)
                        : [...tags, tag];
                      onUpdate({ tags: next });
                    }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {hasFilters && (
            <button className="search-modal__filter-clear" onClick={onClear}>
              清除所有筛选
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SearchModal
// ---------------------------------------------------------------------------

export interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 选择结果后的回调 */
  onSelect: (result: SearchResult) => void;
}

export function SearchModal({ isOpen, onClose, onSelect }: SearchModalProps) {
  const searchHook = useSearch();
  const {
    query,
    setQuery,
    results,
    isLoading,
    isIndexReady,
    filters,
    availableTags,
    availableToolTypes,
    history,
    selectedIndex,
    submitSearch,
    moveSelection,
    updateFilters,
    clearFilters,
    removeHistoryItem,
    highlightQuery,
    clearHistory,
  } = searchHook;

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputId = useId();

  // 打开时聚焦输入框
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen, setQuery]);

  // 滚动到选中项
  useEffect(() => {
    if (selectedIndex < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll('.search-modal__result-item');
    const item = items[selectedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // 键盘事件
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = moveSelection('down');
        void next;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = moveSelection('up');
        void prev;
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedIndex >= 0 && results[selectedIndex]) {
          submitSearch(query);
          onSelect(results[selectedIndex]);
          onClose();
        } else if (query.trim()) {
          submitSearch(query);
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    },
    [moveSelection, selectedIndex, results, submitSearch, query, onSelect, onClose]
  );

  const handleResultClick = useCallback(
    (result: SearchResult) => {
      submitSearch(query);
      onSelect(result);
      onClose();
    },
    [submitSearch, query, onSelect, onClose]
  );

  const handleHistoryClick = useCallback(
    (h: string) => {
      setQuery(h);
      inputRef.current?.focus();
    },
    [setQuery]
  );

  if (!isOpen) return null;

  const showResults = query.trim().length > 0;
  const showEmptyState = showResults && results.length === 0 && !isLoading;

  return (
    <div className="search-modal__overlay" onClick={onClose}>
      <div
        className="search-modal__dialog"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="全局搜索"
      >
        {/* Header: 搜索框 */}
        <div className="search-modal__header">
          <div className="search-modal__search-row">
            <svg className="search-modal__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              ref={inputRef}
              id={inputId}
              className="search-modal__input"
              type="text"
              placeholder={isIndexReady ? '搜索会话、问答内容…' : '正在构建索引…'}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!isIndexReady}
              autoComplete="off"
              spellCheck={false}
            />
            {isLoading && (
              <span className="search-modal__spinner" aria-label="搜索中" />
            )}
            {query && (
              <button
                className="search-modal__clear"
                onClick={() => setQuery('')}
                aria-label="清除搜索"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          <FilterPanel
            filters={filters}
            availableTags={availableTags}
            availableToolTypes={availableToolTypes}
            onUpdate={updateFilters}
            onClear={clearFilters}
          />
        </div>

        {/* Body: 结果或历史 */}
        <div className="search-modal__body" role="listbox" aria-label="搜索结果">
          {showResults ? (
            <>
              {showEmptyState ? (
                <div className="search-modal__empty">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <circle cx="11" cy="11" r="8" />
                    <path d="M21 21l-4.35-4.35" />
                  </svg>
                  <p>未找到相关结果</p>
                  <span>尝试其他关键词或调整筛选条件</span>
                </div>
              ) : (
                <div className="search-modal__results" ref={listRef}>
                  {results.map((result, i) => (
                    <ResultItem
                      key={result.doc.id}
                      result={result}
                      isSelected={i === selectedIndex}
                      onClick={() => handleResultClick(result)}
                      highlightQuery={highlightQuery}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              {/* 搜索历史 */}
              {history.length > 0 && (
                <div className="search-modal__section">
                  <div className="search-modal__section-header">
                    <span>最近搜索</span>
                    <button
                      className="search-modal__clear-history"
                      onClick={clearHistory}
                    >
                      清除
                    </button>
                  </div>
                  {history.map(h => (
                    <div key={h} className="search-modal__history-item">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <polyline points="1 4 1 10 7 10" />
                        <path d="M3.51 15a9 9 0 1 0 .49-3.51" />
                      </svg>
                      <button
                        className="search-modal__history-text"
                        onClick={() => handleHistoryClick(h)}
                      >
                        {h}
                      </button>
                      <button
                        className="search-modal__history-remove"
                        onClick={e => {
                          e.stopPropagation();
                          removeHistoryItem(h);
                        }}
                        aria-label="删除"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* 快捷键提示 */}
              <div className="search-modal__shortcuts">
                <span><kbd>↑↓</kbd> 导航</span>
                <span><kbd>Enter</kbd> 打开</span>
                <span><kbd>Esc</kbd> 关闭</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
