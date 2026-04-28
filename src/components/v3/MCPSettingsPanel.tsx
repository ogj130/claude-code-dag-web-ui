/**
 * MCPSettingsPanel — MCP 设置面板
 *
 * 添加/编辑/删除/测试 MCP 服务器连接。
 * 展示连接状态和已发现的工具。
 * 所有样式使用内联 style + CSS 变量（本项目未安装 Tailwind CSS）。
 */

import { useState, useEffect, useCallback } from 'react';
import {
  listServers,
  addServer,
  removeServer,
  testConnection,
  discoverTools,
  getAllTools,
  onStatusChange,
  type MCPServerState,
  type MCPConnectionStatus,
  type MCPTool,
} from '../../services/mcpConfigStore';

// ── 状态样式 ────────────────────────────────────────────────

const STATUS_STYLES: Record<MCPConnectionStatus, { icon: string; color: string; label: string }> = {
  connected: { icon: '●', color: '#34D399', label: '已连接' },
  disconnected: { icon: '○', color: '#64748B', label: '未连接' },
  connecting: { icon: '◌', color: '#60A5FA', label: '连接中...' },
  error: { icon: '✗', color: '#F87171', label: '错误' },
};

// ── 服务器卡片 ──────────────────────────────────────────────

function ServerCard({
  state,
  onTest,
  onDiscover,
  onEdit,
  onRemove,
}: {
  state: MCPServerState;
  onTest: () => void;
  onDiscover: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const statusStyle = STATUS_STYLES[state.status];
  const [isTesting, setIsTesting] = useState(false);

  const handleTest = useCallback(async () => {
    setIsTesting(true);
    await onTest();
    setIsTesting(false);
  }, [onTest]);

  return (
    <div style={{
      padding: 12,
      borderRadius: 8,
      border: '1px solid rgba(148, 163, 184, 0.12)',
      background: 'rgba(30, 41, 59, 0.5)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: statusStyle.color, fontSize: 12 }}>{statusStyle.icon}</span>
          <span style={{ fontSize: 12, fontWeight: 500, color: '#CBD5E1' }}>{state.config.name}</span>
          <span style={{
            fontSize: 10,
            padding: '1px 6px',
            borderRadius: 4,
            background: state.config.enabled ? 'rgba(52, 211, 153, 0.1)' : 'rgba(107, 114, 128, 0.1)',
            color: state.config.enabled ? '#34D399' : '#6B7280',
          }}>
            {state.config.enabled ? '启用' : '禁用'}
          </span>
        </div>
        <span style={{ fontSize: 10, color: statusStyle.color }}>{statusStyle.label}</span>
      </div>

      <div style={{
        fontSize: 10,
        fontFamily: '"JetBrains Mono", monospace',
        color: '#64748B',
        marginBottom: 8,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {state.config.command} {(state.config.args ?? []).join(' ')}
      </div>

      {state.lastError && state.status === 'error' && (
        <div style={{
          fontSize: 10,
          color: '#F87171',
          marginBottom: 8,
        }}>
          ✗ {state.lastError}
        </div>
      )}

      {/* 已发现工具 */}
      {state.tools.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: '#64748B', marginBottom: 4 }}>
            工具 ({state.tools.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {state.tools.map((tool) => (
              <span key={tool.name} style={{
                fontSize: 10,
                padding: '1px 6px',
                borderRadius: 4,
                background: 'rgba(96, 165, 250, 0.1)',
                color: '#60A5FA',
                border: '1px solid rgba(96, 165, 250, 0.2)',
              }}>
                {tool.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <HoverButton
          bg="rgba(59, 130, 246, 0.15)"
          hoverBg="rgba(59, 130, 246, 0.25)"
          color="#60A5FA"
          border="rgba(59, 130, 246, 0.25)"
          disabled={isTesting}
          onClick={handleTest}
        >
          {isTesting ? '测试中...' : '测试连接'}
        </HoverButton>
        <HoverButton
          bg="rgba(168, 85, 247, 0.15)"
          hoverBg="rgba(168, 85, 247, 0.25)"
          color="#A78BFA"
          border="rgba(168, 85, 247, 0.25)"
          onClick={onDiscover}
        >
          发现工具
        </HoverButton>
        <HoverButton
          bg="rgba(148, 163, 184, 0.07)"
          hoverBg="rgba(148, 163, 184, 0.15)"
          color="#94A3B8"
          border="transparent"
          onClick={onEdit}
        >
          编辑
        </HoverButton>
        <HoverButton
          bg="rgba(248, 113, 113, 0.1)"
          hoverBg="rgba(248, 113, 113, 0.2)"
          color="#F87171"
          border="transparent"
          onClick={onRemove}
        >
          删除
        </HoverButton>
      </div>
    </div>
  );
}

// ── 可复用悬停按钮 ──────────────────────────────────────────

function HoverButton({
  children,
  onClick,
  disabled,
  bg,
  hoverBg,
  color,
  border,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  bg: string;
  hoverBg: string;
  color: string;
  border: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        fontSize: 10,
        padding: '4px 8px',
        borderRadius: 6,
        background: bg,
        color: color,
        border: `1px solid ${border}`,
        cursor: disabled ? 'default' : 'pointer',
        fontFamily: 'inherit',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s ease-out',
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = hoverBg; }}
      onMouseLeave={e => { e.currentTarget.style.background = bg; }}
    >
      {children}
    </button>
  );
}

// ── 添加表单 ────────────────────────────────────────────────

function AddServerForm({ onAdd, onCancel }: { onAdd: (name: string, command: string) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [command, setCommand] = useState('');

  return (
    <div style={{
      padding: 12,
      borderRadius: 8,
      border: '1px solid rgba(59, 130, 246, 0.3)',
      background: 'rgba(59, 130, 246, 0.05)',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <h4 style={{ margin: 0, fontSize: 12, fontWeight: 500, color: '#93C5FD' }}>添加 MCP 服务器</h4>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="名称"
        style={{
          width: '100%',
          fontSize: 12,
          padding: '6px 8px',
          borderRadius: 6,
          background: '#1E293B',
          border: '1px solid rgba(148, 163, 184, 0.12)',
          color: '#CBD5E1',
          fontFamily: 'inherit',
          outline: 'none',
          boxSizing: 'border-box',
        }}
        onFocus={e => e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.4)'}
        onBlur={e => e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.12)'}
      />
      <input
        type="text"
        value={command}
        onChange={(e) => setCommand(e.target.value)}
        placeholder="命令 (e.g. npx @modelcontextprotocol/server-filesystem)"
        style={{
          width: '100%',
          fontSize: 12,
          padding: '6px 8px',
          borderRadius: 6,
          background: '#1E293B',
          border: '1px solid rgba(148, 163, 184, 0.12)',
          color: '#CBD5E1',
          fontFamily: 'inherit',
          outline: 'none',
          boxSizing: 'border-box',
        }}
        onFocus={e => e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.4)'}
        onBlur={e => e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.12)'}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={() => { if (name && command) onAdd(name, command); }}
          disabled={!name || !command}
          style={{
            fontSize: 12,
            padding: '6px 12px',
            borderRadius: 6,
            background: 'rgba(59, 130, 246, 0.15)',
            color: '#60A5FA',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            cursor: !name || !command ? 'default' : 'pointer',
            fontFamily: 'inherit',
            opacity: !name || !command ? 0.5 : 1,
            transition: 'all 0.15s ease-out',
          }}
          onMouseEnter={e => { if (name && command) e.currentTarget.style.background = 'rgba(59, 130, 246, 0.25)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)'; }}
        >
          添加
        </button>
        <button
          onClick={onCancel}
          style={{
            fontSize: 12,
            padding: '6px 12px',
            borderRadius: 6,
            background: 'rgba(148, 163, 184, 0.07)',
            color: '#94A3B8',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'all 0.15s ease-out',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(148, 163, 184, 0.15)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(148, 163, 184, 0.07)'; }}
        >
          取消
        </button>
      </div>
    </div>
  );
}

// ── 主组件 ──────────────────────────────────────────────────

export interface MCPSettingsPanelProps {
  className?: string;
}

export default function MCPSettingsPanel({}: MCPSettingsPanelProps) {
  const [servers, setServers] = useState<MCPServerState[]>(listServers());
  const [allTools, setAllTools] = useState<MCPTool[]>(getAllTools());
  const [showAdd, setShowAdd] = useState(false);

  const refresh = useCallback(() => {
    setServers(listServers());
    setAllTools(getAllTools());
  }, []);

  useEffect(() => {
    const unsub = onStatusChange(() => refresh());
    return unsub;
  }, [refresh]);

  const handleAdd = useCallback((name: string, command: string) => {
    addServer({ name, command });
    setShowAdd(false);
    refresh();
  }, [refresh]);

  const handleRemove = useCallback((id: string) => {
    removeServer(id);
    refresh();
  }, [refresh]);

  const handleTest = useCallback(async (id: string) => {
    await testConnection(id);
    refresh();
  }, [refresh]);

  const handleDiscover = useCallback(async (id: string) => {
    await discoverTools(id);
    refresh();
  }, [refresh]);

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 500, color: '#CBD5E1' }}>MCP 服务器</h3>
        <HoverButton
          bg="rgba(59, 130, 246, 0.15)"
          hoverBg="rgba(59, 130, 246, 0.25)"
          color="#60A5FA"
          border="rgba(59, 130, 246, 0.25)"
          onClick={() => setShowAdd(!showAdd)}
        >
          + 添加
        </HoverButton>
      </div>

      {/* 工具总览 */}
      {allTools.length > 0 && (
        <div style={{
          marginBottom: 12,
          padding: 8,
          borderRadius: 6,
          background: 'rgba(30, 41, 59, 0.3)',
        }}>
          <div style={{ fontSize: 10, color: '#64748B', marginBottom: 4 }}>
            已注册工具 ({allTools.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {allTools.map((tool) => (
              <span key={tool.name} style={{
                fontSize: 10,
                padding: '1px 6px',
                borderRadius: 4,
                background: 'rgba(168, 85, 247, 0.1)',
                color: '#A78BFA',
                border: '1px solid rgba(168, 85, 247, 0.2)',
              }}>
                {tool.name} <span style={{ color: '#64748B' }}>({tool.serverName})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 添加表单 */}
      {showAdd && (
        <div style={{ marginBottom: 12 }}>
          <AddServerForm onAdd={handleAdd} onCancel={() => setShowAdd(false)} />
        </div>
      )}

      {/* 服务器列表 */}
      {servers.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#64748B', fontSize: 12, padding: '32px 0' }}>
          暂无 MCP 服务器配置
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {servers.map((state) => (
            <ServerCard
              key={state.config.id}
              state={state}
              onTest={() => handleTest(state.config.id)}
              onDiscover={() => handleDiscover(state.config.id)}
              onEdit={() => {}}
              onRemove={() => handleRemove(state.config.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
