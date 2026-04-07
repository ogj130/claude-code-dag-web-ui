import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useTaskStore } from '../../stores/useTaskStore';
import { MarkdownCard } from './MarkdownCard';
import { LiveCard } from './LiveCard';

interface Props {
  theme: 'dark' | 'light';
  onInput?: (input: string) => void;
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

export function TerminalView({ theme, onInput }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const shownLinesRef = useRef(0);
  // 标记 xterm 是否已挂载到 DOM（避免重复 open）
  const mountedRef = useRef(false);
  const [inputValue, setInputValue] = useState('');
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
  } = useTaskStore();

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
        navigator.clipboard.writeText(sel).catch(() => {/* ignore */});
      }
    });

    // 右键菜单：复制选中文字
    const ctxMenuHandler = (e: MouseEvent) => {
      const sel = term.getSelection();
      if (sel) {
        e.preventDefault();
        navigator.clipboard.writeText(sel).catch(() => {/* ignore */});
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

      // 容器尺寸变化时自动 fit
      const resizeObserver = new ResizeObserver(() => {
        if (containerRef.current?.clientHeight ?? 0 > 0) {
          fitAddon.fit();
        }
      });
      resizeObserverRef.current = resizeObserver;
      resizeObserver.observe(containerRef.current);

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
      resizeObserverRef.current?.disconnect();
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

  // 流式回答结束：清空标志
  useEffect(() => {
    if (!streamEndPending) return;
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

  // 外部文本框按 Enter 时发送
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      const text = inputValue.trim();
      setInputValue('');

      const term = terminalRef.current;
      if (!term) return;

      // 首次问题回答完毕后，第二次输入前显示分隔线
      if (markdownCards.length > 0) {
        writeSeparator(term, theme === 'dark');
      }

      // 回显用户输入（换行 + 提示符）
      term.writeln(`\n\x1b[36m›\x1b[0m \x1b[90m${text}\x1b[0m`);
      onInput?.(text);
    }
  };

  const totalTokens = tokenUsage.input + tokenUsage.output;
  const statusColor = error ? 'var(--error)' : isRunning ? 'var(--success)' : 'var(--text-muted)';
  const statusLabel = error ? '错误' : isRunning ? '运行中' : '空闲';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%' }}>
      {/* 顶部状态栏（保持不变） */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 14px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '8px 8px 0 0',
        borderBottom: 'none',
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fontSize: 11,
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
      }}>
        {/* MarkdownCard 列表（已完成） */}
        {markdownCards.length > 0 && (
          <div style={{ padding: '0 4px' }}>
            {markdownCards.map(card => (
              <MarkdownCard key={`${card.queryId}-${collapsedCardIds.has(card.queryId)}`} card={card} defaultAnalysisOpen={false} defaultCollapsed={collapsedCardIds.has(card.queryId)} />
            ))}
          </div>
        )}

        {/* 实时问答卡片（进行中） */}
        {previousCard && (
          <div style={{ padding: '0 4px' }}>
            <LiveCard card={previousCard} />
          </div>
        )}

        {currentCard && (
          <div style={{ padding: '0 4px' }}>
            <LiveCard card={currentCard} />
          </div>
        )}

        {/* xterm 工具调用日志 */}
        <div
          ref={containerRef}
          style={{
            minHeight: processCollapsed ? 0 : '120px',
            height: processCollapsed ? 0 : 'auto',
            overflow: 'hidden',
            background: 'var(--term-bg)',
            padding: processCollapsed ? 0 : '12px 8px 12px 12px',
            transition: 'padding 0.2s, height 0.2s',
            flexShrink: 0,
          }}
        />
      </div>

      {/* 输入框（保持不变） */}
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
        <span style={{
          color: 'var(--accent)',
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: 13,
          fontWeight: 700,
          lineHeight: 1,
          userSelect: 'none',
        }}>›</span>
        <input
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
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
    </div>
  );
}
