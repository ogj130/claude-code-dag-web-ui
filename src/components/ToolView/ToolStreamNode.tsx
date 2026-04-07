import { memo } from 'react';
import type { ToolCall } from '../../types/events';

interface Props {
  toolCall: ToolCall;
  progress: string;   // 累积的 progress 文本
  isRunning: boolean; // 该工具是否仍在 running（用于决定是否显示动画）
}

const STATUS_COLOR = {
  pending: 'var(--text-dim)',
  running: 'var(--accent)',
  completed: 'var(--success)',
  error: 'var(--error)',
};

const STATUS_LABEL = {
  pending: '等待',
  running: '进行中...',
  completed: '完成',
  error: '失败',
};

/** 格式化工具参数为一行摘要 */
function formatArgs(tool: string, args: Record<string, unknown> | undefined): string {
  if (!args || Object.keys(args).length === 0) return '';
  switch (tool) {
    case 'read': {
      const f = String(args.file ?? '');
      return f ? `path: ${f.split('/').pop() ?? f}` : '';
    }
    case 'Write':
    case 'Edit':
    case 'NotebookEdit': {
      const f = String(args.file ?? '');
      return f ? `path: ${f.split('/').pop() ?? f}` : '';
    }
    case 'Bash': {
      const cmd = String(args.command ?? args.cmd ?? '');
      return cmd.length > 40 ? cmd.slice(0, 40) + '…' : cmd;
    }
    case 'Grep':
    case 'WebSearch':
    case 'WebFetch': {
      const q = String(args.query ?? args.url ?? args.pattern ?? '');
      return q.length > 40 ? q.slice(0, 40) + '…' : q;
    }
    default: {
      const k = Object.keys(args).slice(0, 2);
      return k.map(key => `${key}=${String(args[key]).slice(0, 20)}`).join(', ');
    }
  }
}

/** 格式化执行时长 */
function formatDuration(start: number, end: number | undefined): string {
  if (!end) return '';
  const ms = end - start;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function ToolStreamNodeInner({ toolCall, progress, isRunning }: Props) {
  const { tool, args, status, startTime, endTime } = toolCall;
  const color = STATUS_COLOR[status] ?? 'var(--text-dim)';
  const label = STATUS_LABEL[status] ?? status;
  const argsSummary = formatArgs(tool, args);
  const duration = formatDuration(startTime, endTime);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      padding: '4px 0',
      minHeight: 28,
    }}>
      {/* 主行：图标 + 工具名 + 参数 + 状态 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
        lineHeight: 1.5,
      }}>
        {/* 状态图标 */}
        <div style={{ width: 14, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {status === 'running' && isRunning ? (
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              border: `1.5px solid ${color}`,
              borderTopColor: 'transparent',
              animation: 'tool-spin 0.8s linear infinite',
            }} />
          ) : status === 'completed' ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : status === 'error' ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, opacity: 0.5 }} />
          )}
        </div>

        {/* 工具名 */}
        <span style={{ color, fontWeight: 600, flexShrink: 0, minWidth: 56, textAlign: 'right' }}>
          {tool}
        </span>

        {/* 分隔符 */}
        <span style={{ color: 'var(--border)', flexShrink: 0 }}>·</span>

        {/* 参数摘要 */}
        {argsSummary && (
          <span style={{ color: 'var(--text-dim)', fontSize: 10, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {argsSummary}
          </span>
        )}

        {/* 状态/时长 */}
        <span style={{
          color,
          fontSize: 10,
          flexShrink: 0,
          fontWeight: status === 'running' ? 400 : 600,
        }}>
          {status === 'completed' ? `${duration}`
            : status === 'error' ? `[${label}]`
            : `[${label}]`}
        </span>
      </div>

      {/* Progress 追加行（running 状态下） */}
      {status === 'running' && progress && (
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          color: 'var(--text-dim)',
          paddingLeft: 20,
          marginTop: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          opacity: 0.75,
        }}>
          {progress}
        </div>
      )}
    </div>
  );
}

function propsAreEqual(prev: Props, next: Props): boolean {
  return (
    prev.toolCall.id === next.toolCall.id &&
    prev.toolCall.status === next.toolCall.status &&
    prev.toolCall.endTime === next.toolCall.endTime &&
    prev.progress === next.progress &&
    prev.isRunning === next.isRunning
  );
}

export const ToolStreamNode = memo(ToolStreamNodeInner, propsAreEqual);
