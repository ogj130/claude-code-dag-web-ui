import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import '@xterm/xterm/css/xterm.css';
import { useTaskStore } from '../../stores/useTaskStore';
import { useRAGContext } from '../../hooks/useRAGContext';
import type { RAGContextItem } from '../../hooks/useRAGContext';
import { MarkdownCard } from './MarkdownCard';
import { LiveCard } from './LiveCard';
import { ToolCards } from './ToolCards';
import { useHistoryRecall } from '../../hooks/useHistoryRecall';
// V1.4.1: Attachment components
import { AttachmentButton, AttachmentPreviewStrip, AttachmentDetailPanel, AttachmentPreviewModal, TerminalAttachmentSection } from '../Attachment';
import { useFileUpload } from '../../hooks/useFileUpload';
import { useAttachmentStore, usePendingAttachments } from '../../stores/useAttachmentStore';
import type { PendingAttachment } from '../../types/attachment';
// Task 5: Upper/lower split
import { WorkspaceTagBar } from './WorkspaceTagBar';
import { GlobalSummaryPanel } from './GlobalSummaryPanel';
import { useTerminalWorkspaceStore } from '../../stores/useTerminalWorkspaceStore';
import { getEnabledPresets } from '../../stores/workspacePresetStorage';
import type { Workspace } from '../../types/workspace';
import type { DispatchWorkspaceResult } from '../../types/global-dispatch';

interface Props {
  theme: 'dark' | 'light';
  onInput?: (input: string) => boolean | void;
  style?: React.CSSProperties;
}

/** 写入视觉分隔线（AI 回答结束后，下次输入前的分隔） */
function writeSeparator(term: Terminal, isDark: boolean): void {
  const dim = isDark ? '\x1b[90m' : '\x1b[2m';
  const accent = '\x1b[36m'; // 青色
  term.write('\n');
  term.writeln(`${dim}┌${'─'.repeat(50)}┐${isDark ? '' : '\x1b[0m'}`);
  term.writeln(`${dim}│${accent} Claude Code  •  /Users/ouguangji/2026/cc-web-ui${' '.repeat(Math.max(0, 50 - 54))}${dim}│${isDark ? '' : '\x1b[0m'}`);
  term.writeln(`${dim}└${'─'.repeat(50)}┘${isDark ? '' : '\x1b[0m'}`);
}

function getXtermTheme(isDark: boolean) {
  if (isDark) {
    return {
      background: '#050508',
      foreground: '#c0c0c0',
      cursor: '#4a8eff',
      black: '#000000',
      red: '#e74c3c',
      green: '#2ecc71',
      yellow: '#f1c40f',
      blue: '#4a8eff',
      magenta: '#c56cff',
      cyan: '#6cf',
      white: '#e0e0e0',
    };
  }
  return {
    background: '#ffffff',
    foreground: '#1a1a2e',
    cursor: '#3a6fd8',
    black: '#000000',
    red: '#d03030',
    green: '#1a9e50',
    yellow: '#c07800',
    blue: '#3a6fd8',
    magenta: '#9055db',
    cyan: '#3498db',
    white: '#e0e0e0',
  };
}

