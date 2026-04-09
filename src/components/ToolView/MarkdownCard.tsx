import React, { memo, useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CardToolTimeline } from './CardToolTimeline';

export interface MarkdownCardData {
  id: string;
  queryId: string;        // 关联的 query ID，用于工具时间线
  timestamp: number;
  query: string;         // 用户问题
  analysis: string;       // AI 分析过程（Markdown）
  summary?: string;       // 当前显示的总结（流式开始时为流式内容，最终为完整内容）
  completeSummary?: string; // 完整总结（用于流式补完动画：summary 先显示流式内容，再动画补完到 completeSummary）
  tokenUsage?: number;    // 单次查询 Token 消耗
}

interface MarkdownCardProps {
  card: MarkdownCardData;
  defaultAnalysisOpen?: boolean; // analysis 默认折叠
  defaultCollapsed?: boolean;   // 外部控制的折叠状态（新问题开始时自动叠起）
}

// Markdown 元素样式（与 DAGNode.tsx 保持一致）
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

function MarkdownCardInner({ card, defaultAnalysisOpen = false, defaultCollapsed = false }: MarkdownCardProps) {
  const [open, setOpen] = useState(!defaultCollapsed);  // 外部控制折叠时，默认折叠
  const [analysisOpen, setAnalysisOpen] = useState(defaultAnalysisOpen);
  // 流式补完动画：初始显示流式内容，逐字补完到完整内容
  const [displaySummary, setDisplaySummary] = useState(card.summary ?? '');
  const animationRef = useRef<number | null>(null);
  const completeRef = useRef(card.completeSummary ?? card.summary ?? '');

  // 监测 completeSummary 变化，触发流式补完动画
  useEffect(() => {
    const complete = card.completeSummary ?? card.summary ?? '';
    const current = card.summary ?? '';
    completeRef.current = complete;

    if (complete.length <= current.length) {
      // 无需动画，直接显示
      setDisplaySummary(current);
      return;
    }

    // 从流式内容开始，逐步补完
    setDisplaySummary(current);
    let index = current.length;
    const speed = Math.max(15, Math.min(40, 60000 / complete.length)); // ~30-50ms/char

    const tick = () => {
      if (index < completeRef.current.length) {
        // 每次补完一小段（约 4 个字符），减少 React 重渲染次数
        const end = Math.min(index + 4, completeRef.current.length);
        index = end;
        setDisplaySummary(completeRef.current.slice(0, index));
        animationRef.current = requestAnimationFrame(tick);
        // 用 setTimeout 控制速度（requestAnimationFrame 在不同刷新率下速度不同）
        setTimeout(() => {
          if (animationRef.current !== null) {
            animationRef.current = requestAnimationFrame(tick);
          }
        }, speed);
      }
    };

    animationRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id]); // 只在卡片创建时触发一次

  const hasAnalysis = card.analysis.trim().length > 0;
  const hasSummary = (displaySummary ?? '').trim().length > 0;
  const analysisSize = new Blob([card.analysis]).size;
  const analysisLabel = analysisSize > 1024
    ? `分析内容 (${(analysisSize / 1024).toFixed(1)}KB)`
    : analysisSize > 0
    ? `分析内容 (${card.analysis.length}字)`
    : '分析内容';

  return (
    <div className="markdown-card" style={{
      borderLeft: '3px solid var(--success)',
      background: 'var(--bg-card)',
      borderRadius: 8,
      margin: '8px 0',
      overflow: 'hidden',
      border: '1px solid var(--border-card)',
    }}>
      {/* ── 叠起状态：一行摘要 ── */}
      {!open && (
        <div
          className="markdown-card-collapsed"
          onClick={() => setOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px 12px',
            cursor: 'pointer',
            fontSize: 11,
            color: 'var(--success)',
            background: 'var(--success-bg)',
            userSelect: 'none',
            transition: 'background 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--success-border)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--success-bg)')}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>▶</span>
            <span style={{ color: 'var(--text-muted)' }}>Q:</span>
            {card.query.length > 60 ? card.query.slice(0, 60) + '...' : card.query}
          </span>
        </div>
      )}

      {/* ── 主 Header ── */}
      {open && (
      <div
        className="markdown-card-header"
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          cursor: 'pointer',
          fontSize: 11,
          color: 'var(--success)',
          userSelect: 'none',
          background: 'var(--success-bg)',
          transition: 'background 0.2s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--success-border)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--success-bg)')}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ transition: 'transform 200ms', transform: open ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-flex' }}>▶</span>
          ✦ 回答总结
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
          {open ? '收起' : '展开'}
        </span>
      </div>
      )}

      {/* ── 内容区 ── */}
      {open && (
        <div style={{ borderTop: '1px solid var(--border)' }}>

          {/* Query 区 */}
          {card.query && (
            <div style={{
              padding: '10px 12px',
              background: 'var(--bg-bar)',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
            }}>
              <span style={{ fontSize: 12, color: 'var(--accent)', flexShrink: 0, marginTop: 1 }}>💬</span>
              <span style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.6, wordBreak: 'break-word' }}>
                {card.query}
              </span>
            </div>
          )}

          {/* Analysis 区（可折叠） */}
          {hasAnalysis && (
            <div>
              <div
                onClick={() => setAnalysisOpen(o => !o)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  fontSize: 11,
                  color: 'var(--accent-dim)',
                  userSelect: 'none',
                  transition: 'background 0.15s',
                  background: 'rgba(74,142,255,0.04)',
                  borderBottom: analysisOpen ? '1px solid var(--border)' : 'none',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(74,142,255,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(74,142,255,0.04)')}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ transition: 'transform 200ms', transform: analysisOpen ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-flex' }}>▶</span>
                  {analysisLabel}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                  {analysisOpen ? '收起' : '展开'}
                </span>
              </div>

              {analysisOpen && (
                <div style={{
                  padding: '8px 12px',
                  maxHeight: 320,
                  overflowY: 'auto',
                  borderBottom: hasSummary ? '1px solid var(--border)' : 'none',
                }}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ children }) => <h1 style={markdownStyles.h1}>{children}</h1>,
                      h2: ({ children }) => <h2 style={markdownStyles.h2}>{children}</h2>,
                      h3: ({ children }) => <h3 style={markdownStyles.h3}>{children}</h3>,
                      p: ({ children }) => <p style={markdownStyles.p}>{children}</p>,
                      ul: ({ children }) => <ul style={markdownStyles.ul}>{children}</ul>,
                      ol: ({ children }) => <ol style={markdownStyles.ol}>{children}</ol>,
                      li: ({ children }) => <li style={markdownStyles.li}>{children}</li>,
                      code: ({ className, children, ...props }) => {
                        const isBlock = className?.startsWith('language-');
                        return isBlock
                          ? <code style={markdownStyles['pre code']} className={className} {...props}>{children}</code>
                          : <code style={markdownStyles.code} {...props}>{children}</code>;
                      },
                      pre: ({ children }) => <pre style={markdownStyles.pre}>{children}</pre>,
                      blockquote: ({ children }) => <blockquote style={markdownStyles.blockquote}>{children}</blockquote>,
                      table: ({ children }) => <table style={markdownStyles.table}>{children}</table>,
                      th: ({ children }) => <th style={markdownStyles.th}>{children}</th>,
                      td: ({ children }) => <td style={markdownStyles.td}>{children}</td>,
                      a: ({ children, href }) => <a style={markdownStyles.a} href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
                      strong: ({ children }) => <strong style={markdownStyles.strong}>{children}</strong>,
                      em: ({ children }) => <em style={markdownStyles.em}>{children}</em>,
                      hr: () => <hr style={markdownStyles.hr} />,
                    }}
                  >
                    {card.analysis}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          )}

          {/* Tool 时间线（内嵌在 query 和 summary 之间） */}
          {card.queryId && <CardToolTimeline queryId={card.queryId} />}

          {/* Summary 区 */}
          {hasSummary && (
            <div style={{
              padding: '10px 12px',
              background: 'rgba(46,204,113,0.03)',
            }}>
              <div style={{
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
                marginBottom: 8,
              }}>
                <span style={{ fontSize: 12, color: 'var(--success)', flexShrink: 0, marginTop: 1 }}>📋</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>最终总结</span>
              </div>
              {/* Summary 内容 + 流式补完光标 */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ children }) => <h1 style={markdownStyles.h1}>{children}</h1>,
                      h2: ({ children }) => <h2 style={markdownStyles.h2}>{children}</h2>,
                      h3: ({ children }) => <h3 style={markdownStyles.h3}>{children}</h3>,
                      p: ({ children }) => <p style={markdownStyles.p}>{children}</p>,
                      ul: ({ children }) => <ul style={markdownStyles.ul}>{children}</ul>,
                      ol: ({ children }) => <ol style={markdownStyles.ol}>{children}</ol>,
                      li: ({ children }) => <li style={markdownStyles.li}>{children}</li>,
                      code: ({ className, children, ...props }) => {
                        const isBlock = className?.startsWith('language-');
                        return isBlock
                          ? <code style={markdownStyles['pre code']} className={className} {...props}>{children}</code>
                          : <code style={markdownStyles.code} {...props}>{children}</code>;
                      },
                      pre: ({ children }) => <pre style={markdownStyles.pre}>{children}</pre>,
                      blockquote: ({ children }) => <blockquote style={markdownStyles.blockquote}>{children}</blockquote>,
                      table: ({ children }) => <table style={markdownStyles.table}>{children}</table>,
                      th: ({ children }) => <th style={markdownStyles.th}>{children}</th>,
                      td: ({ children }) => <td style={markdownStyles.td}>{children}</td>,
                      a: ({ children, href }) => <a style={markdownStyles.a} href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
                      strong: ({ children }) => <strong style={markdownStyles.strong}>{children}</strong>,
                      em: ({ children }) => <em style={markdownStyles.em}>{children}</em>,
                      hr: () => <hr style={markdownStyles.hr} />,
                    }}
                  >
                    {displaySummary}
                  </ReactMarkdown>
                </div>
                {/* 流式补完闪烁光标 */}
                {card.completeSummary !== undefined && card.completeSummary !== displaySummary && (
                  <div style={{
                    width: 2, height: 14, minWidth: 2, minHeight: 14,
                    background: 'var(--success)',
                    marginTop: 8,
                    flexShrink: 0,
                    animation: 'summary-cursor-blink 0.7s step-end infinite',
                  }} />
                )}
              </div>
              <style>{`
                @keyframes summary-cursor-blink {
                  0%, 100% { opacity: 1; }
                  50% { opacity: 0; }
                }
              `}</style>
            </div>
          )}

          {/* Token 使用信息 */}
          {card.tokenUsage != null && card.tokenUsage > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                padding: '6px 12px',
                borderTop: '1px solid var(--border)',
                background: 'var(--bg-bar)',
                gap: 6,
              }}
            >
              <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>Token:</span>
              <span
                style={{
                  fontSize: 11,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 600,
                  color: 'var(--accent)',
                }}
              >
                {card.tokenUsage.toLocaleString()}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const MarkdownCard = memo(MarkdownCardInner);
