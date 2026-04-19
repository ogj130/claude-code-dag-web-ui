import { useState, useCallback, useRef } from 'react';
import { dispatchGlobalPrompts } from '@/services/globalDispatchService';
import { dispatchExecutePromptAdapter } from '@/services/globalDispatchExecutor';
import { useMultiDispatchStore } from '@/stores/useMultiDispatchStore';
import type { Workspace } from '@/types/workspace';

export interface GlobalTerminalProps {
  workspaces: Workspace[];
  /** 模态框关闭回调；点击发送后立即调用（结果流向 TerminalView） */
  onClose?: () => void;
}

export function GlobalTerminal({ workspaces, onClose }: GlobalTerminalProps) {
  const [input, setInput] = useState('');
  const [createNewSession, setCreateNewSession] = useState(false);
  const [textareaFocused, setTextareaFocused] = useState(false);
  const abortRef = useRef<boolean>(false);

  // 非阻塞：fire-and-forget，dispatch 结果写入 useMultiDispatchStore（流向 TerminalView）
  const handleSend = useCallback(() => {
    if (!input.trim()) return;
    abortRef.current = false;

    dispatchGlobalPrompts({
      rawInput: input,
      workspaces,
      createNewSession,
      executePrompt: dispatchExecutePromptAdapter,
    }).then(result => {
      if (abortRef.current) return;
      useMultiDispatchStore.getState().setBatchResult(result.workspaceResults);
      useMultiDispatchStore.getState().setBatchId(result.batchId);
      useMultiDispatchStore.getState().setAllCompleted(true);
      useMultiDispatchStore.getState().setActive(true);
    }).catch(err => {
      if (!abortRef.current) console.error('[GlobalTerminal] dispatch error:', err);
    });

    // 立即关闭模态框（结果在 TerminalView 中展示）
    onClose?.();
  }, [input, createNewSession, workspaces, onClose]);

  const handleClear = useCallback(() => {
    setInput('');
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

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
          disabled={!hasContent}
          onMouseEnter={e => { if (hasContent) e.currentTarget.style.background = 'var(--accent-dim)'; }}
          onMouseLeave={e => { if (hasContent) e.currentTarget.style.background = 'var(--accent)'; }}
          style={{
            background: hasContent ? 'var(--accent)' : 'var(--border)',
            color: hasContent ? 'white' : 'var(--text-muted)',
            border: 'none', padding: '7px 18px', borderRadius: 6,
            fontSize: 12, fontWeight: 500, cursor: hasContent ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit', transition: 'background 0.2s',
          }}
        >
          发送
        </button>
        <button
          onClick={handleClear}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--bg-input)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--text-muted)';
          }}
          style={{
            background: 'transparent', color: 'var(--text-muted)',
            border: '1px solid var(--border)', padding: '7px 16px', borderRadius: 6,
            fontSize: 12, cursor: 'pointer',
            fontFamily: 'inherit', transition: 'all 0.2s',
          }}
        >
          清空
        </button>
      </div>
    </div>
  );
}
