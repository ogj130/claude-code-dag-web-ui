/**
 * AgentOrchestrationCanvas — Agent 编排画布
 *
 * 可视化展示 Agent 协作拓扑、实时状态、数据流向。
 * 支持 5 种协作模式的图形化展示。
 * 所有样式使用内联 style + CSS 变量（本项目未安装 Tailwind CSS）。
 */

import { useState, useEffect } from 'react';
import {
  onTaskUpdate,
  getTask,
  type OrchestrationTask,
  type AgentNode,
  type AgentStatus,
  type CollaborationMode,
} from '../../services/agentOrchestrator';

// ── 样式映射 ────────────────────────────────────────────────

const STATUS_COLORS: Record<AgentStatus, { border: string; bg: string }> = {
  idle: { border: '#6B7280', bg: 'rgba(107,114,128,0.05)' },
  running: { border: '#60A5FA', bg: 'rgba(96,165,250,0.1)' },
  waiting: { border: '#FBBF24', bg: 'rgba(251,191,36,0.05)' },
  completed: { border: '#34D399', bg: 'rgba(52,211,153,0.05)' },
  failed: { border: '#F87171', bg: 'rgba(248,113,113,0.05)' },
  cancelled: { border: '#6B7280', bg: 'rgba(107,114,128,0.05)' },
};

const ROLE_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  coordinator: { text: '#C084FC', bg: 'rgba(168,85,247,0.1)', border: 'rgba(168,85,247,0.3)' },
  worker: { text: '#93C5FD', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)' },
  reviewer: { text: '#FDE68A', bg: 'rgba(234,179,8,0.1)', border: 'rgba(234,179,8,0.3)' },
  specialist: { text: '#67E8F9', bg: 'rgba(6,182,212,0.1)', border: 'rgba(6,182,212,0.3)' },
};

const MODE_LABELS: Record<CollaborationMode, string> = {
  parallel: '并行',
  sequential: '顺序',
  pipeline: '流水线',
  coordinator: '协调者',
  reviewer: '审查',
};

// ── Agent 节点 ──────────────────────────────────────────────