export function TerminalView({ theme, onInput, style }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const shownLinesRef = useRef(0);
  // 标记 xterm 是否已挂载到 DOM（避免重复 open）
  const mountedRef = useRef(false);
  const [inputValue, setInputValue] = useState('');
  /** 本次发送的 query 文本（用于在上方分离显示） */
  const [pendingQueryText, setPendingQueryText] = useState('');
  /** 本次发送的 RAG chunks（用于在上方分离显示） */
  const [pendingRAGChunks, setPendingRAGChunks] = useState<RAGContextItem[]>([]);
  // V1.4.1: Attachment preview modal state
  const [previewAttachment, setPreviewAttachment] = useState<PendingAttachment | null>(null);
  // V1.4.1: Sent attachments for current query
  const [sentAttachments, setSentAttachments] = useState<PendingAttachment[]>([]);
  // 复制成功提示（xterm 选中文字后自动复制，或右键复制）
  const [copyHint, setCopyHint] = useState<string | null>(null);

  // Task 5: Upper/lower split state
  const [workspaceList, setWorkspaceList] = useState<Workspace[]>([]);
  const {
    activeWorkspaceId,
    setActiveWorkspace,
    isGlobalSummaryExpanded,
    collapseGlobalSummary,
    runningWorkspaces,
  } = useTerminalWorkspaceStore();

  // V1.4.1: File upload hook
  const { handleFileSelect, handleRemoveAttachment, handleClearAll, getReadyAttachments } = useFileUpload();
  const { setPreviewExpanded } = useAttachmentStore();
  const pendingAttachments = usePendingAttachments();
  const {
    terminalLines,
    streamEndPending,
    clearStreamEnd,
    isStarting,
    isRunning,
    error,
    tokenUsage,
    pendingInputsCount = 0,
    markdownCards,
    processCollapsed,
    collapsedCardIds,
    currentCard,
    previousCard,
    summaryChunks,
  } = useTaskStore();

  // 历史召回 Hook
  const {
    state: recallState,
    onInputChange,
    onToolError,
    dismissSimilarHint,
    dismissErrorHint,
  } = useHistoryRecall({ debounceMs: 250, similarityThreshold: 0.8, maxResults: 4 });

  // 监听 toolCalls 错误以触发错误解决方案推荐
  const prevToolCallsRef = useRef(0);
  useEffect(() => {
    if (recallState.isIndexing) return;
    const toolCalls = useTaskStore.getState().toolCalls;
    if (toolCalls.length > prevToolCallsRef.current) {
      const lastCall = toolCalls[toolCalls.length - 1];
      if (lastCall.status === 'error' && lastCall.result) {
        onToolError(String(lastCall.result));
      }
    }
    prevToolCallsRef.current = toolCalls.length;
  });

  // 输入变化时触发召回
  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);
    onInputChange(value);
  }, [onInputChange]);

  // 点击推荐项时填充输入框
  const handleApplyRecall = useCallback((query: string) => {
    setInputValue(query);
    onInputChange(query);
  }, [onInputChange]);

  // xterm 初始化：只运行一次，term 实例持久化
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({
      theme: getXtermTheme(theme === 'dark'),
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontSize: 12,
      lineHeight: 1.6,
      scrollback: 500,
      cursorBlink: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    // xterm 键盘输入（供外部程序化调用）
    term.onData((data: string) => {
      if (data === '\r') {
        if (inputValue.trim()) {
          onInput?.(inputValue.trim());
          setInputValue('');
        }
      }
    });

    // 选中文字自动复制到剪贴板
    term.onSelectionChange(() => {
      const sel = term.getSelection();
      if (sel) {
        navigator.clipboard.writeText(sel).then(() => {
          setCopyHint('已复制');
          setTimeout(() => setCopyHint(null), 2000);
        }).catch(() => {/* ignore */});
      }
    });

    // 右键菜单：复制选中文字
    const ctxMenuHandler = (e: MouseEvent) => {
      const sel = term.getSelection();
      if (sel) {
        e.preventDefault();
        navigator.clipboard.writeText(sel).then(() => {
          setCopyHint('已复制');
          setTimeout(() => setCopyHint(null), 2000);
        }).catch(() => {/* ignore */});
      }
    };
    container.addEventListener('contextmenu', ctxMenuHandler);

    // 等容器布局完成后再 open（flex 布局需要 paint 后才有真实高度）
    let rafId: number;
    const tryOpen = () => {
      if (!containerRef.current) return;
      const h = containerRef.current.clientHeight;
      if (h <= 0) {
        rafId = requestAnimationFrame(tryOpen); // 还没布局好，继续等
        return;
      }
      fitAddon.fit();
      term.open(containerRef.current);
      terminalRef.current = term;
      mountedRef.current = true;

      // 重要：不使用 ResizeObserver！
      // ResizeObserver 在 xterm 内容增长时触发 fitAddon.fit()，
      // 而 fitAddon.fit() 会改变容器尺寸 → ResizeObserver 再次触发 → 无限循环
      // 改为固定 height: 320px，让 xterm 自己处理行数计算

      // 优雅的启动横幅
      const accent = '\x1b[36m';
      const dim = '\x1b[90m';
      const bold = '\x1b[1m';
      const reset = '\x1b[0m';
      term.writeln('');
      term.writeln(`${dim}╭${'─'.repeat(54)}╮${reset}`);
      term.writeln(`${dim}│ ${bold}${accent}Claude Code${reset}  ${dim}Interactive Session${reset}${' '.repeat(16)}${dim}│${reset}`);
      term.writeln(`${dim}│ ${dim}/Users/ouguangji/2026/cc-web-ui${' '.repeat(25)}${dim}│${reset}`);
      term.writeln(`${dim}╰${'─'.repeat(54)}╯${reset}`);
      term.writeln('');
    };
    rafId = requestAnimationFrame(tryOpen);

    return () => {
      cancelAnimationFrame(rafId);
      // resizeObserver 已移除（不再监听容器尺寸变化）
      container.removeEventListener('contextmenu', ctxMenuHandler);
      term.dispose();
      terminalRef.current = null;
      mountedRef.current = false;
      shownLinesRef.current = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // processCollapsed 切换时：折叠时清空 xterm 内容，展开时 fit
  useEffect(() => {
    const term = terminalRef.current;
    const container = containerRef.current;
    if (!term || !container) return;

    if (processCollapsed) {
      // 折叠：清空 xterm 内容
      term.clear();
    } else {
      // 展开：重新 fit
      if (container.clientHeight > 0) {
        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        fitAddon.fit();
      }
    }
  }, [processCollapsed]);

  // 主题切换时更新 xterm 配色
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.options.theme = getXtermTheme(theme === 'dark');
    }
  }, [theme]);

  // 追加新行（去重）
  useEffect(() => {
    const term = terminalRef.current;
    if (!term || terminalLines.length <= shownLinesRef.current) return;

    const newLines = terminalLines.slice(shownLinesRef.current);
    shownLinesRef.current = terminalLines.length;

    for (const line of newLines) {
      term.writeln(line);
    }
  }, [terminalLines]);

  // 工具交互提示：写入 xterm（不再重复显示，ToolCards 已统一展示）
  // useEffect(() => {
  //   const term = terminalRef.current;
  //   if (!term) return;
  //   for (const [toolId, message] of toolProgressMessages) {
  //     if (prevToolProgressRef.current.get(toolId) === message) continue;
  //     prevToolProgressRef.current.set(toolId, message);
  //     const color = getToolProgressColor(toolProgressMessages, toolId);
  //     const label = getToolLabel(toolId);
  //     term.writeln(`${color}▸ \x1b[0m${color}${label}\x1b[0m ${message}`);
  //   }
  // }, [toolProgressMessages]);

  // 流式回答结束：显示完成提示
  useEffect(() => {
    if (!streamEndPending) return;
    const term = terminalRef.current;
    if (term) {
      term.writeln('');
      term.writeln('\x1b[32m✓ 回答已生成\x1b[0m');
    }
    clearStreamEnd();
  }, [streamEndPending, clearStreamEnd]);

  // 启动成功：更新状态行
  useEffect(() => {
    const term = terminalRef.current;
    if (!term || !isRunning) return;
    term.writeln('\x1b[32m✓ Claude Code 已连接，正在工作...\x1b[0m');
  }, [isRunning]);

  // 出错：显示错误
  useEffect(() => {
    const term = terminalRef.current;
    if (!term || !error) return;
    term.writeln(`\x1b[31m✗ 错误: ${error}\x1b[0m`);
  }, [error]);

  // Task 5: Load enabled workspaces on mount
  useEffect(() => {
    getEnabledPresets().then(presets => {
      const wsList: Workspace[] = presets.map(p => ({
        id: p.id,
        name: p.name || p.workspacePath.split('/').pop() || '未命名',
        workspacePath: p.workspacePath,
        modelConfigId: p.configId || '',
        enabled: p.isEnabled,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      }));
      setWorkspaceList(wsList);
      // Default to first workspace
      if (wsList.length > 0 && !activeWorkspaceId) {
        setActiveWorkspace(wsList[0].id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 外部文本框按 Enter 时发送
  const { getPromptContext, items: ragItems } = useRAGContext();

  // V1.4.1: Handle preview modal
  const handlePreviewAttachment = useCallback((attachment: PendingAttachment) => {
    setPreviewAttachment(attachment);
  }, []);

  // V1.4.1: Handle send with attachments
  const handleSendWithAttachments = useCallback(() => {
    const text = inputValue.trim();
    if (!text && pendingAttachments.length === 0) return;

    const term = terminalRef.current;
    if (!term) return;

    // 先清空输入框
    setInputValue('');

    // 首次问题回答完毕后，第二次输入前显示分隔线
    if (markdownCards.length > 0) {
      writeSeparator(term, theme === 'dark');
    }

    // 获取附件
    const readyAttachments = getReadyAttachments();

    // 回显用户输入
    term.writeln(`\n\x1b[36m›\x1b[0m \x1b[90m${text || '(仅附件)'}\x1b[0m`);

    // ── 构造 payload ────────────────────────────────────────
    const payload: Record<string, unknown> = { query: text };
    if (ragItems.length > 0) {
      payload.ragChunks = ragItems;
    }

    // V1.4.1: 添加附件信息到 payload
    if (readyAttachments.length > 0) {
      payload.attachments = readyAttachments.map(att => ({
        type: att.type,
        mimeType: att.mimeType,
        fileName: att.fileName,
        imageData: att.imageData,
        textContent: att.textContent,
      }));

      // V1.4.1: 同步到 TaskStore（保留完整数据用于预览，仅 payload 不发送 textContent）
      useTaskStore.getState().setPendingAttachments(readyAttachments.map((att) => ({
        id: att.id,
        type: att.type,
        mimeType: att.mimeType,
        fileName: att.fileName,
        fileSize: att.fileSize,
        thumbnailData: att.thumbnailData,
        imageData: att.imageData,
        textContent: att.textContent,
        textPreview: att.textPreview,
      })));

      // 显示发送的附件（终端中）
      setSentAttachments([...readyAttachments]);
    }

    // ── 设置 pending RAG 状态 ────────────────────────────────
    if (ragItems.length > 0) {
      useTaskStore.getState().setPendingRAGItems(
        ragItems.map(item => ({
          id: item.id,
          content: item.content,
          summary: item.summary,
          score: item.score,
          sourceSessionId: item.sourceSessionId,
          sourceSessionTitle: item.sourceSessionTitle,
          timestamp: item.timestamp,
        }))
      );
      setPendingQueryText(text);
      setPendingRAGChunks([...ragItems]);
    }

    // 获取 RAG 上下文
    const ragContext = getPromptContext();
    const finalPayload = ragContext
      ? `${ragContext}用户问题：${JSON.stringify(payload)}`
      : JSON.stringify(payload);

    // 发送消息
    try {
      const sent = onInput?.(finalPayload);
      if (sent === false) {
        // sendInput 返回 false 表示 WS 未 OPEN（正在连接中或已关闭）
        // 消息已自动加入重连队列，稍后会自动发送，无需显示误导性错误
        term.writeln('\x1b[33m⚠ 正在等待连接，消息已加入队列...\x1b[0m');
      } else {
        // 清除 RAG 上下文
        if (ragItems.length > 0) {
          useRAGContext.getState().clearAll();
          setTimeout(() => {
            setPendingQueryText('');
            setPendingRAGChunks([]);
          }, 3000);
        }

        // V1.4.1: 清除已发送的附件
        if (readyAttachments.length > 0) {
          handleClearAll();
          // 3秒后清除终端中的附件显示
          setTimeout(() => {
            setSentAttachments([]);
          }, 3000);
        }
      }
    } catch (err) {
      term.writeln(`\x1b[31m✗ 发送异常: ${String(err)}\x1b[0m`);
    }
  }, [inputValue, pendingAttachments, markdownCards, ragItems, getPromptContext, getReadyAttachments, handleClearAll, onInput, theme]);

  // 兼容旧的 handleInputKeyDown（用于 Ctrl+Enter 发送）
  const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendWithAttachments();
    }
  }, [handleSendWithAttachments]);

  const totalTokens = tokenUsage.input + tokenUsage.output;
  const statusColor = error ? 'var(--error)' : isRunning ? 'var(--success)' : 'var(--text-muted)';
  const statusLabel = error ? '错误' : isRunning ? '运行中' : '空闲';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%', ...style }}>
      {/* Task 5: 工作区标签栏 */}
      <WorkspaceTagBar
        workspaces={workspaceList}
        activeWorkspaceId={activeWorkspaceId}
        onSwitch={setActiveWorkspace}
        runningWorkspaces={runningWorkspaces}
      />

      {/* Task 5: UpperPane — 现有终端内容 */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* 顶部状态栏 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 14px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 0,
          borderTop: 'none',
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: 11,
          flexShrink: 0,
        }}>
        {/* 连接状态 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: statusColor,
            display: 'inline-block',
            boxShadow: `0 0 5px ${statusColor}`,
          }} />
          <span style={{ color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.05em' }}>Claude Code</span>
          <span style={{ color: 'var(--border)', fontSize: 10 }}>·</span>
          <span style={{ color: 'var(--text-muted)' }}>{statusLabel}</span>
        </div>
        {/* Token 计数 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)' }}>
          {tokenUsage.input > 0 && (
            <span>In <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{tokenUsage.input.toLocaleString()}</span></span>
          )}
          {tokenUsage.output > 0 && (
            <span>Out <span style={{ color: 'var(--success)', fontWeight: 600 }}>{tokenUsage.output.toLocaleString()}</span></span>
          )}
          {totalTokens > 0 && (
            <span style={{ color: 'var(--text-secondary)', fontSize: 10 }}>{totalTokens.toLocaleString()} tok</span>
          )}
        </div>
      </div>

      {/* 主内容区 */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--term-bg)',
        border: '1px solid var(--term-border)',
        borderTop: 'none',
        borderBottom: 'none',
        transition: 'background 0.3s, border-color 0.3s',
        // 防止无限增高：内容区最多占据视口的 65vh，超出后滚动
        // 这避免了页面什么都不输入时内容区无限扩张的问题
        maxHeight: '65vh',
      }}>
        {/* MarkdownCard 列表（已完成） */}
        {markdownCards.length > 0 && (
          <div style={{ padding: '0 4px' }}>
            {markdownCards.map(card => (
              <MarkdownCard key={`${card.queryId}-${collapsedCardIds.has(card.queryId)}`} card={card} defaultAnalysisOpen={false} defaultCollapsed={collapsedCardIds.has(card.queryId)} onAttachmentClick={(att) => setPreviewAttachment(att)} />
            ))}
          </div>
        )}

        {/* 上一轮问答（已完成的当前轮） */}
        {previousCard && (
          <div style={{ padding: '0 4px' }}>
            <LiveCard card={previousCard} />
          </div>
        )}

        {/* 上一轮问答的工具卡片（等待总结到来时，展示工具执行详情） */}
        {previousCard && (
          <div style={{ padding: '0 4px' }}>
            <ToolCards queryId={previousCard.queryId} />
          </div>
        )}

        {/* 当前问答（进行中） */}
        {currentCard && (
          <div style={{ padding: '0 4px' }}>
            <LiveCard card={currentCard} />
          </div>
        )}

        {/* 当前 query 的工具卡片（跟随 LiveCard，展示当前轮的工具详情） */}
        {currentCard && (
          <div style={{ padding: '0 4px' }}>
            <ToolCards queryId={currentCard.queryId} />
          </div>
        )}

        {/* 流式总结（实时 Markdown 渲染，只要有 chunk 就显示，不依赖 currentCard） */}
        {summaryChunks.length > 0 && (
          <div style={{
            padding: '10px 12px',
            background: 'rgba(46,204,113,0.04)',
            borderTop: '1px solid rgba(46,204,113,0.15)',
            marginTop: 4,
          }}>
            {/* 状态头 */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginBottom: 6,
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'var(--success)',
                animation: 'stream-pulse 1s ease-in-out infinite',
                flexShrink: 0,
              }} />
              <span style={{
                fontSize: 9, color: 'var(--success)',
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: '0.08em', textTransform: 'uppercase',
              }}>
                总结生成中
              </span>
              <span style={{
                color: 'var(--success)', fontSize: 11,
                animation: 'cursor-blink 0.8s step-end infinite',
              }}>▊</span>
            </div>
            {/* Markdown 流式内容 */}
            <div style={{
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              fontSize: 11,
              color: 'var(--text-secondary)',
              lineHeight: 1.7,
              maxHeight: 300,
              overflowY: 'auto',
            }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {summaryChunks.join('')}
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
        )}

        {/* ── Query + RAG Chunks 分离显示 ────────────────────────────── */}
        {(pendingQueryText || pendingRAGChunks.length > 0) && (
          <div style={{
            padding: '8px 12px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}>
            {/* Query 区（蓝色边框） */}
            {pendingQueryText && (
              <div style={{
                border: '1px solid rgba(74,142,255,0.35)',
                borderRadius: 6,
                padding: '6px 10px',
                background: 'rgba(74,142,255,0.04)',
              }}>
                <div style={{
                  fontSize: 9,
                  color: 'rgba(74,142,255,0.7)',
                  fontFamily: "'JetBrains Mono', monospace",
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  marginBottom: 3,
                }}>
                  用户问题
                </div>
                <div style={{
                  fontSize: 12,
                  color: 'var(--text-primary)',
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  {pendingQueryText}
                </div>
              </div>
            )}

            {/* RAG Chunks 区（紫色边框） */}
            {pendingRAGChunks.length > 0 && (
              <div style={{
                border: '1px solid rgba(167,139,250,0.35)',
                borderRadius: 6,
                padding: '6px 10px',
                background: 'rgba(167,139,250,0.04)',
              }}>
                <div style={{
                  fontSize: 9,
                  color: 'rgba(167,139,250,0.7)',
                  fontFamily: "'JetBrains Mono', monospace",
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  marginBottom: 4,
                }}>
                  历史召回 ({pendingRAGChunks.length} 条)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {pendingRAGChunks.map((chunk, index) => (
                    <div key={chunk.id} style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 6,
                      fontSize: 10,
                      color: 'var(--text-secondary)',
                    }}>
                      <span style={{
                        color: 'rgba(167,139,250,0.7)',
                        fontFamily: "'JetBrains Mono', monospace",
                        flexShrink: 0,
                      }}>
                        [{index + 1}]
                      </span>
                      <span style={{
                        color: chunk.chunkType === 'answer' ? 'var(--text-secondary)' :
                               chunk.chunkType === 'query' ? 'rgba(74,142,255,0.8)' :
                               'rgba(74,222,128,0.7)',
                        flexShrink: 0,
                      }}>
                        {chunk.chunkType === 'answer' ? '回答' : chunk.chunkType === 'query' ? '问题' : '工具'}
                      </span>
                      <span style={{
                        color: 'rgba(167,139,250,0.6)',
                        fontFamily: "'JetBrains Mono', monospace",
                        flexShrink: 0,
                      }}>
                        {(chunk.score * 100).toFixed(0)}%
                      </span>
                      <span style={{
                        color: 'var(--text-muted)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {chunk.content.length > 60 ? chunk.content.substring(0, 60) + '…' : chunk.content}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* xterm 工具调用日志 */}
        <div
          ref={containerRef}
          style={{
            minHeight: processCollapsed ? 0 : '120px',
            // flex: 1 让终端与兄弟元素（历史面板）共享剩余空间
            // maxHeight 限制最多 15 行（约 320px），避免终端过高挤压 DAG
            flex: processCollapsed ? 0 : 1,
            maxHeight: processCollapsed ? 0 : 320,
            overflow: 'hidden',
            background: 'var(--term-bg)',
            padding: processCollapsed ? 0 : '12px 8px 12px 12px',
            transition: 'padding 0.2s, height 0.2s',
            flexShrink: 0,
            position: 'relative',
          }}
        >
          {/* 复制成功提示（选中文字后自动显示） */}
          {copyHint && (
            <div style={{
              position: 'absolute',
              top: 8,
              right: 16,
              zIndex: 10,
              background: 'rgba(46, 204, 113, 0.15)',
              border: '1px solid rgba(46, 204, 113, 0.4)',
              color: 'var(--success)',
              fontSize: 11,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              padding: '3px 10px',
              borderRadius: 12,
              pointerEvents: 'none',
            }}>
              {copyHint} ✂
            </div>
          )}
        </div>
      </div>
      </div>

      {/* 历史召回推荐面板 */}
      {(!recallState.isIndexing && (recallState.showSimilarHint || recallState.showErrorHint || recallState.rankedResults.length > 0 || recallState.welcomeSuggestions.length > 0)) && (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderTop: 'none',
          borderRadius: 0,
          padding: '6px 12px',
          fontSize: 11,
          maxHeight: 160,
          overflowY: 'auto',
          transition: 'opacity 0.2s',
        }}>
          {/* 相似问题提示 */}
          {recallState.showSimilarHint && recallState.similarQueries.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: 'var(--accent)',
                fontWeight: 600,
                fontSize: 10,
                letterSpacing: '0.03em',
                marginBottom: 4,
              }}>
                <span>你之前问过类似问题</span>
                <button
                  onClick={dismissSimilarHint}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: 10,
                    padding: 0,
                  }}
                >
                  忽略
                </button>
              </div>
              {recallState.similarQueries.slice(0, 3).map((sq, i) => (
                <div
                  key={`sim-${sq.document.id}-${i}`}
                  onClick={() => handleApplyRecall(sq.document.query)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 4,
                    background: 'rgba(74, 142, 255, 0.06)',
                    marginBottom: 2,
                    cursor: 'pointer',
                    color: 'var(--text-secondary)',
                    transition: 'background 0.15s',
                    display: 'flex',
                    gap: 6,
                    alignItems: 'center',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(74, 142, 255, 0.12)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(74, 142, 255, 0.06)')}
                >
                  <span style={{ color: 'var(--text-muted)', fontSize: 9, flexShrink: 0 }}>
                    {Math.round(sq.similarity * 100)}%
                  </span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {sq.document.query.length > 80 ? sq.document.query.slice(0, 80) + '...' : sq.document.query}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* 错误解决方案提示 */}
          {recallState.showErrorHint && recallState.errorSolutions.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: 'var(--warn)',
                fontWeight: 600,
                fontSize: 10,
                letterSpacing: '0.03em',
                marginBottom: 4,
              }}>
                <span>找到相似错误的解决方案</span>
                <button
                  onClick={dismissErrorHint}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: 10,
                    padding: 0,
                  }}
                >
                  忽略
                </button>
              </div>
              {recallState.errorSolutions.slice(0, 2).map((es, i) => (
                <div
                  key={`err-${es.document.id}-${i}`}
                  onClick={() => handleApplyRecall(es.document.query)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 4,
                    background: 'rgba(255, 170, 50, 0.06)',
                    marginBottom: 2,
                    cursor: 'pointer',
                    color: 'var(--text-secondary)',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255, 170, 50, 0.12)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255, 170, 50, 0.06)')}
                >
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 2 }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: 9, flexShrink: 0 }}>
                      Q:
                    </span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {es.document.query.length > 60 ? es.document.query.slice(0, 60) + '...' : es.document.query}
                    </span>
                  </div>
                  {es.document.summary && (
                    <div style={{ color: 'var(--success)', fontSize: 10, paddingLeft: 14 }}>
                      解决方案: {es.document.summary.length > 80 ? es.document.summary.slice(0, 80) + '...' : es.document.summary}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 召回排序结果（输入时显示） */}
          {recallState.rankedResults.length > 0 && (
            <div style={{ marginBottom: 4 }}>
              <div style={{
                color: 'var(--text-muted)',
                fontSize: 9,
                letterSpacing: '0.03em',
                textTransform: 'uppercase',
                marginBottom: 3,
              }}>
                相关历史 ({recallState.rankedResults.length})
              </div>
              {recallState.rankedResults.map((r, i) => (
                <div
                  key={`rank-${r.id}-${i}`}
                  onClick={() => handleApplyRecall(r.query)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 4,
                    background: 'rgba(255, 255, 255, 0.02)',
                    marginBottom: 2,
                    cursor: 'pointer',
                    color: 'var(--text-secondary)',
                    transition: 'background 0.15s',
                    display: 'flex',
                    gap: 6,
                    alignItems: 'center',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)')}
                >
                  <span style={{ color: 'var(--text-muted)', fontSize: 9, flexShrink: 0 }}>
                    #{i + 1}
                  </span>
                  <span style={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {r.query.length > 80 ? r.query.slice(0, 80) + '...' : r.query}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 9, flexShrink: 0 }}>
                    {Math.round(r.score * 100)}%
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* 欢迎推荐（无输入时，显示最近的历史记录） */}
          {inputValue.trim() === '' && recallState.welcomeSuggestions.length > 0 && (
            <div style={{ marginBottom: 4 }}>
              <div style={{
                color: 'var(--text-muted)',
                fontSize: 9,
                letterSpacing: '0.03em',
                textTransform: 'uppercase',
                marginBottom: 3,
              }}>
                最近问答 ({recallState.welcomeSuggestions.length})
              </div>
              {recallState.welcomeSuggestions.map((r, i) => (
                <div
                  key={`welcome-${r.id}-${i}`}
                  onClick={() => handleApplyRecall(r.query)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 4,
                    background: 'rgba(255, 255, 255, 0.02)',
                    marginBottom: 2,
                    cursor: 'pointer',
                    color: 'var(--text-secondary)',
                    transition: 'background 0.15s',
                    display: 'flex',
                    gap: 6,
                    alignItems: 'center',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)')}
                >
                  <span style={{ color: 'var(--text-muted)', fontSize: 9, flexShrink: 0 }}>
                    #{i + 1}
                  </span>
                  <span style={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {r.query.length > 80 ? r.query.slice(0, 80) + '...' : r.query}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Task 5: 全局分发汇总面板 */}
      <GlobalSummaryPanel
        isExpanded={isGlobalSummaryExpanded}
        workspaces={workspaceList}
        batchResult={null as DispatchWorkspaceResult[] | null}
        activeWorkspaceId={activeWorkspaceId}
        onCollapse={collapseGlobalSummary}
        onAnalyze={() => {}}
      />

      {/* V1.4.1: 附件预览条带（发送前） */}
      <AttachmentPreviewStrip
        onRemove={handleRemoveAttachment}
        onClearAll={handleClearAll}
        onToggleExpand={() => setPreviewExpanded(true)}
        onPreview={handlePreviewAttachment}
        onFileSelect={handleFileSelect}
      />

      {/* V1.4.1: 附件详情面板（可展开） */}
      <AttachmentDetailPanel
        onRemove={handleRemoveAttachment}
        onPreview={handlePreviewAttachment}
      />

      {/* V1.4.1: 已发送的附件（终端中显示） */}
      {sentAttachments.length > 0 && (
        <TerminalAttachmentSection
          attachments={sentAttachments}
          onPreview={handlePreviewAttachment}
        />
      )}

      {/* 输入框 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderTop: 'none',
        borderRadius: '0 0 8px 8px',
        padding: '0 12px',
        transition: 'border-color 0.2s',
      }}
        onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
        onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
      >
        {/* V1.4.1: 附件按钮 */}
        <AttachmentButton onFilesSelected={handleFileSelect} />

        <span style={{
          color: 'var(--accent)',
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: 13,
          fontWeight: 700,
          lineHeight: 1,
          userSelect: 'none',
          marginLeft: 4,
        }}>›</span>
        <input
          type="text"
          value={inputValue}
          onChange={e => handleInputChange(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder={
            isRunning
              ? 'Claude 工作中，可继续输入...'
              : isStarting
              ? '等待 Claude Code 启动...'
              : '输入消息，按 Enter 发送...'
          }
          disabled={false}
          style={{
            flex: 1,
            padding: '10px 8px',
            fontSize: 12,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            background: 'transparent',
            color: 'var(--text-primary)',
            border: 'none',
            outline: 'none',
            cursor: isRunning ? 'text' : 'not-allowed',
          }}
        />
        {pendingInputsCount > 0 && (
          <span style={{
            padding: '2px 8px',
            borderRadius: 10,
            fontSize: 10,
            background: 'var(--warn-bg)',
            color: 'var(--warn)',
            border: '1px solid var(--warn-border)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}>
            +{pendingInputsCount} 条等待
          </span>
        )}
      </div>

      {/* V1.4.1: 附件预览弹窗 */}
      <AttachmentPreviewModal
        attachment={previewAttachment}
        onClose={() => setPreviewAttachment(null)}
      />
    </div>
  );
}
