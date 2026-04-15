import { useState, useCallback, useRef } from 'react';
import { dispatchGlobalPromptsWithDefaults } from '@/services/globalDispatchService';
import { dispatchExecutePromptAdapter } from '@/services/globalDispatchExecutor';
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

export function GlobalTerminal({ workspaces }: GlobalTerminalProps) {
  const [input, setInput] = useState('');
  const [createNewSession, setCreateNewSession] = useState(false);
  const [loading, setLoading] = useState<LoadingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<WorkspaceResultEntry[] | null>(null);
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

      setResults(
        result.workspaceResults.map(wr => {
          const workspace = workspaceMap.get(wr.workspaceId);
          return {
            workspaceId: wr.workspaceId,
            workspaceName: workspace?.name ?? wr.workspaceId,
            status: wr.status,
            prompts: wr.promptResults.map(pr => ({
              prompt: pr.prompt,
              status: pr.status,
              reason: pr.reason,
            })),
          };
        }),
      );
    } catch (err) {
      if (abortRef.current) return;
      setError(err instanceof Error ? err.message : 'Dispatch failed');
    } finally {
      if (!abortRef.current) {
        setLoading('idle');
      }
    }
  }, [input, createNewSession, loading, workspaces]);

  const handleClear = useCallback(() => {
    setInput('');
    setResults(null);
    setError(null);
  }, []);

  const isLoading = loading === 'loading';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' }}>
      {/* 输入区 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="输入 prompt（多行视为 list 模式）"
          rows={5}
          disabled={isLoading}
          style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '14px' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <input
              type="checkbox"
              checked={createNewSession}
              onChange={e => setCreateNewSession(e.target.checked)}
              disabled={isLoading}
            />
            新建会话
          </label>
          <span style={{ fontSize: '12px', color: '#888' }}>
            {workspaces.length} 个工作区
          </span>
        </div>
      </div>

      {/* 操作按钮 */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={handleSend} disabled={!input.trim() || isLoading}>
          {isLoading ? '执行中…' : '发送'}
        </button>
        <button onClick={handleClear} disabled={isLoading}>
          清空
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div style={{ color: '#d32f2f', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {/* 结果展示 */}
      {results !== null && results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <hr />
          <strong>执行结果</strong>
          {results.map(entry => (
            <div
              key={entry.workspaceId}
              style={{
                border: '1px solid #ddd',
                borderRadius: '6px',
                padding: '10px',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: '6px' }}>
                {entry.workspaceName}
                <StatusBadge status={entry.status} />
              </div>
              {entry.prompts.map((p, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    gap: '8px',
                    fontSize: '13px',
                    marginTop: '4px',
                    fontFamily: 'monospace',
                  }}
                >
                  <span
                    style={{
                      color: p.status === 'success' ? '#2e7d32' : '#d32f2f',
                      minWidth: '60px',
                    }}
                  >
                    [{p.status}]
                  </span>
                  <span>{p.prompt}</span>
                  {p.reason && (
                    <span style={{ color: '#888' }}>({p.reason})</span>
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

function StatusBadge({ status }: { status: 'success' | 'partial' | 'failed' }) {
  const config = {
    success: { color: '#fff', background: '#2e7d32', label: '成功' },
    partial: { color: '#fff', background: '#f57c00', label: '部分' },
    failed: { color: '#fff', background: '#d32f2f', label: '失败' },
  }[status];

  return (
    <span
      style={{
        display: 'inline-block',
        marginLeft: '8px',
        padding: '1px 8px',
        borderRadius: '10px',
        fontSize: '11px',
        color: config.color,
        background: config.background,
        fontWeight: 400,
        verticalAlign: 'middle',
      }}
    >
      {config.label}
    </span>
  );
}
