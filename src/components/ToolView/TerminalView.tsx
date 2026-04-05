import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { useTaskStore } from '../../stores/useTaskStore';

interface Props {
  theme: 'dark' | 'light';
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

export function TerminalView({ theme }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const { terminalLines } = useTaskStore();

  // 初始化 terminal
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

    term.writeln('\x1b[2m$ claude "分析代码库"\x1b[0m');
    term.writeln('\x1b[90m正在启动 Claude Agent...\x1b[0m');

    return () => {
      term.dispose();
      terminalRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 主题切换时更新 xterm 配色
  useEffect(() => {
    if (terminalRef.current) {
    terminalRef.current.options.theme = getXtermTheme(theme === 'dark');
    }
  }, [theme]);

  // 追加新行
  useEffect(() => {
    const term = terminalRef.current;
    if (!term || terminalLines.length === 0) return;

    const lastLine = terminalLines[terminalLines.length - 1];
    if (lastLine) {
      try {
        const parsed = JSON.parse(lastLine);
        term.writeln(`\x1b[36m››› ${parsed.event?.type ?? 'unknown'}\x1b[0m`);
      } catch {
        term.writeln(lastLine);
      }
    }
  }, [terminalLines]);

  return (
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
  );
}
