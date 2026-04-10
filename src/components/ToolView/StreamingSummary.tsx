import React, { memo, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTaskStore } from '../../stores/useTaskStore';

const markdownStyles: Record<string, React.CSSProperties> = {
  p: { margin: '4px 0', fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 },
  h1: { fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '8px 0 4px' },
  h2: { fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', margin: '6px 0 3px' },
  h3: { fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', margin: '4px 0 2px' },
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
    overflowX: 'auto' as const,
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
  ul: { paddingLeft: 16, margin: '4px 0' },
  ol: { paddingLeft: 16, margin: '4px 0' },
  li: { margin: '2px 0' },
  hr: { border: 'none', borderTop: '1px solid var(--border)', margin: '8px 0' },
  em: { fontStyle: 'italic' as const },
};


function StreamingSummaryInner() {
  const summaryChunks = useTaskStore(s => s.summaryChunks);
  const contentRef = useRef<HTMLDivElement>(null);

  // 流式内容：累积所有 chunks
  const content = summaryChunks.join('');

  // 自动滚动到底部（流式追加时）
  useEffect(() => {
    if (!contentRef.current) return;
    contentRef.current.scrollTop = contentRef.current.scrollHeight;
  }, [summaryChunks.length, content]);

  if (summaryChunks.length === 0) return null;

  return (
    <div style={{
      padding: '10px 12px',
      background: 'rgba(74,142,255,0.03)',
      borderTop: '1px solid var(--border)',
    }}>
      {/* Header：状态指示器 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
      }}>
        {/* 脉冲动画圆点 */}
        <div style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: 'var(--accent)',
          flexShrink: 0,
          animation: 'stream-pulse 1s ease-in-out infinite',
        }} />
        <span style={{
          fontSize: 10,
          color: 'var(--accent)',
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}>
          生成中
        </span>
        {/* 光标闪烁装饰 */}
        <span style={{
          color: 'var(--accent)',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          animation: 'cursor-blink 0.8s step-end infinite',
        }}>
          ▊
        </span>
      </div>

      {/* Markdown 内容（实时渲染） */}
      <div
        ref={contentRef}
        style={{
          maxHeight: 280,
          overflowY: 'auto',
          transition: 'max-height 0.2s ease',
        }}
      >
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
          {content}
        </ReactMarkdown>
      </div>

      <style>{`
        @keyframes stream-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }
        @keyframes cursor-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export const StreamingSummary = memo(StreamingSummaryInner);
StreamingSummary.displayName = 'StreamingSummary';
