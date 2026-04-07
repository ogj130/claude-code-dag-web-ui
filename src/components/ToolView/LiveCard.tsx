import React, { memo } from 'react';
import { CardToolTimeline } from './CardToolTimeline';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { CurrentCardData } from '../../stores/useTaskStore';

interface Props {
  card: CurrentCardData;
}

const markdownStyles: Record<string, React.CSSProperties> = {
  p: { margin: '4px 0', fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 },
  h1: { fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '8px 0 4px' },
  h2: { fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', margin: '6px 0 3px' },
  h3: { fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', margin: '4px 0 2px' },
  code: { background: 'rgba(255,255,255,0.06)', borderRadius: 3, padding: '1px 4px', fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: 'var(--accent)' },
  pre: { background: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: '8px 10px', overflowX: 'auto' as const, margin: '6px 0' },
  'pre code': { background: 'transparent', padding: 0, color: 'var(--text-secondary)', fontSize: 10 },
  blockquote: { borderLeft: '3px solid var(--success)', paddingLeft: 8, color: 'var(--text-muted)', margin: '4px 0', fontStyle: 'italic' as const },
  table: { width: '100%', borderCollapse: 'collapse' as const, margin: '6px 0', fontSize: 10 },
  th: { borderBottom: '1px solid var(--border)', padding: '3px 6px', textAlign: 'left' as const, color: 'var(--text-primary)' },
  td: { borderBottom: '1px solid var(--border)', padding: '3px 6px', color: 'var(--text-secondary)' },
  a: { color: 'var(--accent)', textDecoration: 'none' },
  strong: { color: 'var(--text-primary)', fontWeight: 600 },
  ul: { paddingLeft: 16, margin: '4px 0' },
  ol: { paddingLeft: 16, margin: '4px 0' },
  li: { margin: '2px 0' },
  hr: { border: 'none', borderTop: '1px solid var(--border)', margin: '8px 0' },
  em: { fontStyle: 'italic' as const },
};

const cardStyle: React.CSSProperties = {
  borderLeft: '3px solid var(--accent)',
  background: 'var(--bg-card)',
  borderRadius: 8,
  margin: '8px 0',
  overflow: 'hidden',
  border: '1px solid var(--border-card)',
  transition: 'opacity 0.3s',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '8px 12px',
  fontSize: 11,
  color: 'var(--accent)',
  background: 'rgba(74,142,255,0.06)',
  borderBottom: '1px solid var(--border)',
  gap: 6,
};

const runningDotStyle: React.CSSProperties = {
  width: 8, height: 8, borderRadius: '50%',
  border: '1.5px solid var(--accent)',
  borderTopColor: 'transparent',
  animation: 'tool-spin 0.8s linear infinite',
  flexShrink: 0,
};

const completedDotStyle: React.CSSProperties = {
  width: 8, height: 8, borderRadius: '50%',
  background: 'var(--success)',
  flexShrink: 0,
};

const queryRowStyle: React.CSSProperties = {
  padding: '10px 12px',
  background: 'var(--bg-bar)',
  borderBottom: '1px solid var(--border)',
  display: 'flex',
  gap: 8,
  alignItems: 'flex-start',
};

const summaryBoxStyle: React.CSSProperties = {
  padding: '10px 12px',
  background: 'rgba(46,204,113,0.03)',
};

const summaryHeaderStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'flex-start',
  marginBottom: 8,
};

function LiveCardInner({ card }: Props) {
  const hasSummary = (card.summary ?? '').trim().length > 0;

  const isCollapsed = card.isCollapsed ?? false;
  const outerStyle = { ...cardStyle, opacity: hasSummary ? 1 : 0.9 };

  // 折叠状态样式
  const collapsedHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 12px',
    cursor: 'pointer',
    fontSize: 11,
    color: 'var(--accent)',
    background: 'rgba(74,142,255,0.04)',
    userSelect: 'none',
    transition: 'background 0.2s',
  };

  return (
    <div className="live-card" style={outerStyle}>
      <style>{`
        @keyframes tool-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* 折叠状态：只显示一行摘要 */}
      {isCollapsed && (
        <div
          style={collapsedHeaderStyle}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(74,142,255,0.08)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(74,142,255,0.04)')}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--text-muted)' }}>▶</span>
            <span style={{ color: 'var(--text-muted)' }}>Q:</span>
            {card.query.length > 60 ? card.query.slice(0, 60) + '...' : card.query}
          </span>
        </div>
      )}

      {/* 展开状态 */}
      {!isCollapsed && (
      <>
      {/* Header */}
      <div style={headerStyle}>
        {hasSummary
          ? <div style={completedDotStyle} />
          : <div style={runningDotStyle} />}
        <span>{hasSummary ? '✦ 已完成' : '⚡ 实时处理中'}</span>
      </div>

      {/* Query */}
      <div style={queryRowStyle}>
        <span style={{ fontSize: 12, color: 'var(--accent)', flexShrink: 0, marginTop: 1 }}>💬</span>
        <span style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.6, wordBreak: 'break-word' }}>
          {card.query}
        </span>
      </div>

      {/* Tool Timeline (auto-updates from store) */}
      <CardToolTimeline queryId={card.queryId} />

      {/* Summary */}
      {hasSummary && (
        <div style={summaryBoxStyle}>
          <div style={summaryHeaderStyle}>
            <span style={{ fontSize: 12, color: 'var(--success)', flexShrink: 0, marginTop: 1 }}>📋</span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>最终总结</span>
          </div>
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
            {card.summary}
          </ReactMarkdown>
        </div>
      )}
      </>
      )}
    </div>
  );
}

export const LiveCard = memo(LiveCardInner);
