/**
 * KanbanBoard — 任务看板
 *
 * Todo / Doing / Done / Review 四列拖拽看板。
 * 所有样式使用内联 style + CSS 变量（本项目未安装 Tailwind CSS）。
 */

import { useState, useCallback } from 'react';

// ── 类型 ────────────────────────────────────────────────────

type ColumnId = 'todo' | 'doing' | 'done' | 'review';

interface TaskCard {
  id: string;
  title: string;
  description: string;
  column: ColumnId;
  priority: 'low' | 'medium' | 'high';
  assignee?: string;
  createdAt: number;
}

interface Column {
  id: ColumnId;
  label: string;
  borderColor: string;
  borderTopColor: string;
}

// ── 配置 ────────────────────────────────────────────────────

const COLUMNS: Column[] = [
  { id: 'todo', label: '待办', borderColor: '#64748B', borderTopColor: '#64748B' },
  { id: 'doing', label: '进行中', borderColor: '#60A5FA', borderTopColor: '#3B82F6' },
  { id: 'review', label: '审查中', borderColor: '#FBBF24', borderTopColor: '#F59E0B' },
  { id: 'done', label: '已完成', borderColor: '#34D399', borderTopColor: '#10B981' },
];

const PRIORITY_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  low:    { bg: 'rgba(107, 114, 128, 0.1)', color: '#9CA3AF', border: 'rgba(107, 114, 128, 0.2)' },
  medium: { bg: 'rgba(251, 191, 36, 0.1)', color: '#FBBF24', border: 'rgba(251, 191, 36, 0.2)' },
  high:   { bg: 'rgba(248, 113, 113, 0.1)', color: '#F87171', border: 'rgba(248, 113, 113, 0.2)' },
};

interface DnDState {
  draggingId: string | null;
  dragOverColumn: ColumnId | null;
}

// ── 初始数据 ────────────────────────────────────────────────

const INITIAL_TASKS: TaskCard[] = [
  { id: 't1', title: '实现登录功能', description: 'OAuth2 + JWT', column: 'todo', priority: 'high', assignee: '哈雷酱', createdAt: Date.now() - 86400000 },
  { id: 't2', title: '修复暗色模式', description: '图表颜色不正确', column: 'doing', priority: 'medium', createdAt: Date.now() - 43200000 },
  { id: 't3', title: '添加单元测试', description: '覆盖率 > 80%', column: 'todo', priority: 'low', createdAt: Date.now() },
  { id: 't4', title: '性能优化', description: '首屏加载 < 2s', column: 'review', priority: 'high', assignee: '哈雷酱', createdAt: Date.now() - 172800000 },
  { id: 't5', title: '国际化支持', description: 'zh-CN / en-US', column: 'done', priority: 'medium', createdAt: Date.now() - 259200000 },
];

// ── 任务卡片 ────────────────────────────────────────────────

function TaskCardComponent({
  task,
  onDragStart,
}: {
  task: TaskCard;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      style={{
        padding: 10,
        borderRadius: 8,
        border: '1px solid rgba(148, 163, 184, 0.12)',
        background: 'rgba(30, 41, 59, 0.5)',
        cursor: 'grab',
        transition: 'all 0.15s ease-out',
        userSelect: 'none',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.25)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.12)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{
          fontSize: 12,
          fontWeight: 500,
          color: '#CBD5E1',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
        }}>
          {task.title}
        </span>
        <span style={{
          fontSize: 10,
          padding: '1px 6px',
          borderRadius: 4,
          background: PRIORITY_STYLES[task.priority].bg,
          color: PRIORITY_STYLES[task.priority].color,
          border: `1px solid ${PRIORITY_STYLES[task.priority].border}`,
          marginLeft: 6,
        }}>
          {task.priority}
        </span>
      </div>
      <p style={{
        margin: '0 0 6px',
        fontSize: 10,
        color: '#64748B',
      }}>
        {task.description}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {task.assignee && (
          <span style={{ fontSize: 10, color: '#60A5FA' }}>{task.assignee}</span>
        )}
        <span style={{ fontSize: 10, color: '#475569' }}>
          {new Date(task.createdAt).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}

// ── 列 ─────────────────────────────────────────────────────

function KanbanColumn({
  column,
  tasks,
  onDrop,
  onDragStart,
  dndState,
  setDndState,
}: {
  column: Column;
  tasks: TaskCard[];
  onDrop: (columnId: ColumnId) => void;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  dndState: DnDState;
  setDndState: React.Dispatch<React.SetStateAction<DnDState>>;
}) {
  const isDragOver = dndState.dragOverColumn === column.id;

  return (
    <div
      style={{
        flex: 1,
        minWidth: 180,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 8,
        borderTop: `2px solid ${column.borderTopColor}`,
        background: 'rgba(30, 41, 59, 0.15)',
        transition: 'background 0.15s ease-out',
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDndState(prev => ({ ...prev, dragOverColumn: column.id }));
      }}
      onDragLeave={() => setDndState(prev => ({ ...prev, dragOverColumn: null }))}
      onDrop={() => { onDrop(column.id); setDndState(prev => ({ ...prev, dragOverColumn: null })); }}
    >
      <div style={{
        padding: '8px 12px',
        transition: 'background 0.15s ease-out',
        background: isDragOver ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: '#CBD5E1' }}>{column.label}</span>
          <span style={{ fontSize: 10, color: '#64748B' }}>{tasks.length}</span>
        </div>
      </div>
      <div style={{
        flex: 1,
        padding: '0 8px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        overflowY: 'auto',
      }}>
        {tasks.map((task) => (
          <TaskCardComponent key={task.id} task={task} onDragStart={onDragStart} />
        ))}
      </div>
    </div>
  );
}

// ── 主组件 ──────────────────────────────────────────────────

export interface KanbanBoardProps {
  className?: string;
}

export default function KanbanBoard({}: KanbanBoardProps) {
  const [tasks, setTasks] = useState<TaskCard[]>(INITIAL_TASKS);
  const [dndState, setDndState] = useState<DnDState>({ draggingId: null, dragOverColumn: null });

  const handleDragStart = useCallback((e: React.DragEvent, taskId: string) => {
    setDndState(prev => ({ ...prev, draggingId: taskId }));
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDrop = useCallback((columnId: ColumnId) => {
    if (!dndState.draggingId) return;
    setTasks((prev) =>
      prev.map((t) => (t.id === dndState.draggingId ? { ...t, column: columnId } : t))
    );
    setDndState({ draggingId: null, dragOverColumn: null });
  }, [dndState.draggingId]);

  return (
    <div style={{
      display: 'flex',
      gap: 12,
      padding: 12,
      height: '100%',
    }}>
      {COLUMNS.map((col) => (
        <KanbanColumn
          key={col.id}
          column={col}
          tasks={tasks.filter((t) => t.column === col.id)}
          onDrop={handleDrop}
          onDragStart={handleDragStart}
          dndState={dndState}
          setDndState={setDndState}
        />
      ))}
    </div>
  );
}
