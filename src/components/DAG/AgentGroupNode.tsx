/**
 * V3.0 — Enhanced AgentGroupNode Component
 * Agent 分组卡片：类型标签 + 状态颜色 + 进度条 + taskDescription +
 * 元数据行 + 内部子流程步骤展示（工具调用）+ 详情弹窗
 */

import React, { memo, useCallback, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { DAGNode } from '../../types/events';
import { useTaskStore } from '../../stores/useTaskStore';

// Agent 类型配色（年轻化：更鲜艳的区分色）
const AGENT_TYPE_COLORS: Record<string, { border: string; bg: string; text: string; accent: string }> = {
  context:   { border: '#5c9cff', bg: 'rgba(92,156,255,0.08)', text: '#a8d0ff', accent: '#5c9cff' },
  planning:  { border: '#f5b842', bg: 'rgba(245,184,66,0.08)', text: '#fdd888', accent: '#f5b842' },
  execution: { border: '#3dd68c', bg: 'rgba(61,214,140,0.08)', text: '#80f0b8', accent: '#3dd68c' },
  review:    { border: '#9b6cff', bg: 'rgba(155,108,255,0.08)', text: '#d0c0ff', accent: '#9b6cff' },
  default:   { border: '#6e7198', bg: 'rgba(110,113,152,0.06)', text: '#a8abc8', accent: '#6e7198' },
};

// 语义状态颜色 — 使用 CSS 变量确保主题一致性
function getStatusStyle(status: string) {
  const styles: Record<string, { border: string; bg: string; glow: string; icon: string }> = {
    completed: {
      border: 'var(--success)',
      bg: 'var(--success-bg)',
      glow: 'none',
      icon: '\u2713'
    },
    running: {
      border: 'var(--accent)',
      bg: 'rgba(92, 140, 255, 0.10)',
      glow: '0 0 16px var(--accent-glow)',
      icon: '\u23F3'
    },
    failed: {
      border: 'var(--error)',
      bg: 'var(--error-bg)',
      glow: '0 0 12px rgba(240, 96, 112, 0.2)',
      icon: '\u2717'
    },
    pending: {
      border: 'var(--pending)',
      bg: 'transparent',
      glow: 'none',
      icon: '\u25CB'
    },
  };
  return styles[status] ?? styles.pending;
}

type ToolStatus = 'running' | 'completed' | 'failed' | 'pending';

function getToolStatusStyle(status: ToolStatus): { icon: string; color: string } {
  const map: Record<ToolStatus, { icon: string; color: string }> = {
    running:   { icon: '\u23F3', color: 'var(--accent)' },
    completed: { icon: '\u2705', color: 'var(--success)' },
    failed:    { icon: '\u274C', color: 'var(--error)' },
    pending:   { icon: '\u25CB', color: 'var(--text-muted)' },
  };
  return map[status];
}

export interface AgentGroupNodeData extends DAGNode {
  agentType?: string;
  agentName?: string;
  collapsed?: boolean;
  childCount?: number;
  progress?: number;
  skillsUsed?: Array<{ name: string; domain: string }>;
  source?: 'orchestration' | 'execution' | 'llm-decomposition';
  onToggleCollapse?: (nodeId: string) => void;
  onOpenDetail?: (node: Pick<DAGNode, 'id'|'type'|'label'|'status'|'args'|'summaryContent'|'content'> & { agentType?: string; taskDescription?: string; duration?: number; skillsUsed?: Array<{name:string;domain:string}>; toolMessage?: string }) => void;
  /** 节点内的实时输出文本（来自 tool_progress） */
  liveOutput?: string;
}

const SOURCE_STYLES: Record<string, { borderColor: string; opacity: number; label: string }> = {
  'orchestration': { borderColor: '#8B5CF6', opacity: 0.8, label: '编排' },
  'execution': { borderColor: '#3B82F6', opacity: 1.0, label: '执行' },
  'llm-decomposition': { borderColor: '#10B981', opacity: 1.0, label: '自动' },
};

interface AgentGroupNodeProps {
  data: AgentGroupNodeData;
  selected?: boolean;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/** 子工具调用步骤卡片 */
const ChildToolItem = memo(function ChildToolItem({ node }: { node: DAGNode }) {
  const toolName = node.label;
  const status: ToolStatus = (node.status as ToolStatus) ?? 'pending';
  const si = getToolStatusStyle(status);
  const duration = node.endTime && node.startTime ? node.endTime - node.startTime : undefined;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4,
      padding: '2px 6px',
      fontSize: 9,
      color: 'var(--text-secondary)',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
    }}>
      <span style={{ color: si.color, flexShrink: 0 }}>{si.icon}</span>
      <span style={{
        fontFamily: 'monospace', fontSize: 9, color: 'var(--text-secondary)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        flex: 1,
      }} title={toolName}>
        {toolName}
      </span>
      {duration !== undefined && (
        <span style={{ fontSize: 8, color: '#6b7280', flexShrink: 0 }}>{formatDuration(duration)}</span>
      )}
    </div>
  );
});

