/**
 * QAHistoryListView — 问答历史列表视图组件
 *
 * 功能：
 * - 列表视图，支持筛选栏
 * - 每条记录显示：prompt摘要、时间、token统计、评分星星
 * - 点击展开完整问答（Markdown 渲染）
 * - 支持：关键词搜索高亮、标签筛选、评分筛选、时间范围筛选、分页
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { searchQAHistory, getQAHistoryBySessionId, getQAHistoryByWorkspaceId } from '@/stores/qaHistoryStorage';
import { exportToMarkdown, exportToJSON, exportToHTML } from '@/services/qaHistoryExport';
import type { QAHistoryEntry, QASearchFilters } from '@/types/qaHistory';
import '@/styles/qa-history-list.css';

// ─── 常量 ───────────────────────────────────────────────────

const PAGE_SIZE = 10;

// ─── 辅助函数 ───────────────────────────────────────────────

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

function formatDateForInput(timestamp: number | undefined): string {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function truncate(text: string, maxLen: number): string {
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '…';
}

/** 高亮关键词 */
function HighlightText({ text, keyword }: { text: string; keyword: string }) {
  if (!keyword) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegex(keyword)})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === keyword.toLowerCase()
          ? <mark key={i} className="qa-history-highlight">{part}</mark>
          : part
      )}
    </>
  );
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 评分星星 */
function RatingStars({ rating }: { rating: number }) {
  return (
    <span className="qa-history-stars" aria-label={`${rating} 星`}>
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} className={`qa-history-star ${n <= rating ? 'qa-history-star--filled' : 'qa-history-star--empty'}`}>
          {n <= rating ? '★' : '☆'}
        </span>
      ))}
    </span>
  );
}

