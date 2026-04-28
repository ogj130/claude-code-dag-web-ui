/**
 * AgentMonitoringPanel — Agent 监控面板
 *
 * 实时展示所有 Agent 的状态、Token 消耗、执行进度。
 * 所有样式使用内联 style + CSS 变量（本项目未安装 Tailwind CSS）。
 */

import { useState, useEffect } from 'react';
import {
  getAllTasks,
  onTaskUpdate,
  type OrchestrationTask,
  type AgentNode,
} from '../../services/agentOrchestrator';

// ── 统计汇总 ────────────────────────────────────────────────

function SummaryBar({ tasks }: { tasks: OrchestrationTask[] }) {
  const running = tasks.filter((t) => t.status === 'running').length;
  const completed = tasks.filter((t) => t.status === 'completed').length;
  const totalTokens = tasks.reduce((sum, t) => sum + t.totalTokens, 0);

  const stats = [
    { label: '任务', value: tasks.length, color: '#CBD5E1' },
    { label: '运行中', value: running, color: '#60A5FA' },
    { label: '已完成', value: completed, color: '#34D399' },
    { label: 'Tokens', value: totalTokens.toLocaleString(), color: '#A78BFA' },
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 8,
      marginBottom: 16,
    }}>
      {stats.map((stat) => (
        <div key={stat.label} style={{
          padding: 8,
          borderRadius: 6,
          background: 'rgba(30, 41, 59, 0.5)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: stat.color }}>{stat.value}</div>
          <div style={{ fontSize: 10, color: '#64748B' }}>{stat.label}</div>
        </div>
      ))}
    </div>
  );
}

// ── Agent 进度条 ────────────────────────────────────────────

function AgentProgress({ agent }: { agent: AgentNode }) {
  const progress = agent.status === 'completed' ? 100
    : agent.status === 'running' ? 50 + Math.random() * 30
    : agent.status === 'failed' ? 100
    : 0;

  const barColor = agent.status === 'completed' ? '#34D399'
    : agent.status === 'running' ? '#60A5FA'
    : agent.status === 'failed' ? '#F87171'
    : '#64748B';

  return (
    <div style={{
      padding: 10,
      borderRadius: 8,
      border: '1px solid rgba(148, 163, 184, 0.12)',
      background: 'rgba(30, 41, 59, 0.5)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: '#CBD5E1' }}>{agent.name}</span>
          <span style={{ fontSize: 10, color: '#64748B' }}>{agent.role}</span>
        </div>
        <span style={{ fontSize: 10, color: '#64748B' }}>
          {agent.tokenCount > 0 && `${agent.tokenCount.toLocaleString()} tok`}
        </span>
      </div>
      <div style={{
        height: 4,
        borderRadius: 2,
        background: 'rgba(148, 163, 184, 0.1)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          borderRadius: 2,
          background: barColor,
          width: `${progress}%`,
          transition: 'width 0.5s ease-out',
        }} />
      </div>
      {agent.result && (
        <div style={{
          fontSize: 10,
          color: '#64748B',
          marginTop: 4,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          ✓ {agent.result.slice(0, 80)}
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
          ✗ {agent.error.slice(0, 80)}
        </div>
      )}
    </div>
  );
}

// ── 任务行 ──────────────────────────────────────────────────

function TaskRow({ task }: { task: OrchestrationTask }) {
  const [expanded, setExpanded] = useState(task.status === 'running');

  const statusIcon = task.status === 'completed' ? '✓'
    : task.status === 'running' ? '⟳'
    : task.status === 'failed' ? '✗'
    : '○';

  const statusColor = task.status === 'completed' ? '#34D399'
    : task.status === 'running' ? '#60A5FA'
    : task.status === 'failed' ? '#F87171'
    : '#64748B';

  return (
    <div style={{
      border: '1px solid rgba(148, 163, 184, 0.08)',
      borderRadius: 8,
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
          transition: 'all 0.15s ease-out',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(148,163,184,0.03)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: statusColor }}>{statusIcon}</span>
          <span style={{ fontSize: 12, fontWeight: 500, color: '#CBD5E1' }}>{task.name}</span>
          <span style={{ fontSize: 10, color: '#64748B' }}>{task.mode}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 10, color: '#64748B' }}>
          <span>{task.agents.length} agents</span>
          <span>{task.totalTokens.toLocaleString()} tok</span>
        </div>
      </button>

      {expanded && (
        <div style={{
          padding: '4px 12px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          {task.agents.map((agent) => (
            <AgentProgress key={agent.id} agent={agent} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── 主组件 ──────────────────────────────────────────────────

export interface AgentMonitoringPanelProps {
  className?: string;
}

export default function AgentMonitoringPanel({}: AgentMonitoringPanelProps) {
  const [tasks, setTasks] = useState<OrchestrationTask[]>(getAllTasks());

  useEffect(() => {
    const unsub = onTaskUpdate(() => {
      setTasks(getAllTasks());
    });
    return unsub;
  }, []);

  return (
    <div style={{ padding: 12 }}>
      <h3 style={{
        margin: '0 0 12px',
        fontSize: 14,
        fontWeight: 500,
        color: '#CBD5E1',
      }}>
        Agent 监控
      </h3>

      <SummaryBar tasks={tasks} />

      {tasks.length === 0 ? (
        <div style={{
          textAlign: 'center',
          color: '#64748B',
          fontSize: 12,
          padding: '32px 0',
        }}>
          暂无运行中的编排任务
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}
