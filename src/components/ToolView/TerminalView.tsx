import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { useTaskStore } from '../../stores/useTaskStore';

export function TerminalView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const { terminalLines } = useTaskStore();

  useEffect(() => {
    if (!containerRef.current || terminalRef.current) return;

    const term = new Terminal({
      theme: {
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
      },
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
  }, []);

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
