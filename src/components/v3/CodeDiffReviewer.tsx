/**
 * CodeDiffReviewer — 代码 Diff 审查器
 *
 * Unified diff 展示 + 内联评论。
 * 所有样式使用内联 style + CSS 变量（本项目未安装 Tailwind CSS）。
 */

import { useState, useCallback } from 'react';

// ── 类型 ────────────────────────────────────────────────────

interface DiffLine {
  type: 'add' | 'remove' | 'context';
  content: string;
  oldLine?: number;
  newLine?: number;
}

interface DiffComment {
  line: number;
  text: string;
  author: string;
  timestamp: number;
}

interface DiffFile {
  path: string;
  lines: DiffLine[];
  comments: DiffComment[];
}

// ── 模拟数据 ────────────────────────────────────────────────

const MOCK_DIFF: DiffFile = {
  path: 'src/services/authService.ts',
  lines: [
    { type: 'context', content: 'import { createClient } from "@/utils/client";', oldLine: 1, newLine: 1 },
    { type: 'context', content: '', oldLine: 2, newLine: 2 },
    { type: 'remove', content: 'export async function login(email: string, password: string) {', oldLine: 3 },
    { type: 'remove', content: '  const client = createClient();', oldLine: 4 },
    { type: 'remove', content: '  return client.post("/auth/login", { email, password });', oldLine: 5 },
    { type: 'remove', content: '}', oldLine: 6 },
    { type: 'add', content: 'export async function login(email: string, password: string, opts?: LoginOptions) {', newLine: 3 },
    { type: 'add', content: '  const client = createClient();', newLine: 4 },
    { type: 'add', content: '  const response = await client.post("/auth/login", { email, password });', newLine: 5 },
    { type: 'add', content: '  if (opts?.rememberMe) {', newLine: 6 },
    { type: 'add', content: '    await setPersistentToken(response.data.token);', newLine: 7 },
    { type: 'add', content: '  }', newLine: 8 },
    { type: 'add', content: '  return response;', newLine: 9 },
    { type: 'add', content: '}', newLine: 10 },
    { type: 'context', content: '', oldLine: 7, newLine: 11 },
  ],
  comments: [],
};

// ── 行组件 ──────────────────────────────────────────────────

function DiffLineComponent({
  line,
  onComment,
}: {
  line: DiffLine;
  onComment: () => void;
}) {
  const lineBg = line.type === 'add'
    ? 'rgba(52, 211, 153, 0.08)'
    : line.type === 'remove'
      ? 'rgba(248, 113, 113, 0.08)'
      : 'transparent';

  const lineBorderColor = line.type === 'add'
    ? '#34D399'
    : line.type === 'remove'
      ? '#F87171'
      : 'transparent';

  const prefix = line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' ';
  const prefixColor = line.type === 'add' ? '#34D399' : line.type === 'remove' ? '#F87171' : '#475569';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        background: lineBg,
        borderLeft: `2px solid ${lineBorderColor}`,
        transition: 'background 0.1s ease-out',
      }}
      className="v3-diff-line"
      onMouseEnter={e => {
        if (line.type === 'context') e.currentTarget.style.background = 'rgba(148,163,184,0.03)';
        const btn = e.currentTarget.querySelector('.v3-diff-comment-btn') as HTMLElement;
        if (btn) btn.style.opacity = '1';
      }}
      onMouseLeave={e => {
        if (line.type === 'context') e.currentTarget.style.background = 'transparent';
        const btn = e.currentTarget.querySelector('.v3-diff-comment-btn') as HTMLElement;
        if (btn) btn.style.opacity = '0';
      }}
    >
      <span style={{
        width: 40,
        textAlign: 'right',
        paddingRight: 8,
        fontSize: 10,
        color: '#475569',
        userSelect: 'none',
        flexShrink: 0,
      }}>
        {line.oldLine ?? ''}
      </span>
      <span style={{
        width: 40,
        textAlign: 'right',
        paddingRight: 8,
        fontSize: 10,
        color: '#475569',
        userSelect: 'none',
        flexShrink: 0,
      }}>
        {line.newLine ?? ''}
      </span>
      <span style={{
        width: 20,
        textAlign: 'center',
        fontSize: 10,
        color: prefixColor,
        userSelect: 'none',
        flexShrink: 0,
      }}>
        {prefix}
      </span>
      <code style={{
        flex: 1,
        fontSize: 12,
        color: '#CBD5E1',
        fontFamily: '"JetBrains Mono", monospace',
        whiteSpace: 'pre',
        overflowX: 'auto',
        padding: '2px 12px 2px 4px',
      }}>
        {line.content}
      </code>
      <button
        onClick={onComment}
        className="v3-diff-comment-btn"
        style={{
          opacity: 0,
          fontSize: 10,
          color: '#60A5FA',
          padding: '0 8px',
          cursor: 'pointer',
          background: 'none',
          border: 'none',
          fontFamily: 'inherit',
          flexShrink: 0,
          transition: 'opacity 0.15s ease-out',
        }}
      >
        💬
      </button>
    </div>
  );
}

