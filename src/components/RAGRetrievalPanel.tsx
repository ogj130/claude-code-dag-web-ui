/**
 * RAGRetrievalPanel — RAG 检索面板
 *
 * 功能：
 * - 按工作路径筛选向量检索范围
 * - 切换 Query / ToolCall / 混合检索模式
 * - 调整 Top-K 和相似度阈值
 * - 显示检索结果（得分、类型、内容预览）
 * - 勾选结果复制或注入到当前会话
 *
 * 架构：
 * - 向量化和检索均通过 IPC 桥接（vectorStorage.ts）
 * - search() 已在内部调用 embedText，无需外部向量化
 */

import { useState, useEffect, useCallback } from 'react';
import { search } from '@/stores/vectorStorage';
import type { SearchResult } from '@/stores/vectorStorage';
import { getIndexedSessions } from '@/stores/localVectorStorage';
import { useRAGContext } from '@/hooks/useRAGContext';

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

type RetrievalType = 'query' | 'toolcall' | 'hybrid';

// ---------------------------------------------------------------------------
// 骨架屏
// ---------------------------------------------------------------------------

function PanelSkeleton() {
  return (
    <div style={{ padding: '14px' }}>
      {/* 筛选区 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        {[80, 60].map((w, i) => (
          <div key={i} style={{
            height: 10,
            width: `${w}%`,
            background: 'var(--bg-input)',
            borderRadius: 5,
            opacity: 0.5,
            animation: 'shimmer 1.5s infinite',
            backgroundImage: 'linear-gradient(90deg, var(--bg-input) 25%, var(--border) 50%, var(--bg-input) 75%)',
            backgroundSize: '200% 100%',
          }} />
        ))}
      </div>
      {/* 结果占位 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[90, 70, 85, 65].map((w, i) => (
          <div key={i} style={{
            height: 60,
            width: `${w}%`,
            background: 'var(--bg-input)',
            borderRadius: 8,
            opacity: 0.4,
            animation: 'shimmer 1.5s infinite',
            backgroundImage: 'linear-gradient(90deg, var(--bg-input) 25%, var(--border) 50%, var(--bg-input) 75%)',
            backgroundSize: '200% 100%',
          }} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 搜索结果项
// ---------------------------------------------------------------------------

function ResultItem({
  result,
  isSelected,
  onToggle,
}: {
  result: SearchResult;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const isQuery = result.chunkType === 'query';
  const typeColor = isQuery ? '#4a9eff' : '#f97316';
  const typeBg = isQuery ? 'rgba(74,158,255,0.12)' : 'rgba(249,115,22,0.12)';

  const timeStr = new Date(result.timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  // 内容截断
  const displayContent = result.content.length > 180
    ? result.content.substring(0, 180) + '…'
    : result.content;

  // 会话标题
  const sessionTitle = result.metadata?.sessionTitle as string | undefined;

  return (
    <div
      onClick={onToggle}
      style={{
        background: isSelected ? 'rgba(74,158,255,0.06)' : 'var(--bg-card)',
        border: `1px solid ${isSelected ? 'rgba(74,158,255,0.35)' : 'var(--border)'}`,
        borderRadius: 10,
        padding: '10px 12px',
        marginBottom: 8,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
    >
      {/* 元信息行 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
        {/* 类型标签 */}
        <span style={{
          fontSize: 9,
          fontWeight: 700,
          background: typeBg,
          color: typeColor,
          padding: '2px 6px',
          borderRadius: 4,
          letterSpacing: '0.04em',
          flexShrink: 0,
        }}>
          {isQuery ? 'Query' : 'ToolCall'}
        </span>

        {/* 相似度 */}
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          fontFamily: "'JetBrains Mono', monospace",
          color: typeColor,
        }}>
          {(result.score * 100).toFixed(1)}%
        </span>

        {/* 会话标题 */}
        {sessionTitle && (
          <span style={{
            fontSize: 10,
            color: 'var(--text-muted)',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textAlign: 'right',
          }}>
            {sessionTitle}
          </span>
        )}

        {/* 时间 */}
        <span style={{ fontSize: 9, color: 'var(--text-dim)', flexShrink: 0 }}>
          {timeStr}
        </span>

        {/* 选中指示器 */}
        <div style={{
          width: 14,
          height: 14,
          borderRadius: 4,
          border: `1.5px solid ${isSelected ? '#4a9eff' : 'var(--border)'}`,
          background: isSelected ? '#4a9eff' : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'all 0.15s',
        }}>
          {isSelected && (
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <path d="M1.5 4L3 5.5L6.5 2" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      </div>

      {/* 内容 */}
      <div style={{
        fontSize: 11,
        color: 'var(--text-secondary)',
        lineHeight: 1.55,
        padding: '7px 10px',
        background: 'var(--bg-input)',
        borderRadius: 6,
        fontFamily: "'JetBrains Mono', monospace",
        wordBreak: 'break-word',
      }}>
        {displayContent}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 主组件
// ---------------------------------------------------------------------------

interface RAGRetrievalPanelProps {
  /** 打开设置面板的回调（由 App.tsx 注入） */
  onOpenSettings?: (tab?: 'theme' | 'embedding') => void;
}

export function RAGRetrievalPanel({ onOpenSettings }: RAGRetrievalPanelProps) {
  const [workspacePaths, setWorkspacePaths] = useState<string[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [topK, setTopK] = useState(10);
  const [threshold, setThreshold] = useState(0.5);
  const [retrievalType, setRetrievalType] = useState<RetrievalType>('hybrid');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isSearching, setIsSearching] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexedCount, setIndexedCount] = useState(0);
  const [indexedSessions, setIndexedSessions] = useState<Array<{ sessionId: string; workspacePath: string; indexedAt: number; queryCount: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // RAG 上下文管理
  const { addItems } = useRAGContext();

  // 从会话数据中提取工作路径
  // 会话存储在 src/lib/db.ts (SessionRecord)，使用 projectPath 字段
  const loadWorkspacePaths = useCallback(async () => {
    setLoading(true);
    try {
      const { listRecentSessions } = await import('@/lib/db');
      const sessions = await listRecentSessions(100);
      const paths = [...new Set(
        sessions.map(s => s.projectPath || 'Default')
      )];
      paths.sort();
      setWorkspacePaths(paths);
      setSelectedPaths(paths); // 默认全选
    } catch (e) {
      console.warn('[RAGRetrievalPanel] Failed to load workspace paths:', e);
      setWorkspacePaths([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // 加载已索引的会话列表（从 localStorage 持久化状态）
  const loadIndexedSessions = useCallback(() => {
    try {
      const sessions = getIndexedSessions();
      setIndexedSessions(sessions);
      // 计算总索引数量
      const total = sessions.reduce((sum, s) => sum + s.queryCount, 0);
      setIndexedCount(total);
    } catch (e) {
      console.warn('[RAGRetrievalPanel] Failed to load indexed sessions:', e);
    }
  }, []);

  useEffect(() => { loadWorkspacePaths(); }, [loadWorkspacePaths]);
  useEffect(() => { loadIndexedSessions(); }, [loadIndexedSessions]);

  /** 将所有历史会话的 Query 文本索引到本地向量库 */
  async function handleIndexHistory() {
    if (isIndexing) return;
    setIsIndexing(true);
    setError(null);
    try {
      const { db } = await import('@/lib/db');
      const { syncSessionToVector, getIndexedSessions } = await import('@/stores/localVectorStorage');
      const sessions = await db.sessions.toArray();
      let total = 0;
      for (const session of sessions) {
        const count = await syncSessionToVector(session.id, session.projectPath || 'Default');
        total += count;
      }
      // 重新加载已索引的会话列表
      const indexed = getIndexedSessions();
      setIndexedSessions(indexed);
      setIndexedCount(indexed.reduce((sum, s) => sum + s.queryCount, 0));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsIndexing(false);
    }
  }

  const isElectron = typeof window !== 'undefined' && !!window.electronAPI?.vectorApi;

  async function handleSearch() {
    if (!query.trim()) return;

    setIsSearching(true);
    setError(null);
    setSelected(new Set());

    try {
      const hits = await search(query, {
        workspacePaths: selectedPaths,
        type: retrievalType,
        topK,
        threshold,
      });

      // 按相似度降序排列（vectorStorage 返回的已排序）
      setResults(hits);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[RAGRetrievalPanel] Search failed:', msg);
      setError(msg);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }

  const isEmbedConfigError = error?.includes('未配置 embedding') || error?.includes('No embedding config');

  function toggleSelect(result: SearchResult) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(result.id)) {
        next.delete(result.id);
      } else {
        next.add(result.id);
      }
      return next;
    });
  }

  async function copySelected() {
    const selectedResults = results.filter(r => selected.has(r.id));
    if (!selectedResults.length) return;

    const text = selectedResults
      .map(r => `[${r.chunkType === 'query' ? 'Query' : 'ToolCall'} | ${(r.score * 100).toFixed(1)}%]\n${r.content}`)
      .join('\n\n---\n\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('复制失败，请检查浏览器权限');
    }
  }

  function injectToSession() {
    const selectedResults = results.filter(r => selected.has(r.id));
    if (!selectedResults.length) return;

    // 使用 hook 添加到上下文
    addItems(selectedResults);
  }

  // ── 检索类型切换按钮 ────────────────────────────────────────────────────
  function typeBtn(type: RetrievalType, label: string, desc: string) {
    const active = retrievalType === type;
    return (
      <button
        onClick={() => setRetrievalType(type)}
        title={desc}
        style={{
          flex: 1,
          background: active ? 'var(--accent)' : 'var(--bg-input)',
          color: active ? '#fff' : 'var(--text-muted)',
          border: active ? 'none' : '1px solid var(--border)',
          borderRadius: 6,
          padding: '5px 4px',
          fontSize: 10,
          fontWeight: active ? 700 : 500,
          cursor: 'pointer',
          transition: 'all 0.15s',
          lineHeight: 1.3,
        }}
      >
        {label}
      </button>
    );
  }

  const hasResults = results.length > 0;
  const hasSelection = selected.size > 0;

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* ── 标题栏 ────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-input)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* 搜索图标 */}
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4.5" stroke="var(--accent)" strokeWidth="1.5" />
            <path d="M9.5 9.5L12.5 12.5" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            RAG 检索
          </span>
          {hasResults && (
            <span style={{
              fontSize: 9,
              background: 'rgba(74,158,255,0.15)',
              color: 'var(--accent)',
              padding: '2px 6px',
              borderRadius: 10,
              fontWeight: 700,
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {results.length}
            </span>
          )}
        </div>

        {/* 表信息 */}
        {!loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: "'JetBrains Mono', monospace" }}>
              {workspacePaths.length > 0
                ? `${selectedPaths.length}/${workspacePaths.length} 个工作路径`
                : '无会话数据'}
            </div>
            {/* 索引历史会话按钮（仅 Vite dev 显示） */}
            {!isElectron && (
              <button
                onClick={handleIndexHistory}
                disabled={isIndexing}
                title="将历史会话 Query 索引到本地向量库"
                style={{
                  fontSize: 9,
                  background: isIndexing ? 'rgba(74,158,255,0.1)' : 'var(--accent)',
                  color: isIndexing ? 'var(--text-muted)' : '#fff',
                  border: 'none',
                  borderRadius: 4,
                  padding: '2px 7px',
                  fontWeight: 600,
                  cursor: isIndexing ? 'not-allowed' : 'pointer',
                  opacity: isIndexing ? 0.7 : 1,
                  transition: 'all 0.15s',
                  flexShrink: 0,
                }}
              >
                {isIndexing ? '索引中…' : indexedCount > 0 ? `已索引 ${indexedCount}` : '索引历史'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── 索引历史列表 ──────────────────────────────────────────── */}
      {!loading && indexedSessions.length > 0 && (
        <div style={{
          padding: '8px 14px',
          borderBottom: '1px solid var(--border)',
          background: 'rgba(74,158,255,0.03)',
        }}>
          <div style={{
            fontSize: 9,
            color: 'var(--text-dim)',
            marginBottom: 5,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 5L4 8L9 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            已索引会话 ({indexedSessions.length})
          </div>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            maxHeight: 80,
            overflowY: 'auto',
          }}>
            {indexedSessions.map(s => {
              const timeStr = new Date(s.indexedAt).toLocaleString('zh-CN', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              });
              return (
                <div key={s.sessionId} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 10,
                  color: 'var(--text-secondary)',
                  padding: '3px 6px',
                  background: 'var(--bg-input)',
                  borderRadius: 5,
                }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <circle cx="5" cy="5" r="3" stroke="#4a9eff" strokeWidth="1.2"/>
                    <path d="M5 3V5.5L6.5 7" stroke="#4a9eff" strokeWidth="1" strokeLinecap="round"/>
                  </svg>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.workspacePath}
                  </span>
                  <span style={{ color: '#4a9eff', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
                    {s.queryCount} 条
                  </span>
                  <span style={{ color: 'var(--text-dim)', fontSize: 9 }}>
                    {timeStr}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 工作路径筛选 ──────────────────────────────────────────────── */}
      {!loading && workspacePaths.length > 0 && (
        <div style={{
          padding: '8px 14px',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{
            fontSize: 9,
            color: 'var(--text-dim)',
            marginBottom: 5,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            fontWeight: 600,
          }}>
            工作路径筛选
          </div>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            maxHeight: 72,
            overflowY: 'auto',
          }}>
            {workspacePaths.map(path => {
              const checked = selectedPaths.includes(path);
              return (
                <label
                  key={path}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    padding: '2px 0',
                  }}
                >
                  <div
                    onClick={() => {
                      setSelectedPaths(prev =>
                        checked
                          ? prev.filter(p => p !== path)
                          : [...prev, path],
                      );
                    }}
                    style={{
                      width: 13,
                      height: 13,
                      borderRadius: 3,
                      border: `1.5px solid ${checked ? 'var(--accent)' : 'var(--border)'}`,
                      background: checked ? 'var(--accent)' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      cursor: 'pointer',
                      transition: 'all 0.12s',
                    }}
                  >
                    {checked && (
                      <svg width="7" height="7" viewBox="0 0 7 7" fill="none">
                        <path d="M1 3.5L2.8 5.3L6 1.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {path}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 检索类型切换 ──────────────────────────────────────────────── */}
      <div style={{
        padding: '8px 14px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        gap: 5,
      }}>
        {typeBtn('query', 'Query 级', '仅检索用户查询片段')}
        {typeBtn('toolcall', 'ToolCall 级', '仅检索工具调用片段')}
        {typeBtn('hybrid', '混合', 'Query + ToolCall 混合检索')}
      </div>

      {/* ── 搜索输入 ──────────────────────────────────────────────────── */}
      <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !isSearching && handleSearch()}
            placeholder="输入查询内容，检索相似上下文…"
            style={{
              flex: 1,
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '8px 11px',
              fontSize: 12,
              color: 'var(--text-primary)',
              outline: 'none',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          />
          <button
            onClick={handleSearch}
            disabled={isSearching || !query.trim()}
            style={{
              background: isSearching ? 'var(--bg-input)' : 'var(--accent)',
              color: isSearching ? 'var(--text-muted)' : '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '7px 14px',
              fontSize: 12,
              fontWeight: 600,
              cursor: isSearching ? 'not-allowed' : 'pointer',
              opacity: isSearching ? 0.7 : 1,
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {isSearching ? '检索中…' : '检索'}
          </button>
        </div>

        {/* 参数行 */}
        <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--text-muted)', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            Top-K
            <select
              value={topK}
              onChange={e => setTopK(Number(e.target.value))}
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: '2px 6px',
                fontSize: 11,
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              {[5, 10, 20, 50].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            阈值
            <select
              value={threshold}
              onChange={e => setThreshold(Number(e.target.value))}
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: '2px 6px',
                fontSize: 11,
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              {[0.3, 0.5, 0.7, 0.85].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </span>
        </div>

        {/* 错误提示 */}
        {error && (
          <div style={{
            marginTop: 6,
            fontSize: 10,
            color: isEmbedConfigError ? '#fbbf24' : '#f87171',
            padding: '6px 10px',
            background: isEmbedConfigError ? 'rgba(251,191,36,0.08)' : 'rgba(248,113,113,0.08)',
            borderRadius: 5,
            border: `1px solid ${isEmbedConfigError ? 'rgba(251,191,36,0.25)' : 'rgba(248,113,113,0.2)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}>
            <span>{error}</span>
            {isEmbedConfigError && onOpenSettings && (
              <button
                onClick={() => onOpenSettings('embedding')}
                style={{
                  background: '#fbbf24',
                  color: '#1a1a1a',
                  border: 'none',
                  borderRadius: 5,
                  padding: '3px 10px',
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                去设置 →
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── 结果列表 ───────────────────────────────────────────────────── */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        minHeight: 120,
        maxHeight: 320,
        padding: loading ? 0 : '8px 14px',
      }}>
        {loading ? (
          <PanelSkeleton />
        ) : !hasResults && !isSearching ? (
          <div style={{
            height: 160,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            color: 'var(--text-dim)',
          }}>
            {/* 空状态图标 */}
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <circle cx="16" cy="16" r="11" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2.5" />
              <path d="M24 24L31 31" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M12 16H20M16 12V20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
            </svg>
            <div style={{ fontSize: 11, textAlign: 'center', lineHeight: 1.5 }}>
              {error ? (
                <span style={{ color: '#f87171' }}>检索出错：{error}</span>
              ) : workspacePaths.length === 0 ? (
                '暂无会话数据，无法检索'
              ) : isElectron ? (
                '输入查询内容，点击检索开始 RAG 检索'
              ) : indexedCount > 0 ? (
                <span style={{ color: '#4a9eff' }}>
                  已索引 {indexedCount} 条数据，输入查询开始检索
                </span>
              ) : (
                <span>
                  点击上方「索引历史」将历史会话导入向量库
                  <br/>
                  <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                    （仅 Vite dev 模式可用）
                  </span>
                </span>
              )}
            </div>
          </div>
        ) : (
          results.map(result => (
            <ResultItem
              key={result.id}
              result={result}
              isSelected={selected.has(result.id)}
              onToggle={() => toggleSelect(result)}
            />
          ))
        )}
      </div>

      {/* ── 底部操作栏 ────────────────────────────────────────────────── */}
      <div style={{
        padding: '8px 14px',
        borderTop: '1px solid var(--border)',
        background: 'var(--bg-input)',
        display: 'flex',
        gap: 6,
        flexShrink: 0,
      }}>
        <button
          onClick={copySelected}
          disabled={!hasSelection}
          style={{
            flex: 1,
            background: copied ? 'rgba(74,158,255,0.15)' : 'var(--bg-card)',
            color: copied ? 'var(--accent)' : 'var(--text-secondary)',
            border: `1px solid ${copied ? 'rgba(74,158,255,0.3)' : 'var(--border)'}`,
            borderRadius: 7,
            padding: '7px 8px',
            fontSize: 11,
            fontWeight: 500,
            cursor: hasSelection ? 'pointer' : 'not-allowed',
            opacity: hasSelection ? 1 : 0.45,
            transition: 'all 0.15s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
          }}
        >
          {copied ? (
            <>
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M1.5 5.5L4 8L9.5 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              已复制
            </>
          ) : (
            <>
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <rect x="3" y="1" width="7" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M2 3.5V9.5C2 10.05 2.45 10.5 3 10.5H8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              复制 {hasSelection ? `(${selected.size})` : ''}
            </>
          )}
        </button>

        <button
          onClick={injectToSession}
          disabled={!hasSelection}
          style={{
            flex: 1.5,
            background: hasSelection ? 'var(--accent)' : 'var(--bg-card)',
            color: hasSelection ? '#fff' : 'var(--text-muted)',
            border: 'none',
            borderRadius: 7,
            padding: '7px 8px',
            fontSize: 11,
            fontWeight: 600,
            cursor: hasSelection ? 'pointer' : 'not-allowed',
            opacity: hasSelection ? 1 : 0.45,
            transition: 'all 0.15s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
          }}
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M2 5.5H9M6.5 3L9 5.5L6.5 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          注入上下文 {hasSelection ? `(${selected.size})` : ''}
        </button>
      </div>
    </div>
  );
}
