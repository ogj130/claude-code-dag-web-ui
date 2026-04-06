import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { useTaskStore } from '../../stores/useTaskStore';

interface Props {
  theme: 'dark' | 'light';
  onInput?: (input: string) => void;
}

/** 清理 Markdown 语法，保留纯文本和换行 */
function stripMarkdown(text: string): string {
  return text
    .trim()
    // 代码块（优先）
    .replace(/```[\w]*\n?([\s\S]*?)```/g, '$1')
    // 行内代码
    .replace(/`([^`]+)`/g, '$1')
    // 粗体 / 斜体 / 删除线
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/__([^_\n]+)__/g, '$1')
    .replace(/\*(?!\s)([^*\n]+)\*/g, '$1')
    .replace(/_(?![\s-])([^_\n]+)_/g, '$1')
    .replace(/~~([^~\n]+)~~/g, '$1')
    // 标题
    .replace(/^#{1,3}\s+/gm, '» ')
    // 水平线
    .replace(/^[-*_]{3,}$/gm, '')
    // 引用
    .replace(/^>\s?/gm, '| ')
    // 无序列表
    .replace(/^(\s*)[-*+]\s+/gm, '$1• ')
    // 有序列表
    .replace(/^(\s*)\d+\.\s+/gm, '$1')
    // 链接
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}

/**
 * 智能断行：超过 maxCols 字符时在最后一个空格处截断，
 * 防止 xterm.js 自由折行导致的"楼梯"效果。
 */
function wrapLine(line: string, maxCols: number): string[] {
  if (line.length <= maxCols) return [line];
  const parts: string[] = [];
  while (line.length > maxCols) {
    const breakIdx = line.lastIndexOf(' ', maxCols);
    if (breakIdx <= 0) break; // 无空格，强截
    parts.push(line.slice(0, breakIdx));
    line = line.slice(breakIdx + 1);
  }
  parts.push(line);
  return parts;
}

/** 写入一个片段：清理 Markdown + 每行从列 0 开始 + 智能断行 */
function writeChunk(term: Terminal, raw: string): void {
  const clean = stripMarkdown(raw);
  const lines = clean.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    // 空行：只写换行
    if (!trimmed) {
      term.write('\n');
      continue;
    }
    // 每行从列 0 开始，防止 xterm 自由折行导致楼梯效果
    const wrapped = wrapLine(trimmed, 120);
    for (const part of wrapped) {
      term.write('\r');        // 光标移到行首
      term.write(part);
      term.write('\n');
    }
  }
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
  const shownLinesRef = useRef(0);
  const shownFragmentsRef = useRef(0);
  const [inputValue, setInputValue] = useState('');
  const { terminalLines, terminalChunks, streamEndPending, clearStreamEnd, isStarting, isRunning, error, tokenUsage } = useTaskStore();

  // 初始化 terminal（仅一次）
  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      theme: getXtermTheme(theme === 'dark'),
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontSize: 12,
      lineHeight: 1.6,
      scrollback: 500,
      cursorBlink: true,
    });

    term.open(containerRef.current);
    terminalRef.current = term;

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
    containerRef.current.addEventListener('contextmenu', (e: MouseEvent) => {
      const sel = term.getSelection();
      if (sel) {
        e.preventDefault();
        navigator.clipboard.writeText(sel).catch(() => {/* ignore */});
      }
    });

    // 优雅的启动横幅
    const accent = '\x1b[36m'; // 青色
    const dim = '\x1b[90m';
    const bold = '\x1b[1m';
    const reset = '\x1b[0m';
    term.writeln('');
    term.writeln(`${dim}╭${'─'.repeat(54)}╮${reset}`);
    term.writeln(`${dim}│ ${bold}${accent}Claude Code${reset}  ${dim}Interactive Session${reset}${' '.repeat(16)}${dim}│${reset}`);
    term.writeln(`${dim}│ ${dim}/Users/ouguangji/2026/cc-web-ui${' '.repeat(25)}${dim}│${reset}`);
    term.writeln(`${dim}╰${'─'.repeat(54)}╯${reset}`);
    term.writeln('');

    return () => {
      term.dispose();
      terminalRef.current = null;
      shownLinesRef.current = 0;
      shownFragmentsRef.current = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      // 直接写入终端（已是原始文本，含 ANSI 颜色码）
      term.writeln(line);
    }
  }, [terminalLines]);

  // 追加新片段（逐块流式输出，不换行）
  useEffect(() => {
    const term = terminalRef.current;
    if (!term || terminalChunks.length <= shownFragmentsRef.current) return;

    const newFragments = terminalChunks.slice(shownFragmentsRef.current);
    shownFragmentsRef.current = terminalChunks.length;

    for (const fragment of newFragments) {
      writeChunk(term, fragment); // 清理 Markdown，处理内嵌换行
    }
  }, [terminalChunks]);

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
      if (terminalChunks.length > 0) {
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* 顶部状态栏 */}
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

      {/* xterm 终端区域 */}
      <div
        ref={containerRef}
        style={{
          background: 'var(--term-bg)',
          border: '1px solid var(--term-border)',
          borderTop: 'none',
          padding: 12,
          minHeight: 320,
          transition: 'background 0.3s, border-color 0.3s',
        }}
      />

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
        <span style={{
          color: 'var(--accent)',
          fontFamily: "'JetBrains Mono', monospace",
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
          placeholder={isRunning ? '输入命令后按 Enter...' : '等待 Claude Code 启动...'}
          disabled={!isRunning && !isStarting}
          style={{
            flex: 1,
            padding: '10px 8px',
            fontSize: 12,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            background: 'transparent',
            color: isRunning ? 'var(--text-primary)' : 'var(--text-muted)',
            border: 'none',
            outline: 'none',
            cursor: isRunning ? 'text' : 'not-allowed',
          }}
        />
      </div>
    </div>
  );
}
