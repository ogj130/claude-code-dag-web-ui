import type { AgentPlanItem } from '@/types/multi-agent/ceo-agent';
import type { TaskResult } from '@/types/multi-agent/worker-agents';

export type CEOPhase = 'planning' | 'executing' | 'summary';

export interface CEOAgentCardProps {
  phase: CEOPhase;
  plan?: AgentPlanItem[];
  taskResults?: TaskResult[];
  ceoSummary?: string;
  strategy?: string;
  completedCount?: number;
  totalCount?: number;
  onExecute?: () => void;
  onEditPlan?: () => void;
  onSaveAsTemplate?: () => void;
  style?: React.CSSProperties;
}

const PHASE_LABELS: Record<CEOPhase, { icon: string; title: string }> = {
  planning: { icon: '\uD83E\uDDE0', title: '阶段一：CEO 规划' },
  executing: { icon: '\u26A1', title: '阶段二：Agent 执行' },
  summary: { icon: '\uD83D\uDCCA', title: '阶段三：CEO 总结报告' },
};

const AGENT_TYPE_COLORS: Record<string, string> = {
  context: '#3b82f6', planning: '#f59e0b', execution: '#10b981', review: '#8b5cf6',
};

export function CEOAgentCard({
  phase, plan, taskResults, ceoSummary, strategy,
  completedCount = 0, totalCount = 0,
  onExecute, onEditPlan, style,
}: CEOAgentCardProps) {
  const lbl = PHASE_LABELS[phase];

  const getAgentStatusIcon = (agentId: string): string => {
    const result = taskResults?.find(r => r.taskId === agentId);
    if (!result) return '\u25CB';
    return result.success ? '\u2705' : '\u274C';
  };

  const getAgentStatus = (agentId: string): string => {
    const result = taskResults?.find(r => r.taskId === agentId);
    if (!result) return 'pending';
    return result.success ? 'completed' : 'failed';
  };

  const getAgentProgress = (agentId: string): string | undefined => {
    const result = taskResults?.find(r => r.taskId === agentId);
    if (!result) return undefined;
    if (result.success) return `${result.duration}ms`;
    return result.error?.slice(0, 50);
  };

  return (
    <div style={{
      background: 'var(--bg-card, #161b22)',
      border: '1px solid var(--border, #30363d)',
      borderRadius: 8,
      marginBottom: 12,
      overflow: 'hidden',
      transition: 'all 0.3s',
      ...style,
    }}>
      {/* 阶段头部 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 14px',
        background: phase === 'executing' ? 'rgba(59,130,246,0.06)' : 'rgba(139,92,246,0.04)',
        borderBottom: '1px solid var(--border, #21262d)',
      }}>
        <span style={{ fontSize: 16 }}>{lbl.icon}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{lbl.title}</span>
        {phase === 'executing' && (
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#6b7280' }}>
            {completedCount}/{totalCount} 完成
          </span>
        )}
      </div>

      <div style={{ padding: '10px 14px' }}>
        {/* 阶段一：规划列表 */}
        {phase === 'planning' && plan && (
          <>
            {strategy && (
              <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 8 }}>
                策略：<span style={{ color: '#c4b5fd', fontWeight: 500 }}>{strategy === 'pipeline' ? '流水线' : strategy === 'parallel' ? '并行' : '混合'}</span>
                &nbsp;· {plan.length} Agent
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {plan.map((agent, i) => (
                <div key={agent.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 10px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 6,
                }}>
                  <span style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: AGENT_TYPE_COLORS[agent.type] ?? '#6b7280',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 10, fontWeight: 600, flexShrink: 0,
                  }}>{i + 1}</span>
                  <span style={{
                    background: AGENT_TYPE_COLORS[agent.type] ?? '#6b7280', color: '#fff',
                    padding: '1px 5px', borderRadius: 3, fontSize: 9, fontWeight: 600,
                  }}>{agent.type}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 500 }}>{agent.name}</div>
                    <div style={{ fontSize: 10, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agent.description}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
              {onExecute && (
                <button onClick={onExecute} style={{
                  padding: '4px 16px', borderRadius: 5, border: 'none',
                  background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
                  color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                }}>{'\u25B6'} 执行计划</button>
              )}
              {onEditPlan && (
                <button onClick={onEditPlan} style={{
                  padding: '4px 12px', borderRadius: 5, border: '1px solid rgba(255,255,255,0.15)',
                  background: '#374151', color: '#c9d1d9', fontSize: 11, cursor: 'pointer',
                }}>{'\uD83D\uDCDD'} 审核调整</button>
              )}
            </div>
          </>
        )}

        {/* 阶段二：执行进度 */}
        {phase === 'executing' && taskResults && plan && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {plan.map(agent => {
              const status = getAgentStatus(agent.id);
              const progress = getAgentProgress(agent.id);
              const isRunning = status === 'pending' && phase === 'executing';

              return (
                <div key={agent.id} style={{
                  padding: '8px 10px',
                  background: status === 'completed' ? 'rgba(16,185,129,0.06)'
                    : status === 'failed' ? 'rgba(239,68,68,0.06)'
                    : 'rgba(59,130,246,0.06)',
                  border: `1px solid ${
                    status === 'completed' ? 'rgba(16,185,129,0.25)'
                    : status === 'failed' ? 'rgba(239,68,68,0.25)'
                    : 'rgba(59,130,246,0.25)'}`,
                  borderRadius: 5,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12 }}>{getAgentStatusIcon(agent.id)}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-primary)' }}>{agent.name} · {agent.description.slice(0, 40)}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: '#6b7280' }}>
                      {progress ?? (isRunning ? '等待中...' : '')}
                    </span>
                  </div>
                  {isRunning && (
                    <div style={{ marginTop: 6, height: 3, background: '#30363d', borderRadius: 2 }}>
                      <div style={{ width: '60%', height: '100%', background: '#3b82f6', borderRadius: 2,
                        animation: 'progress-indeterminate 1.5s ease-in-out infinite' }} />
                    </div>
                  )}
                </div>
              );
            })}
            <style>{`
              @keyframes progress-indeterminate {
                0% { width: 20%; margin-left: 0; }
                50% { width: 50%; margin-left: 25%; }
                100% { width: 20%; margin-left: 60%; }
              }
            `}</style>
          </div>
        )}

        {/* 阶段三：CEO 总结 */}
        {phase === 'summary' && ceoSummary && (
          <div style={{
            fontSize: 12, color: 'var(--text-primary)',
            whiteSpace: 'pre-wrap', lineHeight: 1.6,
            fontFamily: "'JetBrains Mono', monospace",
            maxHeight: 400, overflowY: 'auto',
          }}>
            {ceoSummary}
          </div>
        )}
      </div>
    </div>
  );
}

export default CEOAgentCard;
