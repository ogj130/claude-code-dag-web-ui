import React, { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { DAGNode } from '../../types/events';
import { useTaskStore } from '../../stores/useTaskStore';

// ── Props ────────────────────────────────────────────────────────────────────
export interface NodeDetailModalProps {
  nodeType: 'tool' | 'summary' | 'rag';
  nodeLabel: string;
  nodeId: string;
  nodeStatus?: DAGNode['status'];
  args?: Record<string, unknown> | null;      // tool 节点
  summaryContent?: string;                    // summary 节点
  /** RAG 节点专属字段 */
  ragContent?: string;
  ragScore?: number;
  ragSourceSessionId?: string;
  ragSourceSessionTitle?: string;
  onClose: () => void;
}

// ── 图标 SVG ─────────────────────────────────────────────────────────────────
function ToolIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}
function SummaryIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="var(--success)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}
function RAGIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="#a78bfa" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
    </svg>
  );
}

// ── Markdown 样式（与 DAGNode.tsx 一致）─────────────────────────────────────
const markdownStyles: Record<string, React.CSSProperties> = {
  h1: { fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '8px 0 4px' },
  h2: { fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: '6px 0 3px' },
  h3: { fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', margin: '4px 0 2px' },
  p: { margin: '4px 0' },
  ul: { paddingLeft: 16, margin: '4px 0' },
  ol: { paddingLeft: 16, margin: '4px 0' },
  li: { margin: '2px 0' },
  code: { background: 'rgba(255,255,255,0.06)', borderRadius: 3, padding: '1px 4px', fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: 'var(--accent)' },
  pre: { background: 'rgba(0,0,0,0.35)', borderRadius: 6, padding: '10px 12px', margin: '6px 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
  'pre code': { background: 'transparent', padding: 0, color: 'var(--text-secondary)', fontSize: 11 },
  blockquote: { borderLeft: '3px solid var(--success)', paddingLeft: 10, color: 'var(--text-muted)', fontStyle: 'italic' as const, margin: '6px 0' },
  table: { width: '100%', borderCollapse: 'collapse' as const, margin: '6px 0', fontSize: 11 },
  th: { borderBottom: '1px solid var(--border)', padding: '4px 8px', textAlign: 'left' as const, color: 'var(--text-primary)', fontWeight: 600 },
  td: { borderBottom: '1px solid var(--border)', padding: '4px 8px', color: 'var(--text-secondary)' },
  a: { color: 'var(--accent)', textDecoration: 'none' },
  strong: { color: 'var(--text-primary)', fontWeight: 600 },
  em: { fontStyle: 'italic' as const },
  hr: { border: 'none', borderTop: '1px solid var(--border)', margin: '8px 0' },
};

// ── 工具参数渲染 ──────────────────────────────────────────────────────────────
function formatToolArgs(args: Record<string, unknown> | null): React.ReactNode {
  if (!args || Object.keys(args).length === 0) return null;
  return Object.entries(args).map(([k, v]) => (
    <div key={k} style={{ display: 'flex', gap: 8, fontSize: 12, marginBottom: 4 }}>
      <span style={{ color: 'var(--accent)', fontFamily: "'JetBrains Mono', monospace", minWidth: 60, flexShrink: 0 }}>{k}</span>
      <span style={{ color: 'var(--text-secondary)', fontFamily: "'JetBrains Mono', monospace", wordBreak: 'break-all', flex: 1 }}>
        {typeof v === 'string' && (v.startsWith('/') || v.includes(':'))
          ? <span style={{ color: 'var(--success)' }}>{v}</span>
          : String(v)}
      </span>
    </div>
  ));
}

// ── Focus Trap ────────────────────────────────────────────────────────────────
function useFocusTrap(ref: React.RefObject<HTMLDivElement | null>, active: boolean) {
  useEffect(() => {
    if (!active || !ref.current) return;
    const el = ref.current;
    const focusable = el.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last?.focus(); } }
      else { if (document.activeElement === last) { e.preventDefault(); first?.focus(); } }
    };
    el.addEventListener('keydown', handleKeyDown);
    return () => el.removeEventListener('keydown', handleKeyDown);
  }, [active, ref]);
}

