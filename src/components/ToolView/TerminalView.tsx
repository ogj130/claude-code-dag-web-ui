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
    // 代码块（优先，防止内层规则干扰）
    .replace(/```[\w]*\n([\s\S]*?)```/g, '$1')
    // 行内代码
    .replace(/`([^`]+)`/g, '$1')
    // 粗体 **text** 或 __text__
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/__([^_\n]+)__/g, '$1')
    // 斜体 *text* 或 _text_（但跳过列表标记）
    .replace(/\*(?!\s)([^*\n]+)\*/g, '$1')
    .replace(/_(?![\s-])([^_\n]+)_/g, '$1')
    // 删除线 ~~text~~
    .replace(/~~([^~\n]+)~~/g, '$1')
    // 标题 ### text → » text
    .replace(/^#{1,3}\s+/gm, '» ')
    // 水平线
    .replace(/^[-*_]{3,}$/gm, '')
    // > 引用 → | 引用
    .replace(/^>\s?/gm, '| ')
    // 列表标记规范化
    .replace(/^(\s*)[-*+]\s+/gm, '$1• ')
    .replace(/^(\s*)\d+\.\s+/gm, '$1')
    // 链接 [text](url) → text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}

/** 写入一个文本片段：处理内嵌换行 + Markdown 清理 */
function writeChunk(term: Terminal, raw: string): void {
  const text = stripMarkdown(raw);
  const parts = text.split('\n');
  for (let i = 0; i < parts.length; i++) {
    term.write(parts[i]);
    if (i < parts.length - 1) {
      term.write('\n'); // 每个换行符拆成独立的 write
    }
  }
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
  const { terminalLines, terminalChunks, streamEndPending, clearStreamEnd, isStarting, isRunning, error } = useTaskStore();

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

    term.writeln('\x1b[2m$ claude "分析代码库"\x1b[0m');
    term.writeln('\x1b[90m正在启动 Claude Agent...\x1b[0m');

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

  // 流式回答结束：追加换行，让光标移到新行
  useEffect(() => {
    const term = terminalRef.current;
    if (!term || !streamEndPending) return;
    term.write('\n');
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
      // 回显到终端（换行 + 提示符）
      terminalRef.current?.writeln(`\n\x1b[90m> ${text}\x1b[0m`);
      onInput?.(text);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* xterm 终端区域 */}
      <div
        ref={containerRef}
        style={{
          background: 'var(--term-bg)',
          border: '1px solid var(--term-border)',
          borderRadius: 8,
          padding: 12,
          minHeight: 300,
          transition: 'background 0.3s, border-color 0.3s',
        }}
      />

      {/* 外部输入框（供用户打字提交） */}
      <input
        type="text"
        value={inputValue}
        onChange={e => setInputValue(e.target.value)}
        onKeyDown={handleInputKeyDown}
        placeholder="输入命令后按 Enter..."
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '8px 12px',
          fontSize: 12,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          background: 'var(--bg-card)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          outline: 'none',
          transition: 'border-color 0.2s',
        }}
        onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
        onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
      />
    </div>
  );
}