/** Markdown 渲染样式 */
const markdownStyles: Record<string, React.CSSProperties> = {
  h1: { fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '8px 0 4px' },
  h2: { fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: '6px 0 3px' },
  h3: { fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', margin: '4px 0 2px' },
  p: { margin: '4px 0' },
  ul: { paddingLeft: 16, margin: '4px 0' },
  ol: { paddingLeft: 16, margin: '4px 0' },
  li: { margin: '2px 0' },
  code: {
    background: 'rgba(255,255,255,0.06)',
    borderRadius: 3,
    padding: '1px 4px',
    fontSize: 10,
    fontFamily: "'JetBrains Mono', monospace",
    color: 'var(--accent)',
  },
  pre: {
    background: 'rgba(0,0,0,0.3)',
    borderRadius: 6,
    padding: '8px 10px',
    overflowX: 'auto',
    margin: '6px 0',
  },
  'pre code': {
    background: 'transparent',
    padding: 0,
    color: 'var(--text-secondary)',
    fontSize: 10,
  },
  blockquote: {
    borderLeft: '3px solid var(--success)',
    paddingLeft: 8,
    color: 'var(--text-muted)',
    margin: '4px 0',
    fontStyle: 'italic' as const,
  },
  table: { width: '100%', borderCollapse: 'collapse' as const, margin: '6px 0', fontSize: 10 },
  th: { borderBottom: '1px solid var(--border)', padding: '3px 6px', textAlign: 'left' as const, color: 'var(--text-primary)' },
  td: { borderBottom: '1px solid var(--border)', padding: '3px 6px', color: 'var(--text-secondary)' },
  a: { color: 'var(--accent)', textDecoration: 'none' },
  strong: { color: 'var(--text-primary)', fontWeight: 600 },
  em: { fontStyle: 'italic' as const },
  hr: { border: 'none', borderTop: '1px solid var(--border)', margin: '8px 0' },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mdComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => <h1 style={markdownStyles.h1}>{children}</h1>,
  h2: ({ children }: { children?: React.ReactNode }) => <h2 style={markdownStyles.h2}>{children}</h2>,
  h3: ({ children }: { children?: React.ReactNode }) => <h3 style={markdownStyles.h3}>{children}</h3>,
  p: ({ children }: { children?: React.ReactNode }) => <p style={markdownStyles.p}>{children}</p>,
  ul: ({ children }: { children?: React.ReactNode }) => <ul style={markdownStyles.ul}>{children}</ul>,
  ol: ({ children }: { children?: React.ReactNode }) => <ol style={markdownStyles.ol}>{children}</ol>,
  li: ({ children }: { children?: React.ReactNode }) => <li style={markdownStyles.li}>{children}</li>,
  code: ({ className, children, ...props }: { className?: string; children?: React.ReactNode; [key: string]: unknown }) => {
    const isBlock = className?.startsWith('language-');
    return isBlock
      ? <code style={markdownStyles['pre code']} className={className} {...props}>{children}</code>
      : <code style={markdownStyles.code} {...props}>{children}</code>;
  },
  pre: ({ children }: { children?: React.ReactNode }) => <pre style={markdownStyles.pre}>{children}</pre>,
  blockquote: ({ children }: { children?: React.ReactNode }) => <blockquote style={markdownStyles.blockquote}>{children}</blockquote>,
  table: ({ children }: { children?: React.ReactNode }) => <table style={markdownStyles.table}>{children}</table>,
  th: ({ children }: { children?: React.ReactNode }) => <th style={markdownStyles.th}>{children}</th>,
  td: ({ children }: { children?: React.ReactNode }) => <td style={markdownStyles.td}>{children}</td>,
  a: ({ children, href }: { children?: React.ReactNode; href?: string }) => <a style={markdownStyles.a} href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
  strong: ({ children }: { children?: React.ReactNode }) => <strong style={markdownStyles.strong}>{children}</strong>,
  em: ({ children }: { children?: React.ReactNode }) => <em style={markdownStyles.em}>{children}</em>,
  hr: () => <hr style={markdownStyles.hr} />,
};

// ─── 单条记录行 ─────────────────────────────────────────────

interface QAHistoryItemProps {
  entry: QAHistoryEntry;
  keyword: string;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  onEntryClick?: (entry: QAHistoryEntry) => void;
}

function QAHistoryItem({ entry, keyword, isExpanded, onToggle, onEntryClick }: QAHistoryItemProps) {
  const handleClick = () => {
    onToggle(entry.id);
    onEntryClick?.(entry);
  };

  return (
    <div
      className={`qa-history-item ${isExpanded ? 'qa-history-item--expanded' : ''}`}
      data-testid="qa-history-item"
      role="listitem"
      onClick={handleClick}
    >
      {/* 摘要行 */}
      <div className="qa-history-item__summary">
        {/* 状态标识 */}
        <span className={`qa-history-status-dot qa-history-status-dot--${entry.status}`} />

        {/* 主体信息 */}
        <div className="qa-history-item__body">
          {/* Prompt */}
          <div className="qa-history-item__prompt">
            <HighlightText text={isExpanded ? entry.prompt : truncate(entry.prompt, 60)} keyword={keyword} />
          </div>

          {/* 元信息行 */}
          <div className="qa-history-item__meta">
            <span className="qa-history-item__time" title={formatDate(entry.createdAt)}>
              {formatRelativeTime(entry.createdAt)}
            </span>
            <span className="qa-history-item__token">
              <span className="qa-history-item__token-num">{entry.tokenUsage.toLocaleString()}</span>
              <span className="qa-history-item__token-unit"> tokens</span>
            </span>
            <span className="qa-history-item__cost">
              ${entry.cost.toFixed(entry.cost < 0.01 ? 4 : 2)}
            </span>
            {entry.rating > 0 && (
              <RatingStars rating={entry.rating} />
            )}
            <span className="qa-history-item__expand-hint">
              {isExpanded ? '收起' : '展开'}
            </span>
          </div>

          {/* 标签 */}
          {entry.tags.length > 0 && (
            <div className="qa-history-item__tags">
              {entry.tags.map(tag => (
                <span
                  key={tag}
                  className="qa-history-item__tag"
                  onClick={e => e.stopPropagation()}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 展开内容 */}
      {isExpanded && (
        <div className="qa-history-item__detail">
          {/* Prompt 区 */}
          <div className="qa-history-detail-section qa-history-detail-section--prompt">
            <div className="qa-history-detail-label">问题</div>
            <div className="qa-history-detail-content">
              <HighlightText text={entry.prompt} keyword={keyword} />
            </div>
          </div>

          {/* Answer 区 */}
          <div className="qa-history-detail-section qa-history-detail-section--answer">
            <div className="qa-history-detail-label">回答</div>
            <div className="qa-history-detail-content qa-history-markdown">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents as any}>
                {entry.answer}
              </ReactMarkdown>
            </div>
          </div>

          {/* 附加信息 */}
          {entry.notes && (
            <div className="qa-history-detail-section qa-history-detail-section--notes">
              <div className="qa-history-detail-label">备注</div>
              <div className="qa-history-detail-content">{entry.notes}</div>
            </div>
          )}

          {/* 文件变更 */}
          {entry.fileChanges.length > 0 && (
            <div className="qa-history-detail-section">
              <div className="qa-history-detail-label">文件变更 ({entry.fileChanges.length})</div>
              <div className="qa-history-detail-content">
                {entry.fileChanges.map(fc => (
                  <span key={fc.path} className={`qa-history-file-change qa-history-file-change--${fc.type}`}>
                    {fc.type === 'create' ? '+' : fc.type === 'delete' ? '-' : '~'} {fc.path}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 筛选栏 ─────────────────────────────────────────────────

interface FilterBarProps {
  keyword: string;
  onKeywordChange: (kw: string) => void;
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  selectedRating: number | undefined;
  onRatingChange: (rating: number | undefined) => void;
  timeStart: number | undefined;
  timeEnd: number | undefined;
  onTimeStartChange: (ts: number | undefined) => void;
  onTimeEndChange: (ts: number | undefined) => void;
}

function FilterBar({
  keyword, onKeywordChange,
  selectedTags, onTagsChange,
  selectedRating, onRatingChange,
  timeStart, timeEnd, onTimeStartChange, onTimeEndChange,
}: FilterBarProps) {
  return (
    <div className="qa-history-filter-bar">
      {/* 关键词搜索 */}
      <div className="qa-history-filter-group">
        <svg className="qa-history-filter-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          className="qa-history-filter-input"
          placeholder="搜索关键词..."
          value={keyword}
          onChange={e => onKeywordChange(e.target.value)}
          aria-label="关键词搜索"
        />
        {keyword && (
          <button
            className="qa-history-filter-clear"
            onClick={() => onKeywordChange('')}
            aria-label="清除搜索"
          >
            ×
          </button>
        )}
      </div>

      {/* 评分筛选 */}
      <div className="qa-history-filter-group qa-history-filter-group--rating">
        <span className="qa-history-filter-label">评分</span>
        <div className="qa-history-rating-btns">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              className={`qa-history-rating-btn ${selectedRating === n ? 'qa-history-rating-btn--active' : ''}`}
              onClick={() => onRatingChange(selectedRating === n ? undefined : n)}
              aria-pressed={selectedRating === n}
              aria-label={`筛选 ${n} 星`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* 时间范围 */}
      <div className="qa-history-filter-group qa-history-filter-group--time">
        <span className="qa-history-filter-label">时间</span>
        <input
          type="date"
          className="qa-history-filter-input qa-history-filter-input--date"
          value={formatDateForInput(timeStart)}
          onChange={e => onTimeStartChange(e.target.value ? new Date(e.target.value).getTime() : undefined)}
          aria-label="开始时间"
          placeholder="开始时间"
        />
        <span className="qa-history-filter-sep">~</span>
        <input
          type="date"
          className="qa-history-filter-input qa-history-filter-input--date"
          value={formatDateForInput(timeEnd)}
          onChange={e => onTimeEndChange(e.target.value ? new Date(e.target.value).getTime() : undefined)}
          aria-label="结束时间"
          placeholder="结束时间"
        />
      </div>

      {/* 重置 */}
      {(keyword || selectedTags.length > 0 || selectedRating !== undefined || timeStart || timeEnd) && (
        <button
          className="qa-history-filter-reset"
          onClick={() => {
            onKeywordChange('');
            onTagsChange([]);
            onRatingChange(undefined);
            onTimeStartChange(undefined);
            onTimeEndChange(undefined);
          }}
        >
          重置
        </button>
      )}
    </div>
  );
}

// ─── 主组件 ─────────────────────────────────────────────────

interface QAHistoryListViewProps {
  workspaceId?: string;
  sessionId?: string;
  onEntryClick?: (entry: QAHistoryEntry) => void;
}

export function QAHistoryListView({ workspaceId, sessionId, onEntryClick }: QAHistoryListViewProps) {
  // 筛选状态
  const [keyword, setKeyword] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedRating, setSelectedRating] = useState<number | undefined>(undefined);
  const [timeStart, setTimeStart] = useState<number | undefined>(undefined);
  const [timeEnd, setTimeEnd] = useState<number | undefined>(undefined);

  // 数据状态
  const [allEntries, setAllEntries] = useState<QAHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // 展开状态
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 导出相关状态
  const [exportOpen, setExportOpen] = useState(false);
  const [selectedForExport, setSelectedForExport] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  // 加载数据
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let entries: QAHistoryEntry[];
      if (workspaceId) {
        entries = await getQAHistoryByWorkspaceId(workspaceId);
      } else if (sessionId) {
        entries = await getQAHistoryBySessionId(sessionId);
      } else {
        entries = await searchQAHistory({});
      }
      setAllEntries(entries);
    } catch (err) {
      console.error('Failed to load QA history:', err);
      setAllEntries([]);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, sessionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 筛选后数据（客户端辅助筛选 + 服务端关键词搜索）
  const filteredEntries = useMemo(() => {
    let results = [...allEntries];

    // 关键词（已在服务端筛选，此处仅作展示高亮用）
    // 评分筛选
    if (selectedRating !== undefined) {
      results = results.filter(e => e.rating === selectedRating);
    }

    // 标签筛选（客户端）
    if (selectedTags.length > 0) {
      results = results.filter(e => selectedTags.every(tag => e.tags.includes(tag)));
    }

    // 时间范围
    if (timeStart !== undefined) {
      results = results.filter(e => e.createdAt >= timeStart);
    }
    if (timeEnd !== undefined) {
      results = results.filter(e => e.createdAt <= timeEnd);
    }

    return results;
  }, [allEntries, keyword, selectedTags, selectedRating, timeStart, timeEnd]);

  // 关键词搜索（有 keyword 时调用服务端）
  useEffect(() => {
    if (!keyword) return;
    const handler = setTimeout(async () => {
      setLoading(true);
      try {
        const filters: QASearchFilters = {};
        if (workspaceId) filters.workspaceId = workspaceId;
        if (sessionId) filters.sessionId = sessionId;
        filters.keyword = keyword;
        if (selectedTags.length > 0) filters.tags = selectedTags;
        if (selectedRating !== undefined) filters.rating = selectedRating;
        if (timeStart) filters.timeRange = { start: timeStart };
        if (timeEnd) filters.timeRange = { ...filters.timeRange, end: timeEnd };

        const results = await searchQAHistory(filters);
        setAllEntries(results);
        setCurrentPage(1);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [keyword, workspaceId, sessionId, selectedTags, selectedRating, timeStart, timeEnd]);

  // 全局标签列表
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    allEntries.forEach(e => e.tags.forEach(t => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [allEntries]);

  // 分页
  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE));
  const pageEntries = filteredEntries.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleToggle = useCallback((id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  // 触发文件下载
  function triggerDownload(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const handleExport = async (format: 'markdown' | 'json' | 'html') => {
    const entries = selectedForExport.size > 0
      ? filteredEntries.filter(e => selectedForExport.has(e.id))
      : filteredEntries;
    if (entries.length === 0) return;
    setExporting(true);
    setExportOpen(false);
    try {
      const timestamp = new Date().toISOString().slice(0, 10);
      if (format === 'markdown') {
        triggerDownload(exportToMarkdown(entries), `qa-export-${timestamp}.md`, 'text/markdown;charset=utf-8');
      } else if (format === 'html') {
        const html = await exportToHTML(entries);
        triggerDownload(html, `qa-export-${timestamp}.html`, 'text/html;charset=utf-8');
      } else {
        triggerDownload(exportToJSON(entries), `qa-export-${timestamp}.json`, 'application/json;charset=utf-8');
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="qa-history-list-view">
      {/* 标题栏 */}
      <div className="qa-history-list-view__header">
        <h2 className="qa-history-list-view__title">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 .49-3.51" />
          </svg>
          问答历史
          <span className="qa-history-list-view__count">{filteredEntries.length}</span>
        </h2>

        {/* 导出按钮 */}
        <div style={{ position: 'relative', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* 选中项提示 */}
          {selectedForExport.size > 0 && (
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              已选 {selectedForExport.size} 条
              <button
                onClick={() => setSelectedForExport(new Set())}
                style={{ marginLeft: 4, border: 'none', background: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 12 }}
              >
                清除
              </button>
            </span>
          )}
          <button
            className="qa-history-btn-export"
            onClick={() => setExportOpen(o => !o)}
            disabled={exporting || filteredEntries.length === 0}
            title="导出问答历史"
          >
            {exporting ? '导出中…' : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                </svg>
                导出
              </>
            )}
          </button>

          {/* 下拉菜单 */}
          {exportOpen && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 4,
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                zIndex: 200,
                minWidth: 200,
                padding: 4,
              }}
              onMouseLeave={() => setExportOpen(false)}
            >
              <div style={{ padding: '6px 12px', fontSize: 11, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
                {selectedForExport.size > 0
                  ? `导出已选 ${selectedForExport.size} 条`
                  : `导出全部 ${filteredEntries.length} 条`}
              </div>
              {(['markdown', 'json', 'html'] as const).map(fmt => (
                <button
                  key={fmt}
                  onClick={() => handleExport(fmt)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 12px',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    borderRadius: 4,
                    fontSize: 13,
                    color: 'var(--text-primary)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  {fmt === 'markdown' ? '📄 Markdown (.md)' : fmt === 'json' ? '📋 JSON (.json)' : '🌐 HTML (.html)'}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 筛选栏 */}
      <FilterBar
        keyword={keyword}
        onKeywordChange={kw => { setKeyword(kw); setCurrentPage(1); }}
        selectedTags={selectedTags}
        onTagsChange={tags => { setSelectedTags(tags); setCurrentPage(1); }}
        selectedRating={selectedRating}
        onRatingChange={rating => { setSelectedRating(rating); setCurrentPage(1); }}
        timeStart={timeStart}
        timeEnd={timeEnd}
        onTimeStartChange={ts => { setTimeStart(ts); setCurrentPage(1); }}
        onTimeEndChange={te => { setTimeEnd(te); setCurrentPage(1); }}
      />

      {/* 标签快捷筛选 */}
      {allTags.length > 0 && (
        <div className="qa-history-tag-bar">
          {allTags.map(tag => (
            <button
              key={tag}
              className={`qa-history-tag-chip ${selectedTags.includes(tag) ? 'qa-history-tag-chip--active' : ''}`}
              onClick={() => {
                if (selectedTags.includes(tag)) {
                  setSelectedTags(selectedTags.filter(t => t !== tag));
                } else {
                  setSelectedTags([...selectedTags, tag]);
                }
                setCurrentPage(1);
              }}
              aria-pressed={selectedTags.includes(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* 内容区 */}
      <div className="qa-history-list-view__body" role="list" aria-label="问答历史列表">
        {loading && (
          <div className="qa-history-loading">
            <span>加载中...</span>
          </div>
        )}

        {!loading && filteredEntries.length === 0 && (
          <div className="qa-history-empty">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            <p>{keyword || selectedTags.length > 0 || selectedRating !== undefined || timeStart || timeEnd
              ? '无匹配记录'
              : '暂无问答历史'}</p>
          </div>
        )}

        {!loading && pageEntries.map(entry => (
          <div key={entry.id} style={{ display: 'flex', alignItems: 'flex-start' }}>
            <input
              type="checkbox"
              checked={selectedForExport.has(entry.id)}
              onChange={e => {
                e.stopPropagation();
                setSelectedForExport(prev => {
                  const next = new Set(prev);
                  if (e.target.checked) next.add(entry.id);
                  else next.delete(entry.id);
                  return next;
                });
              }}
              onClick={e => e.stopPropagation()}
              style={{ marginTop: 14, marginRight: 8, cursor: 'pointer', flexShrink: 0 }}
              title="选中导出"
              aria-label={`选择 ${truncate(entry.prompt, 30)}`}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <QAHistoryItem
                entry={entry}
                keyword={keyword}
                isExpanded={expandedId === entry.id}
                onToggle={handleToggle}
                onEntryClick={onEntryClick}
              />
            </div>
          </div>
        ))}
      </div>

      {/* 分页 */}
      {!loading && filteredEntries.length > PAGE_SIZE && (
        <div className="qa-history-pagination">
          <span className="qa-history-pagination__info">
            {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredEntries.length)} / 共 {filteredEntries.length}
          </span>
          <div className="qa-history-pagination__btns">
            <button
              className="qa-history-pagination__btn"
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1}
              aria-label="第一页"
            >
              «
            </button>
            <button
              className="qa-history-pagination__btn"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              aria-label="上一页"
            >
              ‹
            </button>
            <span className="qa-history-pagination__current">{currentPage} / {totalPages}</span>
            <button
              className="qa-history-pagination__btn"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              aria-label="下一页"
            >
              ›
            </button>
            <button
              className="qa-history-pagination__btn"
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage === totalPages}
              aria-label="最后一页"
            >
              »
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
