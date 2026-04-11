import React, { useState } from 'react';
import { useRAGContext, type RAGContextItem } from '@/hooks/useRAGContext';

// RAG Context 条组件
export function RAGContextBar() {
  const { items, removeItem, clearAll } = useRAGContext();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  if (items.length === 0) return null;

  return (
    <div
      style={{
        background: 'rgba(167, 139, 250, 0.08)',
        border: '1px solid rgba(167, 139, 250, 0.25)',
        borderRadius: 10,
        margin: '8px 14px',
        overflow: 'hidden',
      }}
    >
      {/* 头部 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: isExpanded ? '1px solid rgba(167, 139, 250, 0.25)' : 'none',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#a78bfa"
            strokeWidth="2"
          >
            <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
          </svg>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#a78bfa',
            }}
          >
            RAG上下文 ({items.length}条)
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowPreview(true);
            }}
            style={{
              background: 'transparent',
              border: '1px solid rgba(167, 139, 250, 0.25)',
              borderRadius: 4,
              padding: '2px 8px',
              fontSize: 11,
              color: '#a78bfa',
              cursor: 'pointer',
            }}
          >
            预览
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              clearAll();
            }}
            style={{
              background: 'transparent',
              border: '1px solid rgba(167, 139, 250, 0.25)',
              borderRadius: 4,
              padding: '2px 8px',
              fontSize: 11,
              color: '#a78bfa',
              cursor: 'pointer',
            }}
          >
            ×清除
          </button>
        </div>
      </div>

      {/* 展开内容 */}
      {isExpanded && (
        <div style={{ padding: '8px 12px', maxHeight: 160, overflowY: 'auto' }}>
          {items.map((item, index) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 0',
                borderBottom: '1px solid rgba(51, 65, 85, 0.3)',
              }}
            >
              <span style={{ fontSize: 10, color: '#64748b', width: 16 }}>{index + 1}.</span>
              <span
                style={{
                  flex: 1,
                  fontSize: 11,
                  color: '#94a3b8',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                "{item.summary}"
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: '#a78bfa',
                  fontFamily: 'JetBrains Mono, monospace',
                  flexShrink: 0,
                }}
              >
                {(item.score * 100).toFixed(0)}%
              </span>
              <button
                onClick={() => removeItem(item.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '2px 4px',
                  fontSize: 14,
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 预览弹窗 */}
      {showPreview && (
        <RAGPreviewModal items={items} onClose={() => setShowPreview(false)} />
      )}
    </div>
  );
}

// 预览弹窗组件
function RAGPreviewModal({
  items,
  onClose,
}: {
  items: RAGContextItem[];
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: 12,
          width: '90%',
          maxWidth: 600,
          maxHeight: '80vh',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #334155',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9' }}>
            RAG 上下文预览
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: 20,
            }}
          >
            ×
          </button>
        </div>
        <div
          style={{
            padding: 16,
            overflowY: 'auto',
            maxHeight: 'calc(80vh - 60px)',
          }}
        >
          {items.map((item, index) => (
            <div
              key={item.id}
              style={{
                marginBottom: 16,
                padding: 12,
                background: '#0f172a',
                borderRadius: 8,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    color: '#a78bfa',
                    fontWeight: 600,
                  }}
                >
                  [{index + 1}] {item.chunkType === 'answer' ? '回答' : item.chunkType === 'query' ? '问题' : '工具调用'}
                </span>
                <span style={{ fontSize: 11, color: '#64748b' }}>
                  相似度: {(item.score * 100).toFixed(0)}%
                </span>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: '#94a3b8',
                  lineHeight: 1.6,
                  fontFamily: 'JetBrains Mono, monospace',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {item.content}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
