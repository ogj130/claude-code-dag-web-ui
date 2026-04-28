/**
 * KanbanBoard — 任务看板
 *
 * Todo / Doing / Done / Review 四列拖拽看板。
 * 所有样式使用内联 style + CSS 变量（本项目未安装 Tailwind CSS）。
 */

import { useState, useCallback, useEffect } from 'react';
import { getAllTasks, createTask, type OrchestrationTask } from '../../services/agentOrchestrator';

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

// ── OrchestrationTask → TaskCard 映射 ──────────────────────────

function mapTaskToCard(task: OrchestrationTask): TaskCard {
  const columnMap: Record<string, ColumnId> = {
    pending: 'todo',
    running: 'doing',
    review: 'review',
    completed: 'done',
  };
  return {
    id: task.id,
    title: task.name || 'Untitled Task',
    description: task.mode || '',
    column: columnMap[task.status] || 'todo',
    priority: 'medium',
    assignee: task.agents?.[0]?.name,
    createdAt: task.createdAt || Date.now(),
  };
}

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
  const [tasks, setTasks] = useState<TaskCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [dndState, setDndState] = useState<DnDState>({ draggingId: null, dragOverColumn: null });

  // 从 agentOrchestrator 加载任务数据
  useEffect(() => {
    try {
      const orchestrationTasks = getAllTasks();
      if (orchestrationTasks.length > 0) {
        setTasks(orchestrationTasks.map(mapTaskToCard));
      }
    } catch (err) {
      console.warn('[Kanban] Failed to load tasks:', err);
    }
    setLoading(false);
  }, []);

  const handleAddTask = useCallback(() => {
    try {
      const title = prompt('任务名称:');
      if (!title) return;
      const newTask = createTask(title, 'parallel', [
        { name: 'Worker', role: 'worker', taskDescription: title },
      ]);
      setTasks((prev) => [...prev, mapTaskToCard(newTask)]);
    } catch (err) {
      console.warn('[Kanban] Failed to create task:', err);
    }
  }, []);

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

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: 'var(--text-muted)',
        fontSize: 13,
      }}>
        加载中...
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    }}>
      {/* 顶部操作栏 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
          任务看板
        </span>
        <button
          onClick={handleAddTask}
          style={{
            padding: '4px 12px',
            borderRadius: 6,
            background: 'rgba(148, 163, 184, 0.1)',
            color: 'var(--text-primary)',
            border: '1px solid rgba(148, 163, 184, 0.15)',
            cursor: 'pointer',
            fontSize: 11,
            fontFamily: 'inherit',
          }}
        >
          + 新建任务
        </button>
      </div>

      {/* 空状态 / 看板列 */}
      {tasks.length === 0 ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          padding: 48,
          gap: 12,
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>任务看板</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>管理你的开发任务，拖拽卡片改变状态</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.8 }}>
            1. 点击下方按钮创建第一个任务<br/>2. 拖拽任务卡片到不同列<br/>3. 双击卡片编辑详情
          </div>
          <button
            onClick={handleAddTask}
            style={{
              marginTop: 12,
              padding: '8px 20px',
              borderRadius: 8,
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontFamily: 'inherit',
            }}
          >
            创建第一个任务
          </button>
        </div>
      ) : (
        <div style={{
          display: 'flex',
          gap: 12,
          padding: 12,
          flex: 1,
          overflow: 'hidden',
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
      )}
    </div>
  );
}