// ── 主组件 ────────────────────────────────────────────────────────────────────
export function NodeDetailModal({
  nodeType, nodeLabel, nodeId, nodeStatus,
  args, summaryContent: initialSummary,
  ragContent, ragScore, ragSourceSessionId, ragSourceSessionTitle,
  onClose,
}: NodeDetailModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  useFocusTrap(overlayRef, true);

  // 流式 summary：从 store 直接读取最新内容，确保弹窗内容实时跟随
  const liveSummaryContent = useTaskStore(s => {
    if (nodeType !== 'summary') return initialSummary;
    const node = s.nodes.get(nodeId);
    return node?.summaryContent ?? initialSummary ?? '';
  });

  // ESC 关闭
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const STATUS_LABEL: Record<string, string> = { pending: '等待', running: '运行中', completed: '完成', failed: '失败' };
  const statusBg: Record<string, string> = { completed: 'var(--success-bg)', running: 'var(--warn-bg)', failed: 'var(--error-bg)', pending: 'var(--pending-bg)' };
  const statusColor: Record<string, string> = { completed: 'var(--success)', running: 'var(--warn)', failed: 'var(--error)', pending: 'var(--pending)' };
  const statusBorder: Record<string, string> = { completed: 'var(--success-border)', running: 'var(--warn-border)', failed: 'var(--error-border)', pending: 'var(--pending-border)' };

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
        animation: 'fadeIn 150ms ease-out',
        fontFamily: 'inherit',
      }}
    >
      <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } } @keyframes scaleIn { from { transform: scale(0.92); opacity: 0; } to { transform: scale(1); opacity: 1; } }`}</style>
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        width: '75vw',
        maxHeight: '75vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        animation: 'scaleIn 200ms ease-out',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px',
          background: nodeType === 'rag' ? 'rgba(167,139,250,0.08)' : 'var(--bg-bar)',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: nodeType === 'summary' ? 'var(--success-bg)'
                : nodeType === 'rag' ? 'rgba(167,139,250,0.15)'
                : 'rgba(74,142,255,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {nodeType === 'summary' ? <SummaryIcon /> : nodeType === 'rag' ? <RAGIcon /> : <ToolIcon />}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div id="modal-title" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace" }}>
                {nodeType === 'summary' ? '总结' : nodeType === 'rag' ? 'RAG 检索内容' : `工具: ${nodeLabel}`}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                {nodeType === 'summary' ? `来自 ${nodeId.replace('_summary', '')}`
                  : nodeType === 'rag' ? `相似度 ${ragScore != null ? Math.round(ragScore * 100) : 0}%`
                  : nodeId}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {nodeStatus && (
              <span style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 10,
                fontFamily: 'monospace', fontWeight: 500,
                background: statusBg[nodeStatus] ?? 'var(--pending-bg)',
                color: statusColor[nodeStatus] ?? 'var(--pending)',
                border: `1px solid ${statusBorder[nodeStatus] ?? 'var(--pending-border)'}`,
              }}>
                {STATUS_LABEL[nodeStatus]}
              </span>
            )}
            <button
              onClick={onClose}
              aria-label="关闭"
              style={{
                width: 28, height: 28, borderRadius: 6,
                background: 'none', border: 'none',
                cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                lineHeight: 1, transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-card-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            >×</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {nodeType === 'tool' && args && (
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                调用参数
              </div>
              {formatToolArgs(args)}
            </div>
          )}

          {nodeType === 'summary' && liveSummaryContent && (
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
              {liveSummaryContent}
            </ReactMarkdown>
          )}

          {/* RAG 节点内容 */}
          {nodeType === 'rag' && ragContent && (
            <>
              {/* 元信息条 */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', padding: '8px 12px', background: 'rgba(167,139,250,0.06)', borderRadius: 8, border: '1px solid rgba(167,139,250,0.2)' }}>
                {ragScore != null && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>相似度</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#a78bfa', fontFamily: "'JetBrains Mono', monospace" }}>
                      {Math.round(ragScore * 100)}%
                    </span>
                  </div>
                )}
                {ragSourceSessionTitle && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>来源</span>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: "'JetBrains Mono', monospace" }}>
                      {ragSourceSessionTitle}
                    </span>
                  </div>
                )}
                {ragSourceSessionId && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>会话ID</span>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: "'JetBrains Mono', monospace" }}>
                      {ragSourceSessionId.slice(0, 8)}...
                    </span>
                  </div>
                )}
              </div>
              {/* 内容 */}
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  检索内容
                </div>
                <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 8, padding: '10px 12px', border: '1px solid rgba(167,139,250,0.15)' }}>
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
                    {ragContent}
                  </ReactMarkdown>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
