import React, { useState } from 'react';
import { useTaskStore } from '../../stores/useTaskStore';

const TOOL_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  bash:   { bg: 'var(--success-bg)',  color: 'var(--success)', border: 'var(--success-border)' },
  read:   { bg: '#e8f4fd',           color: '#3498db',       border: '#c0dff5' },
  write:  { bg: 'var(--warn-bg)',     color: 'var(--warn)',    border: 'var(--warn-border)' },
  edit:   { bg: '#f3e8ff',            color: '#9055db',       border: '#e0c8f8' },
  grep:   { bg: '#e8f7e0',           color: '#5a9e20',       border: '#c8e8a0' },
  agent:  { bg: 'var(--warn-bg)',    color: '#ff8c40',      border: 'var(--warn-border)' },
};

function getToolStyle(tool: string) {
  return TOOL_COLORS[tool.toLowerCase()] ?? {
    bg: 'var(--pending-bg)',
    color: 'var(--pending)',
    border: 'var(--pending-border)',
  };
}

export function ToolCards() {
  const { toolCalls } = useTaskStore();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const reversed = [...toolCalls].reverse();

  if (reversed.length === 0) {
    return (
      <div style={{ color: 'var(--text-dim)', fontSize: 12, textAlign: 'center', marginTop: 40 }}>
        暂无工具调用记录
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {reversed.map(tool => {
        const isExpanded = expanded.has(tool.id);
        const s = getToolStyle(tool.tool);
        const duration = tool.endTime
          ? `${((tool.endTime - tool.startTime) / 1000).toFixed(1)}s`
          : '';

        return (
          <div
            key={tool.id}
            onClick={() => toggle(tool.id)}
            style={{
              background: 'var(--bg-card)',
              border: `1px solid ${isExpanded ? 'var(--border-hover)' : 'var(--border-card)'}`,
              borderRadius: 8, padding: '10px 12px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{
                padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                fontFamily: 'monospace',
                background: s.bg, color: s.color, border: `1px solid ${s.border}`,
              }}>
                {tool.tool.toUpperCase()}
              </span>
              <span style={{ color: 'var(--text-primary)', fontSize: 12 }}>
                {String(tool.args?.raw ?? tool.tool)}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 'auto', fontFamily: 'monospace' }}>
                {tool.status === 'running' ? `⟳ ${duration || '0.0s'}` : duration}
              </span>
            </div>
            {isExpanded && tool.result && (
              <div style={{
                marginTop: 8, background: 'var(--bg-root)',
                padding: '4px 8px', borderRadius: 4,
                fontSize: 10, fontFamily: 'monospace',
                color: tool.status === 'error' ? 'var(--error)' : 'var(--success)',
                wordBreak: 'break-all',
              }}>
                {tool.result}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
