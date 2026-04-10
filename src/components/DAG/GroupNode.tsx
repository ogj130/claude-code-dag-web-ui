import React, { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';

interface GroupNodeData {
  type: string;
  label?: string;  // 工具类型名称（如 Bash, Read）
  count: number;
  nodeIds: string[];
  queryId?: string;
  onToggleGroup?: (groupId: string) => void;
  isExpanded?: boolean;
  [key: string]: unknown;
}

interface GroupNodeProps {
  data: GroupNodeData;
}

// 工具类型对应的强调色
const TOOL_ACCENT_COLORS: Record<string, string> = {
  Bash: 'var(--accent)',
  Read: 'var(--success)',
  Edit: 'var(--warn)',
  Search: '#a78bfa',
  Write: '#f472b6',
  Grep: '#fb923c',
};

function getAccentColor(label: string): string {
  return TOOL_ACCENT_COLORS[label] ?? 'var(--accent)';
}

function GroupNodeInner({ data }: GroupNodeProps) {
  const [isHovered, setIsHovered] = useState(false);
  const isExpanded = data.isExpanded ?? false;
  const toolTypeLabel = data.label || '工具';
  const accentColor = getAccentColor(toolTypeLabel);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.onToggleGroup) {
      data.onToggleGroup(data.nodeIds[0] ? `group_${data.queryId}_${toolTypeLabel}` : '');
    }
  };

  // 展开状态：带 header 的分组容器
  if (isExpanded) {
    return (
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          background: 'transparent',
          border: `1px solid ${isHovered ? accentColor + '55' : 'transparent'}`,
          borderRadius: 10,
          transition: 'border-color 0.2s ease',
          boxShadow: isHovered ? `0 0 0 1px ${accentColor}22` : 'none',
          overflow: 'hidden',
        }}
        onClick={handleToggle}
      >
        {/* 左侧色条 */}
        <div style={{
          position: 'absolute',
          left: 0, top: 0, bottom: 0,
          width: 3,
          background: accentColor,
          borderRadius: '10px 0 0 10px',
        }} />

        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 14px 6px 16px',
          borderBottom: `1px solid ${isHovered ? accentColor + '22' : 'var(--dag-node-border)'}`,
          background: 'transparent',
          transition: 'border-color 0.2s ease',
          cursor: 'pointer',
        }}>
          {/* 工具类型图标 */}
          <div style={{ color: accentColor, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
          </div>

          {/* 工具名称 */}
          <span style={{
            fontSize: 12,
            fontWeight: 600,
            color: accentColor,
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: 0.3,
          }}>
            {toolTypeLabel}
          </span>

          {/* 数量标签 */}
          <span style={{
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--text-dim)',
            fontFamily: "'JetBrains Mono', monospace",
            background: 'var(--dag-node)',
            padding: '1px 6px',
            borderRadius: 8,
          }}>
            {data.count} 个
          </span>

          {/* 折叠按钮 */}
          <div
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              cursor: 'pointer',
              padding: '3px 8px',
              borderRadius: 6,
              background: 'var(--dag-node)',
              border: '1px solid var(--dag-node-border)',
              transition: 'background 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = accentColor + '22';
              e.currentTarget.style.borderColor = accentColor + '88';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'var(--dag-node)';
              e.currentTarget.style.borderColor = 'var(--dag-node-border)';
            }}
            onClick={handleToggle}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill={accentColor}>
              <path d="M7 10l5 5 5-5z"/>
            </svg>
            <span style={{
              fontSize: 10,
              color: 'var(--text-dim)',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              折叠
            </span>
          </div>
        </div>

        {/* 子节点渲染区（通过 ReactFlow parent 定位） */}
        {/* 工具节点位置由 DAGCanvas 布局计算 */}
      </div>
    );
  }

  // 折叠状态：紧凑分组卡片，与展开态语言统一
  return (
    <div
      style={{
        background: 'var(--dag-node)',
        border: '1px solid',
        borderColor: isHovered ? accentColor + '88' : 'var(--dag-node-border)',
        borderRadius: 10,
        padding: '8px 10px 8px 12px',
        position: 'relative',
        minWidth: 148,
        textAlign: 'left',
        boxShadow: isHovered
          ? `0 0 0 1px ${accentColor}22, 0 6px 18px rgba(0,0,0,0.22)`
          : '0 2px 8px rgba(0,0,0,0.12)',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease',
        cursor: 'pointer',
        transform: isHovered ? 'translateY(-1px)' : 'translateY(0)',
        overflow: 'hidden',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleToggle}
    >
      {/* 左侧色条 */}
      <div style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 3,
        background: accentColor,
      }} />

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        minHeight: 24,
      }}>
        {/* 工具图标 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: accentColor,
          flexShrink: 0,
          width: 16,
          height: 16,
          marginLeft: 2,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        </div>

        {/* 标题区 */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          flex: 1,
          gap: 2,
        }}>
          <div style={{
            color: 'var(--text-primary)',
            fontWeight: 600,
            fontSize: 12,
            fontFamily: "'JetBrains Mono', monospace",
            lineHeight: 1.1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {toolTypeLabel}
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <span style={{
              fontSize: 10,
              color: 'var(--text-dim)',
              fontFamily: 'monospace',
            }}>
              工具分组
            </span>
            <span style={{
              fontSize: 10,
              fontWeight: 600,
              color: accentColor,
              fontFamily: "'JetBrains Mono', monospace",
              background: accentColor + '18',
              border: `1px solid ${accentColor}33`,
              padding: '1px 6px',
              borderRadius: 999,
              lineHeight: 1.2,
            }}>
              {data.count} 个
            </span>
          </div>
        </div>

        {/* 右侧展开动作 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            flexShrink: 0,
            padding: '3px 6px',
            borderRadius: 6,
            background: isHovered ? accentColor + '14' : 'transparent',
            border: `1px solid ${isHovered ? accentColor + '33' : 'transparent'}`,
            transition: 'background 0.2s ease, border-color 0.2s ease',
          }}
          onClick={handleToggle}
        >
          <span style={{
            fontSize: 10,
            color: isHovered ? accentColor : 'var(--text-dim)',
            fontFamily: 'monospace',
            transition: 'color 0.2s ease',
          }}>
            展开
          </span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill={accentColor}>
            <path d="M10 17l5-5-5-5z"/>
          </svg>
        </div>
      </div>

      <Handle type="target" position={Position.Top} style={{ background: accentColor }} />
      <Handle type="source" position={Position.Bottom} style={{ background: accentColor }} />
    </div>
  );
}

export const GroupNodeComponent = memo(GroupNodeInner);
GroupNodeComponent.displayName = 'GroupNodeComponent';
