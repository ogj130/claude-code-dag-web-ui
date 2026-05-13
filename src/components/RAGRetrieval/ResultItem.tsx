/**
 * ResultItem — RAG 检索结果条目
 * Extracted from RAGRetrievalPanel.tsx
 */

import { useState } from 'react';
import type { SearchResult } from '@/stores/vectorStorage';
import ReactMarkdown from 'react-markdown';

export interface ResultItemProps {
  result: SearchResult;
  isSelected: boolean;
  onToggle: () => void;
}

export function ResultItem({ result, isSelected, onToggle }: ResultItemProps) {
  const [expanded, setExpanded] = useState(false);
  const isQuery = result.chunkType === 'query';
  const isAnswer = result.chunkType === 'answer';
  const isAttachment = result.chunkType === 'attachment';
  const typeColor = isQuery ? '#4a9eff' : isAnswer ? '#a855f7' : isAttachment ? '#6366F1' : '#f97316';
  const typeBg = isQuery ? 'rgba(74,158,255,0.12)' : isAnswer ? 'rgba(168,85,247,0.12)' : isAttachment ? 'rgba(99,102,241,0.12)' : 'rgba(249,115,22,0.12)';
  const typeLabel = isQuery ? 'Query' : isAnswer ? 'Answer' : isAttachment ? '附件' : 'ToolCall';
  const fileName = isAttachment ? result.fileName : undefined;

  const timeStr = new Date(result.timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const sessionTitle = result.metadata?.sessionTitle as string | undefined;

  const previewContent = result.content.length > 200
    ? result.content.substring(0, 200) + '\u2026'
    : result.content;

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
          {typeLabel}
        </span>

        <span style={{
          fontSize: 11,
          fontWeight: 700,
          fontFamily: "'JetBrains Mono', monospace",
          color: typeColor,
        }}>
          {(result.score * 100).toFixed(1)}%
        </span>

        {isAttachment && fileName ? (
          <span style={{
            fontSize: 10,
            color: '#6366F1',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textAlign: 'right',
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            {'\uD83D\uDCCE'} {fileName}
          </span>
        ) : sessionTitle ? (
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
        ) : null}

        <span style={{ fontSize: 9, color: 'var(--text-dim)', flexShrink: 0 }}>
          {timeStr}
        </span>

        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          style={{
            background: 'var(--bg-input)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: '2px 6px',
            fontSize: 9,
            color: 'var(--text-muted)',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          {expanded ? '收起' : '展开'}
        </button>

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

      {/* 内容 - Markdown 渲染 */}
      <div style={{
        background: 'var(--bg-input)',
        borderRadius: 6,
        overflow: 'hidden',
      }}>
        {expanded ? (
          <div style={{
            padding: '10px 12px',
            fontSize: 12,
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            maxHeight: 400,
            overflowY: 'auto',
          }}>
            <ReactMarkdown
              components={{
                code: ({ className, children, ...props }) => {
                  const isInline = !className;
                  return isInline ? (
                    <code style={{
                      background: 'rgba(0,0,0,0.15)',
                      padding: '1px 4px',
                      borderRadius: 3,
                      fontSize: '0.9em',
                      fontFamily: "'JetBrains Mono', monospace",
                    }} {...props}>
                      {children}
                    </code>
                  ) : (
                    <code style={{
                      display: 'block',
                      background: 'rgba(0,0,0,0.2)',
                      padding: '10px 12px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontFamily: "'JetBrains Mono', monospace",
                      overflowX: 'auto',
                      margin: '8px 0',
                    }} {...props}>
                      {children}
                    </code>
                  );
                },
                table: ({ children }) => (
                  <div style={{ overflowX: 'auto', margin: '8px 0' }}>
                    <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 11 }}>
                      {children}
                    </table>
                  </div>
                ),
                th: ({ children }) => (
                  <th style={{ border: '1px solid var(--border)', padding: '6px 10px', background: 'rgba(0,0,0,0.1)', textAlign: 'left' }}>{children}</th>
                ),
                td: ({ children }) => (
                  <td style={{ border: '1px solid var(--border)', padding: '6px 10px' }}>{children}</td>
                ),
                h1: ({ children }) => <h1 style={{ fontSize: 16, margin: '12px 0 8px', color: 'var(--text-primary)' }}>{children}</h1>,
                h2: ({ children }) => <h2 style={{ fontSize: 14, margin: '10px 0 6px', color: 'var(--text-primary)' }}>{children}</h2>,
                h3: ({ children }) => <h3 style={{ fontSize: 13, margin: '8px 0 4px', color: 'var(--text-primary)' }}>{children}</h3>,
                p: ({ children }) => <p style={{ margin: '6px 0' }}>{children}</p>,
                ul: ({ children }) => <ul style={{ margin: '6px 0', paddingLeft: 20 }}>{children}</ul>,
                ol: ({ children }) => <ol style={{ margin: '6px 0', paddingLeft: 20 }}>{children}</ol>,
                li: ({ children }) => <li style={{ margin: '3px 0' }}>{children}</li>,
                strong: ({ children }) => <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{children}</strong>,
              }}
            >
              {result.content}
            </ReactMarkdown>
          </div>
        ) : (
          <div style={{
            padding: '8px 10px',
            fontSize: 11,
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            maxHeight: 120,
            overflowY: 'hidden',
          }}>
            <ReactMarkdown
              components={{
                code: ({ className, children, ...props }) => {
                  const isInline = !className;
                  return isInline ? (
                    <code style={{
                      background: 'rgba(0,0,0,0.12)',
                      padding: '1px 4px',
                      borderRadius: 3,
                      fontSize: '0.9em',
                      fontFamily: "'JetBrains Mono', monospace",
                    }} {...props}>
                      {children}
                    </code>
                  ) : (
                    <code style={{
                      display: 'block',
                      background: 'rgba(0,0,0,0.15)',
                      padding: '6px 8px',
                      borderRadius: 4,
                      fontSize: 10,
                      fontFamily: "'JetBrains Mono', monospace",
                      overflowX: 'auto',
                      margin: '4px 0',
                    }} {...props}>
                      {children}
                    </code>
                  );
                },
                h1: ({ children }) => <h1 style={{ fontSize: 13, margin: '4px 0 2px', color: 'var(--text-primary)' }}>{children}</h1>,
                h2: ({ children }) => <h2 style={{ fontSize: 12, margin: '4px 0 2px', color: 'var(--text-primary)' }}>{children}</h2>,
                h3: ({ children }) => <h3 style={{ fontSize: 11, margin: '4px 0 2px', color: 'var(--text-primary)' }}>{children}</h3>,
                p: ({ children }) => <p style={{ margin: '3px 0' }}>{children}</p>,
                ul: ({ children }) => <ul style={{ margin: '3px 0', paddingLeft: 16 }}>{children}</ul>,
                ol: ({ children }) => <ol style={{ margin: '3px 0', paddingLeft: 16 }}>{children}</ol>,
                li: ({ children }) => <li style={{ margin: '2px 0' }}>{children}</li>,
                strong: ({ children }) => <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{children}</strong>,
                table: ({ children }) => (
                  <div style={{ overflowX: 'auto', margin: '4px 0', fontSize: 10 }}>
                    <table style={{ borderCollapse: 'collapse', width: '100%' }}>{children}</table>
                  </div>
                ),
                th: ({ children }) => (
                  <th style={{ border: '1px solid var(--border)', padding: '4px 6px', background: 'rgba(0,0,0,0.08)', textAlign: 'left', fontSize: 10 }}>{children}</th>
                ),
                td: ({ children }) => (
                  <td style={{ border: '1px solid var(--border)', padding: '4px 6px', fontSize: 10 }}>{children}</td>
                ),
              }}
            >
              {previewContent}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