// ── 评论输入 ────────────────────────────────────────────────

function CommentInput({
  onSubmit,
  onCancel,
}: {
  onSubmit: (text: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState('');

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: 8,
      background: 'rgba(59, 130, 246, 0.05)',
      borderLeft: '2px solid #3B82F6',
    }}>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="添加审查评论..."
        style={{
          flex: 1,
          fontSize: 12,
          padding: '4px 8px',
          borderRadius: 6,
          background: '#1E293B',
          border: '1px solid rgba(148, 163, 184, 0.12)',
          color: '#CBD5E1',
          fontFamily: 'inherit',
          outline: 'none',
        }}
        autoFocus
        onKeyDown={(e) => { if (e.key === 'Enter' && text) onSubmit(text); }}
      />
      <button
        onClick={() => text && onSubmit(text)}
        disabled={!text}
        style={{
          fontSize: 10,
          padding: '4px 8px',
          borderRadius: 6,
          background: 'rgba(59, 130, 246, 0.15)',
          color: '#60A5FA',
          border: 'none',
          cursor: !text ? 'default' : 'pointer',
          fontFamily: 'inherit',
          opacity: !text ? 0.5 : 1,
        }}
      >
        发送
      </button>
      <button
        onClick={onCancel}
        style={{
          fontSize: 10,
          color: '#64748B',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        取消
      </button>
    </div>
  );
}

// ── 主组件 ──────────────────────────────────────────────────

export interface CodeDiffReviewerProps {
  className?: string;
}

export default function CodeDiffReviewer({}: CodeDiffReviewerProps) {
  const [diff] = useState(MOCK_DIFF);
  const [comments, setComments] = useState<DiffComment[]>([]);
  const [commentingLine, setCommentingLine] = useState<number | null>(null);

  const added = diff.lines.filter((l) => l.type === 'add').length;
  const removed = diff.lines.filter((l) => l.type === 'remove').length;

  const handleAddComment = useCallback((line: number, text: string) => {
    setComments((prev) => [
      ...prev,
      { line, text, author: '哈雷酱', timestamp: Date.now() },
    ]);
    setCommentingLine(null);
  }, []);

  return (
    <div style={{ padding: 12 }}>
      {/* 头部 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontFamily: '"JetBrains Mono", monospace', color: '#CBD5E1' }}>
            {diff.path}
          </span>
          <span style={{ fontSize: 10, color: '#34D399' }}>+{added}</span>
          <span style={{ fontSize: 10, color: '#F87171' }}>-{removed}</span>
        </div>
        <span style={{ fontSize: 10, color: '#64748B' }}>{comments.length} 评论</span>
      </div>

      {/* Diff */}
      <div style={{
        borderRadius: 8,
        border: '1px solid rgba(148, 163, 184, 0.12)',
        overflow: 'hidden',
        background: 'rgba(15, 23, 42, 0.5)',
      }}>
        {diff.lines.map((line, i) => {
          const lineNum = line.newLine ?? line.oldLine ?? i;
          const lineComment = comments.filter((c) => c.line === lineNum);

          return (
            <div key={i}>
              <DiffLineComponent
                line={line}
                onComment={() => setCommentingLine(lineNum)}
              />
              {lineComment.map((c, ci) => (
                <div key={ci} style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding: '6px 12px',
                  background: 'rgba(59, 130, 246, 0.05)',
                  borderLeft: '2px solid #3B82F6',
                }}>
                  <span style={{ fontSize: 10, color: '#60A5FA', fontWeight: 500 }}>{c.author}</span>
                  <span style={{ fontSize: 10, color: '#94A3B8' }}>{c.text}</span>
                </div>
              ))}
              {commentingLine === lineNum && (
                <CommentInput
                  onSubmit={(text) => handleAddComment(lineNum, text)}
                  onCancel={() => setCommentingLine(null)}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
