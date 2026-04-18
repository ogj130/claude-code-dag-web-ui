import { useState, useCallback, useRef } from 'react';
import { dispatchGlobalPromptsWithDefaults } from '@/services/globalDispatchService';
import { dispatchExecutePromptAdapter } from '@/services/globalDispatchExecutor';
import { useMultiDispatchStore } from '@/stores/useMultiDispatchStore';
import type { DispatchResult } from '@/types/global-dispatch';
import type { Workspace } from '@/types/workspace';

export interface GlobalTerminalProps {
  workspaces: Workspace[];
}

type LoadingState = 'idle' | 'loading';

interface WorkspaceResultEntry {
  workspaceId: string;
  workspaceName: string;
  status: 'success' | 'partial' | 'failed';
  prompts: Array<{ prompt: string; status: 'success' | 'failed' | 'skipped'; reason?: string }>;
}

// ── StatusBadge ─────────────────────────────────────────────────
function StatusBadge({ status }: { status: 'success' | 'partial' | 'failed' }) {
  const cfg = {
    success: { label: '成功', bg: 'var(--success-bg)', color: 'var(--success)', borderColor: 'var(--success)' },
    partial: { label: '部分', bg: 'var(--warn-bg)', color: 'var(--warn)', borderColor: 'var(--warn)' },
    failed: { label: '失败', bg: 'var(--error-bg)', color: 'var(--error)', borderColor: 'var(--error)' },
  }[status];

  const icons = {
    success: <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="3" fill="none" />,
    partial: <path d="M5 12h14" stroke="currentColor" strokeWidth="3" fill="none" />,
    failed: <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="3" fill="none" />,
  }[status];

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '1px 8px', borderRadius: 10, fontSize: 11, fontWeight: 500,
      background: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.borderColor}`, borderLeftWidth: 3,
      verticalAlign: 'middle', marginLeft: 8,
    }}>
      <svg width="10" height="10" viewBox="0 0 24 24">{icons}</svg>
      {cfg.label}
    </span>
  );
}

// ── PromptStatus ───────────────────────────────────────────────
function PromptStatus({ status }: { status: 'success' | 'failed' | 'skipped' }) {
  const cfg = {
    success: { label: '[成功]', color: 'var(--success)' },
    failed: { label: '[失败]', color: 'var(--error)' },
    skipped: { label: '[跳过]', color: 'var(--text-muted)' },
  }[status];
  return <span style={{ minWidth: 64, flexShrink: 0, fontWeight: 500, color: cfg.color }}>{cfg.label}</span>;
}

export function GlobalTerminal({ workspaces }: GlobalTerminalProps) {
  const [input, setInput] = useState('');
  const [createNewSession, setCreateNewSession] = useState(false);
  const [loading, setLoading] = useState<LoadingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<WorkspaceResultEntry[] | null>(null);
  const [textareaFocused, setTextareaFocused] = useState(false);
  const abortRef = useRef<boolean>(false);

  const handleSend = useCallback(async () => {
    if (!input.trim() || loading === 'loading') return;

    setLoading('loading');
    setError(null);
    setResults(null);
    abortRef.current = false;

    try {
      const result: DispatchResult = await dispatchGlobalPromptsWithDefaults({
        rawInput: input,
        createNewSession,
        executePrompt: dispatchExecutePromptAdapter,
      });

      if (abortRef.current) return;

      const workspaceMap = new Map(workspaces.map(w => [w.id, w]));
      const mappedResults = result.workspaceResults.map(wr => ({
        workspaceId: wr.workspaceId,
        workspaceName: workspaceMap.get(wr.workspaceId)?.name ?? wr.workspaceId,
        status: wr.status,
        prompts: wr.promptResults.map(pr => ({
          prompt: pr.prompt,
          status: pr.status,
          reason: pr.reason,
        })),
      }));
      setResults(mappedResults);

      // 更新 store，触发 GlobalAgentTrigger 显示分析按钮
      useMultiDispatchStore.getState().setBatchResult(result.workspaceResults);
      useMultiDispatchStore.getState().setBatchId(result.batchId);
      useMultiDispatchStore.getState().setAllCompleted(true);
      useMultiDispatchStore.getState().setActive(true);
    } catch (err) {
      if (abortRef.current) return;
      setError(err instanceof Error ? err.message : 'Dispatch failed');
    } finally {
      if (!abortRef.current) setLoading('idle');
    }
  }, [input, createNewSession, loading, workspaces]);

  const handleClear = useCallback(() => {
    setInput('');
    setResults(null);
    setError(null);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  const isLoading = loading === 'loading';
  const hasContent = input.trim().length > 0;

  const textareaStyle = textareaFocused
    ? {
        background: 'var(--bg-input)', border: '1px solid var(--accent)',
        borderRadius: 8, padding: '10px 12px', color: 'var(--text-primary)',
        outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s',
        minHeight: 120, width: '100%', resize: 'vertical' as const, fontFamily: 'monospace', fontSize: '13px',
        boxShadow: '0 0 0 3px color-mix(in srgb, var(--accent) 15%, transparent)',
      }
    : {
        background: 'var(--bg-input)', border: '1px solid var(--border)',
        borderRadius: 8, padding: '10px 12px', color: 'var(--text-primary)',
        outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s',
        minHeight: 120, width: '100%', resize: 'vertical' as const, fontFamily: 'monospace', fontSize: '13px',
      };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
      {/* 输入区 */}
      <textarea
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setTextareaFocused(true)}
        onBlur={() => setTextareaFocused(false)}
        placeholder="输入 prompt（多行视为 list 模式）"
        rows={5}
        disabled={isLoading}
        aria-label="Prompt 输入框"
        style={textareaStyle}
      />

      {/* 控制行 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' as const }}>
          <input
            type="checkbox"
            checked={createNewSession}
            onChange={e => setCreateNewSession(e.target.checked)}
            disabled={isLoading}
            aria-label="新建会话"
          />
          新建会话
        </label>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {workspaces.length} 个工作区
        </span>
      </div>

      {/* 操作按钮 */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleSend}
          disabled={!hasContent || isLoading}
          onMouseEnter={e => { if (hasContent && !isLoading) e.currentTarget.style.background = 'var(--accent-dim)'; }}
          onMouseLeave={e => { if (hasContent && !isLoading) e.currentTarget.style.background = 'var(--accent)'; }}
          style={{
            background: hasContent && !isLoading ? 'var(--accent)' : 'var(--border)',
            color: hasContent && !isLoading ? 'white' : 'var(--text-muted)',
            border: 'none', padding: '7px 18px', borderRadius: 6,
            fontSize: 12, fontWeight: 500, cursor: hasContent && !isLoading ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit', transition: 'background 0.2s',
          }}
        >
          {isLoading ? '执行中…' : '发送'}
        </button>
        <button
          onClick={handleClear}
          disabled={isLoading}
          onMouseEnter={e => {
            if (!isLoading) {
              e.currentTarget.style.background = 'var(--bg-input)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }
          }}
          onMouseLeave={e => {
            if (!isLoading) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted)';
            }
          }}
          style={{
            background: 'transparent', color: 'var(--text-muted)',
            border: '1px solid var(--border)', padding: '7px 16px', borderRadius: 6,
            fontSize: 12, cursor: isLoading ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', transition: 'all 0.2s',
          }}
        >
          清空
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div role="alert" style={{
          background: 'var(--error-bg)', border: '1px solid var(--error-border)',
          borderRadius: 6, padding: '8px 12px', fontSize: 13, color: 'var(--error)',
        }}>
          {error}
        </div>
      )}

      {/* 结果展示 */}
      {results !== null && results.length > 0 && (
        <div>
          <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0 8px' }} />
          <strong style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 8 }}>
            执行结果
          </strong>
          {results.map(entry => (
            <div key={entry.workspaceId} style={{
              border: '1px solid var(--border)', borderRadius: 8,
              background: 'var(--bg-card)', padding: 12, marginBottom: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', marginBottom: 8 }}>
                {entry.workspaceName}
                <StatusBadge status={entry.status} />
              </div>
              {entry.prompts.map((p, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  fontSize: 13, marginTop: 4, fontFamily: 'monospace', lineHeight: 1.5,
                }}>
                  <PromptStatus status={p.status} />
                  <span style={{ color: 'var(--text-primary)', wordBreak: 'break-word' as const }}>{p.prompt}</span>
                  {p.reason && (
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>({p.reason})</span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
