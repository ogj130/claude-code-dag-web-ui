import { useState } from 'react';
import { useTaskStore } from '../../stores/useTaskStore';
import { ToolIcon, ChevronRightIcon, InboxIcon } from '../Icons';

// ── formatToolArgs ────────────────────────────────────────────────────────────
/** 格式化工具参数为可读预览字符串 */
function formatToolArgs(tool: string, args: Record<string, unknown> | null): { summary: string; detail: React.ReactNode } {
  if (!args) return { summary: '无参数', detail: null };

  switch (tool) {
    case 'read': {
      const file = String(args.file ?? '');
      const offset = args.offset != null ? String(args.offset) : '';
      const limit = args.limit != null ? String(args.limit) : '';
      const preview = file.split('/').pop() ?? file;
      return {
        summary: preview,
        detail: (
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
            {file && <div>path: <span style={{ color: 'var(--text-secondary)' }}>{file}</span></div>}
            {offset && <div>offset: <span style={{ color: 'var(--text-secondary)' }}>{offset}</span></div>}
            {limit && <div>limit: <span style={{ color: 'var(--text-secondary)' }}>{limit}</span></div>}
          </div>
        ),
      };
    }
    case 'Write':
    case 'Edit':
    case 'NotebookEdit': {
      const file = String(args.file ?? '');
      const preview = file.split('/').pop() ?? file;
      return {
        summary: preview,
        detail: (
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
            {file && <div>path: <span style={{ color: 'var(--text-secondary)' }}>{file}</span></div>}
            {args.content != null && (
              <div style={{ color: 'var(--text-dim)', fontSize: 10, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {String(args.content).slice(0, 60)}...
              </div>
            )}
          </div>
        ),
      };
    }
    case 'Bash': {
      const cmd = String(args.command ?? args.cmd ?? '');
      const preview = cmd.length > 28 ? cmd.slice(0, 28) + '…' : cmd;
      return {
        summary: preview,
        detail: (
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
              {cmd}
            </div>
          </div>
        ),
      };
    }
    case 'Grep':
    case 'WebSearch':
    case 'WebFetch': {
      const query = String(args.query ?? args.url ?? args.pattern ?? JSON.stringify(args));
      const preview = query.length > 28 ? query.slice(0, 28) + '…' : query;
      return {
        summary: preview,
        detail: (
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
            <div style={{ wordBreak: 'break-all', color: 'var(--text-secondary)' }}>{query}</div>
          </div>
        ),
      };
    }
    default:
      return {
        summary: Object.keys(args).slice(0, 2).map(k => `${k}=${JSON.stringify(args[k]).slice(0, 20)}`).join(', '),
        detail: (
          <pre style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4, overflow: 'auto', maxHeight: 80 }}>
            {JSON.stringify(args, null, 2)}
          </pre>
        ),
      };
  }
}

const STATUS_CONFIG = {
  running:   { label: '运行中', dot: 'var(--warn)',      glow: 'rgba(241,196,15,0.15)' },
  completed: { label: '完成',   dot: 'var(--success)',    glow: 'rgba(46,204,113,0.08)' },
  error:     { label: '失败',   dot: 'var(--error)',      glow: 'rgba(231,76,60,0.08)'  },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.running;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: '2px 8px', borderRadius: 20,
      fontSize: 10, fontFamily: 'monospace', fontWeight: 500,
      background: cfg.glow,
      color: cfg.dot,
      border: `1px solid ${cfg.dot}30`,
      transition: 'all 0.3s',
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: '50%',
        background: cfg.dot,
        flexShrink: 0,
        boxShadow: `0 0 4px ${cfg.dot}`,
        animation: status === 'running' ? 'pulse-dot 1.2s ease-in-out infinite' : 'none',
      }} />
      {cfg.label}
    </div>
  );
}

