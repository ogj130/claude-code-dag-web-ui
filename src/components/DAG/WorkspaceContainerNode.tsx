import type { NodeProps } from '@xyflow/react';

export const WORKSPACE_CONTAINER_NODE_TYPE = 'workspaceContainer';

export interface WorkspaceContainerData {
  workspaceId: string;
  workspaceName: string;
  collapsed?: boolean;
  status?: 'idle' | 'running' | 'completed' | 'error';
  onToggleCollapse?: (workspaceId: string) => void;
}

function getStatusColor(status?: string): string {
  switch (status) {
    case 'running': return '#2ecc71';
    case 'completed': return '#666';
    case 'error': return '#e74c3c';
    default: return '#4a8eff';
  }
}

function getStatusIcon(status?: string): string {
  switch (status) {
    case 'running': return '●';
    case 'completed': return '✓';
    case 'error': return '✗';
    default: return '○';
  }
}

export function WorkspaceContainerNode({ data }: NodeProps) {
  const d = data as unknown as WorkspaceContainerData;

  return (
    <div style={{
      background: 'rgba(20, 20, 35, 0.95)',
      border: `1px solid ${getStatusColor(d.status)}`,
      borderRadius: 10,
      minWidth: 280,
      boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      overflow: 'hidden',
    }}>
      {/* 标题栏 */}
      <div style={{
        padding: '8px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(255,255,255,0.03)',
      }}>
        <span style={{ color: getStatusColor(d.status), fontSize: 10, fontFamily: 'monospace' }}>
          {getStatusIcon(d.status)}
        </span>
        <span style={{
          color: '#c0c0c0',
          fontSize: 12,
          fontWeight: 600,
          fontFamily: "'JetBrains Mono', monospace",
          flex: 1,
        }}>
          {d.workspaceName}
        </span>
        <button
          onClick={() => d.onToggleCollapse?.(d.workspaceId)}
          style={{
            background: 'none',
            border: 'none',
            color: '#555',
            cursor: 'pointer',
            fontSize: 10,
            padding: '2px 4px',
          }}
          aria-label={d.collapsed ? '展开' : '折叠'}
        >
          {d.collapsed ? '▼' : '▲'}
        </button>
      </div>
      {/* 子节点区域（由 ReactFlow parentId 自动渲染） */}
      {!d.collapsed && (
        <div style={{ padding: '12px 8px', minHeight: 60 }}>
          {/* 子节点由 ReactFlow 根据 parentId 自动定位和渲染 */}
        </div>
      )}
    </div>
  );
}