function AgentCard({ agent }: { agent: AgentNode }) {
  const statusColor = STATUS_COLORS[agent.status];
  const roleColor = ROLE_COLORS[agent.role] ?? ROLE_COLORS.worker;

  return (
    <div style={{
      padding: 12,
      borderRadius: 8,
      border: `1px solid ${statusColor.border}`,
      background: statusColor.bg,
      minWidth: 160,
      transition: 'all 0.3s ease-out',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{
          fontSize: 10,
          padding: '2px 6px',
          borderRadius: 4,
          color: roleColor.text,
          background: roleColor.bg,
          border: `1px solid ${roleColor.border}`,
        }}>
          {agent.role}
        </span>
        <span style={{ fontSize: 10, color: '#6B7280' }}>{agent.status}</span>
      </div>
      <div style={{ fontSize: 12, fontWeight: 500, color: '#CBD5E1', marginBottom: 4 }}>{agent.name}</div>
      <div style={{
        fontSize: 10,
        color: '#9CA3AF',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {agent.taskDescription}
      </div>
      {agent.tokenCount > 0 && (
        <div style={{ fontSize: 10, color: '#6B7280', marginTop: 6 }}>
          {agent.tokenCount.toLocaleString()} tokens
          {agent.durationMs > 0 && ` · ${(agent.durationMs / 1000).toFixed(1)}s`}
        </div>
      )}
      {agent.error && (
        <div style={{
          fontSize: 10,
          color: '#F87171',
          marginTop: 4,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {agent.error}
        </div>
      )}
    </div>
  );
}

// ── 协作模式布局 ────────────────────────────────────────────

function ParallelLayout({ agents }: { agents: AgentNode[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
      {agents.map((agent) => (
        <AgentCard key={agent.id} agent={agent} />
      ))}
    </div>
  );
}

function SequentialLayout({ agents }: { agents: AgentNode[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      {agents.map((agent, i) => (
        <div key={agent.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <AgentCard agent={agent} />
          {i < agents.length - 1 && (
            <div style={{ color: '#6B7280', fontSize: 18, lineHeight: 1 }}>↓</div>
          )}
        </div>
      ))}
    </div>
  );
}

function PipelineLayout({ agents }: { agents: AgentNode[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      {agents.map((agent, i) => (
        <div key={agent.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <AgentCard agent={agent} />
          {i < agents.length - 1 && (
            <div style={{ color: 'rgba(96,165,250,0.5)', fontSize: 10 }}>output → input</div>
          )}
        </div>
      ))}
    </div>
  );
}

function CoordinatorLayout({ agents }: { agents: AgentNode[] }) {
  const coordinator = agents.find((a) => a.role === 'coordinator');
  const workers = agents.filter((a) => a.role !== 'coordinator');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      {coordinator && <AgentCard agent={coordinator} />}
      {workers.length > 0 && (
        <>
          <div style={{ color: 'rgba(168,85,247,0.5)', fontSize: 10 }}>分配任务 ↓</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
            {workers.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ReviewerLayout({ agents }: { agents: AgentNode[] }) {
  const worker = agents.find((a) => a.role === 'worker');
  const reviewer = agents.find((a) => a.role === 'reviewer');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      {worker && <AgentCard agent={worker} />}
      {worker && reviewer && (
        <div style={{ color: 'rgba(234,179,8,0.5)', fontSize: 10 }}>提交审查 ↓</div>
      )}
      {reviewer && <AgentCard agent={reviewer} />}
    </div>
  );
}

const MODE_LAYOUTS: Record<CollaborationMode, React.FC<{ agents: AgentNode[] }>> = {
  parallel: ParallelLayout,
  sequential: SequentialLayout,
  pipeline: PipelineLayout,
  coordinator: CoordinatorLayout,
  reviewer: ReviewerLayout,
};

// ── 主组件 ──────────────────────────────────────────────────

export interface AgentOrchestrationCanvasProps {
  taskId: string;
  className?: string;
}

export default function AgentOrchestrationCanvas({
  taskId,
}: AgentOrchestrationCanvasProps) {
  const [task, setTask] = useState<OrchestrationTask | null>(() => getTask(taskId));

  useEffect(() => {
    setTask(getTask(taskId));

    const unsub = onTaskUpdate((updated) => {
      if (updated.id === taskId) setTask(updated);
    });

    return unsub;
  }, [taskId]);

  if (!task) {
    return (
      <div style={{ padding: 16, textAlign: 'center', color: '#6B7280', fontSize: 14 }}>
        未找到任务
      </div>
    );
  }

  const Layout = MODE_LAYOUTS[task.mode] ?? ParallelLayout;

  const statusStyle = (() => {
    switch (task.status) {
      case 'completed': return { bg: 'rgba(52,211,153,0.1)', color: '#34D399' };
      case 'failed': return { bg: 'rgba(248,113,113,0.1)', color: '#F87171' };
      case 'running': return { bg: 'rgba(96,165,250,0.1)', color: '#60A5FA' };
      default: return { bg: 'rgba(107,114,128,0.1)', color: '#9CA3AF' };
    }
  })();

  return (
    <div style={{ padding: 16 }}>
      {/* 标题栏 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 500, color: '#CBD5E1' }}>{task.name}</h3>
          <span style={{
            fontSize: 10,
            padding: '2px 8px',
            borderRadius: 4,
            background: '#374151',
            color: '#9CA3AF',
          }}>
            {MODE_LABELS[task.mode]}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 10, color: '#6B7280' }}>
          <span>{task.agents.length} agents</span>
          <span>{task.totalTokens.toLocaleString()} tokens</span>
          <span style={{
            padding: '2px 6px',
            borderRadius: 4,
            background: statusStyle.bg,
            color: statusStyle.color,
          }}>
            {task.status}
          </span>
        </div>
      </div>

      {/* Agent 拓扑 */}
      <Layout agents={task.agents} />
    </div>
  );
}