const AgentGroupNode: React.FC<AgentGroupNodeProps> = memo(({ data, selected }) => {
  const {
    id, label, status = 'pending', agentType = 'default',
    agentName, collapsed = false, childCount = 0, taskDescription,
    progress, onToggleCollapse, onOpenDetail,
    startTime, endTime, skillsUsed, toolMessage,
    source, liveOutput,
  } = data;

  // 从 store 获取 nodes Map（引用稳定，仅在 nodes 变更时触发重渲染）
  const nodes = useTaskStore(s => s.nodes);

  // 使用 useMemo 计算子工具节点，避免 selector 每次返回新数组触发无限渲染
  const childToolNodes = useMemo(() => {
    const children: DAGNode[] = [];
    for (const [, node] of nodes) {
      if (node.type === 'tool' && node.parentId === id) {
        children.push(node);
      }
    }
    return children;
  }, [nodes, id]);

  const colors = AGENT_TYPE_COLORS[agentType] ?? AGENT_TYPE_COLORS['default'];
  const ss = getStatusStyle(status);
  const sourceStyle = source ? SOURCE_STYLES[source] : undefined;
  const isRunning = status === 'running';
  const isFailed = status === 'failed';
  const duration = (endTime && startTime) ? endTime - startTime : undefined;
  const displayName = agentName ?? label;

  const handleToggle = useCallback(() => onToggleCollapse?.(id), [id, onToggleCollapse]);
  const handleDetail = useCallback(() => {
    onOpenDetail?.({
      id, type: 'agent_group', label: displayName, status,
      args: undefined, summaryContent: undefined, content: undefined,
      agentType, taskDescription, duration, skillsUsed, toolMessage,
    });
  }, [id, displayName, status, agentType, taskDescription, duration, skillsUsed, toolMessage, onOpenDetail]);

  // 工具调用子节点列表（仅展开 + 有数据时显示）
  const showChildTools = !collapsed && childToolNodes.length > 0;
  // 实时输出文本（来自 tool_progress）
  const showLiveOutput = !collapsed && liveOutput;

  return (
    <div style={{
      background: ss.bg,
      border: `1.5px solid ${sourceStyle ? sourceStyle.borderColor : (isRunning ? colors.border : ss.border)}`,
      borderRadius: 10,
      overflow: 'hidden',
      minWidth: 220,
      maxWidth: 380,
      boxShadow: isRunning ? ss.glow : (selected ? '0 0 0 2px rgba(139,92,246,0.3)' : 'none'),
      animation: isRunning ? 'agent-pulse 2s infinite' : (isFailed ? 'agent-blink 1s infinite' : 'none'),
      opacity: sourceStyle ? sourceStyle.opacity : (status === 'pending' ? 0.6 : 1),
      transition: 'all 0.3s ease',
      position: 'relative',
    }}>
      <style>{`
        @keyframes agent-pulse {
          0%, 100% { border-color: ${colors.border}; box-shadow: ${ss.glow}; }
          50% { border-color: ${colors.text}; box-shadow: 0 0 20px ${colors.border}44; }
        }
        @keyframes agent-blink {
          0%, 100% { border-color: #ef4444; }
          50% { border-color: #f87171; }
        }
      `}</style>

      <Handle type="target" position={Position.Top} style={{ background: colors.border, width: 8, height: 8 }} />

      {/* 卡片头部 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 10px',
        background: `${colors.border}15`,
        borderBottom: `1px solid ${colors.border}30`,
        cursor: 'pointer',
      }} onClick={handleToggle}>
        <span style={{ fontSize: 10, color: colors.text }}>
          {collapsed ? '\u25B8' : '\u25BE'}
        </span>
        <span style={{
          background: colors.border, color: '#fff',
          padding: '1px 5px', borderRadius: 3,
          fontSize: 9, fontWeight: 600, textTransform: 'capitalize',
        }}>{agentType}</span>
        {sourceStyle && (
          <span style={{
            background: `${sourceStyle.borderColor}20`, color: sourceStyle.borderColor,
            padding: '1px 4px', borderRadius: 3,
            fontSize: 8, fontWeight: 500,
          }}>
            {sourceStyle.label}
          </span>
        )}
        <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: 'var(--text-primary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }} title={displayName}>
          {displayName}
        </span>
        <span style={{ fontSize: 12, color: isRunning ? colors.text : (isFailed ? 'var(--error)' : 'var(--success)') }}>
          {ss.icon}
        </span>
      </div>

      {/* 未折叠：taskDescription + 元数据行 + 进度条 + 子流程步骤 + 详情按钮 */}
      {!collapsed && (
        <div style={{ padding: '6px 10px' }}>
          {/* taskDescription 副标题 */}
          {taskDescription && (
            <div style={{
              fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.3,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              marginBottom: 4,
            }} title={taskDescription}>
              {taskDescription}
            </div>
          )}

          {/* 元数据行 */}
          <div style={{ display: 'flex', gap: 8, fontSize: 9, color: 'var(--text-muted)', marginBottom: 4, flexWrap: 'wrap' }}>
            {agentType === 'planning' && <span title="已生成设计方案">📄 设计方案</span>}
            {agentType === 'context' && <span title="已分析项目结构">📂 上下文分析</span>}
            {agentType === 'execution' && <span title="已执行任务">⚡ 执行结果</span>}
            {skillsUsed && skillsUsed.length > 0 && (
              <span title={skillsUsed.map(s => s.name).join(', ')}>
                🧩 {skillsUsed.length}项技能
              </span>
            )}
            {childCount > 0 && <span title={`${childCount} 个子工具调用`}>🔧 {childCount}次调用</span>}
            {duration !== undefined && <span title={`耗时 ${duration}ms`}>⏱ {formatDuration(duration)}</span>}
          </div>

          {/* 进度条 */}
          {isRunning && (
            <div style={{ marginBottom: 6 }}>
              <div style={{ height: 3, background: '#30363d', borderRadius: 2 }}>
                <div style={{
                  width: `${Math.min(Math.max(progress ?? 10, 10), 100)}%`, height: '100%',
                  background: `linear-gradient(90deg, ${colors.border}, ${colors.text})`,
                  borderRadius: 2, transition: 'width 0.5s ease',
                }} />
              </div>
            </div>
          )}

          {/* 实时输出文本 */}
          {showLiveOutput && (
            <div style={{
              fontSize: 9, color: 'var(--text-muted)',
              fontFamily: 'monospace',
              background: 'rgba(0,0,0,0.15)',
              borderRadius: 4, padding: '3px 6px',
              marginBottom: 4,
              maxHeight: 60, overflowY: 'auto',
              lineHeight: 1.4,
            }}>
              {liveOutput}
            </div>
          )}

          {/* 内部子流程步骤（工具调用列表） */}
          {showChildTools && (
            <div style={{
              marginBottom: 6,
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 4,
              overflow: 'hidden',
            }}>
              <div style={{
                fontSize: 8,
                color: '#6b7280',
                padding: '2px 8px',
                background: 'rgba(255,255,255,0.03)',
                fontFamily: 'monospace',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                内部步骤 ({childToolNodes.length})
              </div>
              <div style={{ maxHeight: 120, overflowY: 'auto' }}>
                {childToolNodes.map(child => (
                  <ChildToolItem key={child.id} node={child} />
                ))}
              </div>
            </div>
          )}

          {/* 错误信息 */}
          {isFailed && toolMessage && (
            <div style={{
              fontSize: 9, color: '#ef4444', background: 'rgba(239,68,68,0.08)',
              borderRadius: 4, padding: '3px 6px', marginBottom: 6,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              ⚠️ {toolMessage}
            </div>
          )}

          {/* 详情按钮 */}
          <button onClick={handleDetail} style={{
            background: 'none', border: 'none', padding: 0,
            cursor: 'pointer', fontSize: 10, color: colors.text,
            fontFamily: 'monospace',
          }}>
            {'\u25B6'} 查看 {agentType} 详情
          </button>
        </div>
      )}

      {/* 折叠态 */}
      {collapsed && (
        <div style={{ padding: '4px 10px', fontSize: 10, color: '#6b7280' }}>
          {childCount > 0 ? `${childCount} 个子工具` : taskDescription?.slice(0, 40)}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={{ background: colors.border, width: 8, height: 8 }} />
    </div>
  );
});

AgentGroupNode.displayName = 'AgentGroupNode';

export default AgentGroupNode;
export const AGENT_GROUP_NODE_TYPE = 'agent_group';
