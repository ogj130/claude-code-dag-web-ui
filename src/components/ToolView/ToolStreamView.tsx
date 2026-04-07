import { useMemo } from 'react';
import { useTaskStore } from '../../stores/useTaskStore';
import { ToolStreamNode } from './ToolStreamNode';

interface Props {
  theme: 'dark' | 'light';
}

export function ToolStreamView({ theme: _theme }: Props) {
  const { toolCalls, toolProgressMessages, currentQueryId, isRunning, nodes } = useTaskStore();

  // 从 DAG nodes 中获取当前 query 下的所有工具节点 ID，再过滤 toolCalls
  const currentTools = useMemo(() => {
    const qid = currentQueryId ?? 'main-agent';
    // 收集 parentId === qid 的工具节点 ID
    const toolIds = new Set<string>();
    for (const node of nodes.values()) {
      if (node.type === 'tool' && node.parentId === qid) {
        toolIds.add(node.id);
      }
    }
    return toolCalls.filter(t => toolIds.has(t.id));
  }, [toolCalls, currentQueryId, nodes]);

  // 按状态分组：running 在前，completed/error 在后
  const { activeTools, completedTools } = useMemo(() => {
    const active: typeof toolCalls = [];
    const completed: typeof toolCalls = [];
    for (const t of currentTools) {
      if (t.status === 'running') active.push(t);
      else completed.push(t);
    }
    return { activeTools: active, completedTools: completed.slice(-10) }; // 最多显示最近10条已完成
  }, [currentTools]);

  const isEmpty = activeTools.length === 0 && completedTools.length === 0;
  if (isEmpty) return null;

  return (
    <div style={{
      padding: '6px 14px',
      borderTop: '1px solid var(--term-border)',
      background: 'var(--term-bg)',
      display: 'flex',
      flexDirection: 'column',
      gap: 0,
    }}>
      {/* Running 工具 */}
      {activeTools.map(tool => (
        <ToolStreamNode
          key={tool.id}
          toolCall={tool}
          progress={toolProgressMessages.get(tool.id) ?? ''}
          isRunning={isRunning}
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
  );
}
