import { useMemo } from 'react';
import { useTaskStore } from '../../stores/useTaskStore';
import { ToolStreamNode } from './ToolStreamNode';

interface Props {
  queryId: string;
}

/** 工具时间线：显示指定 query 的所有工具执行过程 */
export function CardToolTimeline({ queryId }: Props) {
  const { nodes, toolCalls, toolProgressMessages } = useTaskStore();

  // 从 DAG nodes 中找到 parentId === queryId 的所有工具节点
  const tools = useMemo(() => {
    const toolIds = new Set<string>();
    for (const node of nodes.values()) {
      if (node.type === 'tool' && node.parentId === queryId) {
        toolIds.add(node.id);
      }
    }
    return toolCalls.filter(t => toolIds.has(t.id));
  }, [nodes, toolCalls, queryId]);

  // 按状态分组：running 在前，completed/error 在后
  const { activeTools, completedTools } = useMemo(() => {
    const active: typeof tools = [];
    const completed: typeof tools = [];
    for (const t of tools) {
      if (t.status === 'running') active.push(t);
      else completed.push(t);
    }
    return { activeTools: active, completedTools: completed.slice(-5) }; // 最多显示最近5条已完成
  }, [tools]);

  if (tools.length === 0) return null;

  return (
    <>
      {/* CSS keyframes（内联 style 注入） */}
      <style>{`
        @keyframes tool-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div style={{
        padding: '6px 12px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-bar)',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
      }}>
        {/* Running 工具（保持在上方） */}
        {activeTools.map(tool => (
          <ToolStreamNode
            key={tool.id}
            toolCall={tool}
            progress={toolProgressMessages.get(tool.id) ?? ''}
            isRunning={true}
          />
        ))}

        {/* 已完成工具（追加新行模式） */}
        {completedTools.map(tool => (
          <ToolStreamNode
            key={`done-${tool.id}`}
            toolCall={tool}
            progress={toolProgressMessages.get(tool.id) ?? ''}
            isRunning={false}
          />
        ))}
      </div>
    </>
  );
}