function ToolCard({ tool, index }: { tool: ReturnType<typeof useTaskStore.getState>['toolCalls'][0]; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const [argsExpanded, setArgsExpanded] = useState(false);
  const isError = tool.status === 'error';
  const duration = tool.endTime ? `${((tool.endTime - tool.startTime) / 1000).toFixed(1)}s` : '';
  const { summary, detail } = formatToolArgs(tool.tool, tool.args ?? null);

  return (
    <div
      onClick={() => setExpanded(p => !p)}
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${expanded ? 'var(--border-hover)' : 'var(--border-card)'}`,
        borderRadius: 10,
        padding: '12px 14px',
        cursor: 'pointer',
        transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.15s',
        animation: `card-in 0.3s ease-out ${index * 40}ms both`,
        transform: expanded ? 'scale(1.01)' : 'scale(1)',
        boxShadow: expanded
          ? '0 4px 20px rgba(0,0,0,0.3), 0 0 0 1px var(--border-hover)'
          : '0 1px 4px rgba(0,0,0,0.2)',
      }}
    >
      {/* 主行 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* 工具图标 */}
        <div style={{
          width: 28, height: 28, borderRadius: 7,
          background: 'var(--bg-input)',
          border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-secondary)',
          flexShrink: 0,
        }}>
          <ToolIcon tool={tool.tool} size={13} />
        </div>

        {/* 工具名 + 参数 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontSize: 11, fontFamily: 'monospace', fontWeight: 700,
              color: 'var(--text-secondary)', letterSpacing: '0.05em',
            }}>
              {tool.tool.toUpperCase()}
            </span>
            <StatusBadge status={tool.status} />
          </div>
          <div style={{
            fontSize: 11, color: 'var(--text-muted)',
            fontFamily: 'monospace', marginTop: 2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {String(tool.args?.raw ?? tool.tool)}
          </div>
        </div>

        {/* 耗时 + 展开箭头 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {duration && (
            <span style={{
              fontSize: 10, color: 'var(--text-dim)',
              fontFamily: 'monospace',
            }}>
              {duration}
            </span>
          )}
          <div style={{
            color: 'var(--text-dim)',
            transition: 'transform 0.2s',
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            display: 'flex',
          }}>
            <ChevronRightIcon size={12} />
          </div>
        </div>
      </div>

      {/* Arguments summary row — only visible when card is expanded */}
      {expanded && (
        <div
          onClick={e => { e.stopPropagation(); setArgsExpanded(p => !p); }}
          style={{
            marginTop: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          {/* Args label */}
          <span style={{
            fontSize: 9, fontFamily: 'monospace', fontWeight: 600,
            color: 'var(--accent-dim)',
            letterSpacing: '0.08em',
            flexShrink: 0,
          }}>
            ARGS
          </span>
          {/* Preview text */}
          <span style={{
            fontSize: 10, color: 'var(--text-dim)',
            fontFamily: "'JetBrains Mono', monospace",
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            flex: 1,
          }}>
            {summary}
          </span>
          {/* Chevron toggle */}
          <div style={{
            color: 'var(--text-dim)',
            transition: 'transform 200ms ease-out',
            transform: argsExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
            display: 'flex',
            flexShrink: 0,
          }}>
            <ChevronRightIcon size={10} />
          </div>
        </div>
      )}

      {/* Arguments detail — only visible when card expanded AND argsExpanded */}
      {expanded && argsExpanded && detail && (
        <div style={{
          marginTop: 6,
          marginLeft: 16,
          borderLeft: '2px solid var(--accent-dim)',
          paddingLeft: 8,
          animation: 'fade-in 0.15s ease-out',
        }}>
          {detail}
        </div>
      )}

      {/* 展开结果 */}
      {expanded && tool.result && (
        <div style={{
          marginTop: 10,
          background: isError ? 'var(--error-bg)' : 'var(--bg-input)',
          border: `1px solid ${isError ? 'var(--error-border)' : 'var(--border)'}`,
          borderRadius: 7, padding: '8px 10px',
          fontSize: 11, fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          color: isError ? 'var(--error)' : 'var(--text-secondary)',
          lineHeight: 1.6,
          animation: 'fade-in 0.2s ease-out',
          maxHeight: 200, overflowY: 'auto',
        }}>
          {tool.result}
        </div>
      )}
    </div>
  );
}

export function ToolCards() {
  const { toolCalls } = useTaskStore();

  if (toolCalls.length === 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', paddingTop: 48,
        animation: 'fade-in 0.4s ease-out',
      }}>
        <div style={{ color: 'var(--border)', marginBottom: 12 }}>
          <InboxIcon size={36} />
        </div>
        <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: 0 }}>
          暂无工具调用记录
        </p>
        <p style={{ color: 'var(--text-dim)', fontSize: 11, margin: '4px 0 0', opacity: 0.6 }}>
          Claude 执行工具时会显示在这里
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {[...toolCalls].reverse().map((tool, i) => (
        <ToolCard key={tool.id} tool={tool} index={i} />
      ))}
    </div>
  );
}
