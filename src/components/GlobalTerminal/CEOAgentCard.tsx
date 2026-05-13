import type { AgentPlanItem } from '@/types/multi-agent/ceo-agent';
import type { TaskResult } from '@/types/multi-agent/worker-agents';
import { useState, useEffect, useRef, memo } from 'react';

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
  /** 用户确认计划后的反馈信息 */
  planConfirmed?: boolean;
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

/** 提取子 Agent 输出的可读摘要 */
function extractOutputSummary(result: TaskResult | undefined): string | undefined {
  if (!result?.output || typeof result.output !== 'object') return undefined;
  const out = result.output as Record<string, unknown>;
  // _started 是运行中标记，不是真正的输出
  if (out._started) return undefined;
  if (out.approved !== undefined) return `方案${out.approved ? '通过' : '驳回'}审核`;
  if (out.summary) return String(out.summary).slice(0, 120);
  if (out.aggregated && typeof out.aggregated === 'object') {
    const agg = out.aggregated as Record<string, unknown>;
    return agg.summary ? String(agg.summary) : undefined;
  }
  if (out.filesAnalyzed !== undefined) return `分析了 ${out.filesAnalyzed} 个文件`;
  if (typeof out.designDocument === 'string') return `设计方案（${out.designDocument.length}字）`;
  return undefined;
}

/** 可展开的子 Agent 执行卡片 — 支持自动折叠 */
const AgentTaskItem = memo(function AgentTaskItem({
  agent, status, progress, isRunning, result, index,
}: {
  agent: AgentPlanItem;
  status: string;
  progress: string | undefined;
  isRunning: boolean;
  result: TaskResult | undefined;
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const prevStatusRef = useRef(status);

  // 自动折叠：当状态从 running/pending 变为 completed/failed 时，自动收起
  useEffect(() => {
    const prev = prevStatusRef.current;
    if ((prev === 'running' || prev === 'pending') && (status === 'completed' || status === 'failed')) {
      // 短暂延迟后自动折叠，让用户能看到完成瞬间
      const timer = setTimeout(() => setExpanded(false), 800);
      prevStatusRef.current = status;
      return () => clearTimeout(timer);
    }
    // 运行中的自动展开
    if (status === 'running' && prev !== 'running') {
      setExpanded(true);
    }
    prevStatusRef.current = status;
  }, [status]);

  const outputSummary = extractOutputSummary(result);

  const statusIcon = status === 'completed' ? '\u2705'
    : status === 'failed' ? '\u274C'
    : isRunning ? '\uD83D\uDD35'
    : '\u25CB';

  const bgColor = status === 'completed' ? 'rgba(16,185,129,0.04)'
    : status === 'failed' ? 'rgba(239,68,68,0.04)'
    : isRunning ? 'rgba(59,130,246,0.06)'
    : 'rgba(107,114,128,0.02)';

  const borderColor = status === 'completed' ? 'rgba(16,185,129,0.2)'
    : status === 'failed' ? 'rgba(239,68,68,0.2)'
    : isRunning ? 'rgba(59,130,246,0.35)'
    : 'rgba(107,114,128,0.12)';

  const isCollapsed = !expanded && (status === 'completed' || status === 'failed' || status === 'pending');

  return (
    <div style={{
      background: bgColor,
      border: `1px solid ${borderColor}`,
      borderRadius: 6,
      overflow: 'hidden',
      transition: 'all 0.3s ease',
    }}>
      {/* 折叠行 / 展开头部 */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: isCollapsed ? '6px 10px' : '8px 10px',
          cursor: status !== 'pending' ? 'pointer' : 'default',
          userSelect: 'none',
        }}
        onClick={() => { if (status !== 'pending') setExpanded(!expanded); }}
      >
        {/* 序号 */}
        <span style={{
          width: 18, height: 18, borderRadius: '50%',
          background: AGENT_TYPE_COLORS[agent.type] ?? '#6b7280',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 9, fontWeight: 600, flexShrink: 0,
        }}>{index + 1}</span>

        {/* 类型标签 */}
        <span style={{
          background: (AGENT_TYPE_COLORS[agent.type] ?? '#6b7280') + '22',
          color: AGENT_TYPE_COLORS[agent.type] ?? '#6b7280',
          padding: '1px 5px', borderRadius: 3, fontSize: 9, fontWeight: 600,
          border: `1px solid ${(AGENT_TYPE_COLORS[agent.type] ?? '#6b7280')}44`,
        }}>{agent.type}</span>

        {/* 名称 + 描述 */}
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 500 }}>{agent.name}</span>
          {isCollapsed && (
            <span style={{ fontSize: 10, color: '#6b7280', marginLeft: 6 }}>
              {agent.description.slice(0, 50)}{agent.description.length > 50 ? '\u2026' : ''}
            </span>
          )}
        </span>

        {/* 状态信息 */}
        <span style={{ fontSize: 10, color: '#6b7280', flexShrink: 0 }}>
          {progress ?? (isRunning ? '等待中...' : '')}
        </span>
        <span style={{ fontSize: 12, flexShrink: 0 }}>{statusIcon}</span>

        {/* 展开/折叠箭头 */}
        {status !== 'pending' && (
          <span style={{
            fontSize: 10, color: '#6b7280', flexShrink: 0,
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 200ms',
          }}>{'\u25B6'}</span>
        )}
      </div>

      {/* 展开内容 */}
      {expanded && (
        <div style={{ padding: '0 10px 10px 10px' }}>
          {/* 目标描述 */}
          <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 6, lineHeight: 1.4 }}>
            <strong style={{ color: '#6b7280' }}>目标:</strong> {agent.description}
          </div>

          {/* 输出摘要 */}
          {outputSummary && (
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4, lineHeight: 1.4 }}>
              <strong style={{ color: '#6b7280' }}>输出:</strong> {outputSummary}
            </div>
          )}

          {/* 耗时 */}
          {result && (
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4 }}>
              <strong style={{ color: '#6b7280' }}>耗时:</strong> {result.duration}ms
            </div>
          )}

          {/* 使用的技能 */}
          {result?.skillsUsed && result.skillsUsed.length > 0 && (
            <div style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, color: '#6b7280' }}>{'\uD83E\uDDE9'} 技能:</span>
              {result.skillsUsed.map((s, i) => (
                <span key={i} style={{
                  background: 'rgba(59,130,246,0.1)', color: '#93c5fd',
                  padding: '1px 6px', borderRadius: 3, fontSize: 9,
                  border: '1px solid rgba(59,130,246,0.2)',
                }}>{(s as { name?: string }).name ?? String(s)}</span>
              ))}
            </div>
          )}

          {/* 子任务 */}
          {result?.subTasks && result.subTasks.length > 0 && (
            <div style={{ fontSize: 10, color: '#6b7280' }}>{'\uD83D\uDD27'} {result.subTasks.length} 个子任务</div>
          )}

          {/* 错误信息 */}
          {result?.error && (
            <div style={{
              fontSize: 9, color: '#fca5a5', background: 'rgba(239,68,68,0.08)',
              borderRadius: 4, padding: '4px 6px', marginTop: 6,
              lineHeight: 1.3,
            }}>{'\u26A0\uFE0F'} {result.error}</div>
          )}

          {/* 依赖关系 */}
          {agent.dependsOn && agent.dependsOn.length > 0 && (
            <div style={{ fontSize: 9, color: '#6b7280', marginTop: 4 }}>
              {'\uD83D\uDD17'} 依赖: {agent.dependsOn.join(', ')}
            </div>
          )}
        </div>
      )}

      {/* 运行中进度条 */}
      {isRunning && (
        <div style={{ height: 2, background: '#30363d' }}>
          <div style={{
            width: '60%', height: '100%',
            background: `linear-gradient(90deg, ${AGENT_TYPE_COLORS[agent.type] ?? '#3b82f6'}, transparent)`,
            animation: 'agent-progress-slide 1.5s ease-in-out infinite',
          }} />
        </div>
      )}
    </div>
  );
});

export function CEOAgentCard({
  phase, plan, taskResults, ceoSummary, strategy,
  completedCount = 0, totalCount = 0,
  onExecute, onEditPlan, onSaveAsTemplate,
  planConfirmed = false,
  style,
}: CEOAgentCardProps) {
  const lbl = PHASE_LABELS[phase];
  const scrollRef = useRef<HTMLDivElement>(null);

  // 自动滚动到最新的运行中 Agent
  useEffect(() => {
    if (phase === 'executing' && scrollRef.current) {
      const runningEl = scrollRef.current.querySelector('[data-running="true"]');
      if (runningEl) {
        runningEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [phase, taskResults]);

  const getAgentStatus = (agentId: string): string => {
    const result = taskResults?.find(r => r.taskId === agentId);
    if (!result) return 'pending';
    // _started 标记：onTaskStart 已触发，但 onTaskComplete 尚未回调 → 运行中
    if (result.output && typeof result.output === 'object' && (result.output as Record<string, unknown>)._started) {
      return 'running';
    }
    return result.success ? 'completed' : 'failed';
  };

  const getAgentProgress = (agentId: string): string | undefined => {
    const result = taskResults?.find(r => r.taskId === agentId);
    if (!result) return undefined;
    if (result.success) return `${result.duration}ms`;
    if (result.error) return result.error.slice(0, 50);
    return undefined;
  };

  const isActive = phase === 'executing' || phase === 'planning';

  return (
    <div style={{
      background: 'var(--bg-card, #161b22)',
      border: `1px solid ${isActive ? 'rgba(139,92,246,0.3)' : 'var(--border, #30363d)'}`,
      borderRadius: 8,
      marginBottom: 12,
      overflow: 'hidden',
      transition: 'all 0.3s',
      boxShadow: isActive ? '0 0 20px rgba(139,92,246,0.08)' : 'none',
      ...style,
    }}>
      {/* 阶段头部 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 14px',
        background: phase === 'executing' ? 'rgba(59,130,246,0.06)'
          : phase === 'planning' ? 'rgba(139,92,246,0.04)'
          : 'rgba(16,185,129,0.04)',
        borderBottom: '1px solid var(--border, #21262d)',
      }}>
        <span style={{ fontSize: 16 }}>{lbl.icon}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{lbl.title}</span>
        {phase === 'executing' && (
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#6b7280', fontWeight: 500 }}>
            {completedCount}/{totalCount} 完成
          </span>
        )}
        {phase === 'planning' && plan && (
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#8b5cf6', fontWeight: 500 }}>
            {plan.length} Agent
          </span>
        )}
      </div>

      <div style={{ padding: '10px 14px' }}>
        {/* 确认反馈条 */}
        {planConfirmed && phase === 'executing' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 10px', marginBottom: 8,
            background: 'rgba(16,185,129,0.08)',
            border: '1px solid rgba(16,185,129,0.2)',
            borderRadius: 5, fontSize: 11, color: '#34d399',
          }}>
            <span>{'\u2705'}</span>
            <span>计划已确认，开始执行 {totalCount} 个 Agent 任务...</span>
          </div>
        )}

        {/* 阶段一：规划列表 */}
        {phase === 'planning' && plan && (
          <>
            {strategy && (
              <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 8 }}>
                策略：<span style={{ color: '#c4b5fd', fontWeight: 500 }}>
                  {strategy === 'pipeline' ? '流水线' : strategy === 'parallel' ? '并行' : strategy === 'mixed' ? '混合' : strategy}
                </span>
                &nbsp;· {plan.length} 个 Agent 任务
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
                  {/* 依赖关系 */}
                  {agent.dependsOn && agent.dependsOn.length > 0 && (
                    <span style={{ fontSize: 9, color: '#6b7280' }} title={`依赖: ${agent.dependsOn.join(', ')}`}>
                      {'\uD83D\uDD17'}{agent.dependsOn.length}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
              {onExecute && (
                <button onClick={onExecute} style={{
                  padding: '5px 18px', borderRadius: 5, border: 'none',
                  background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
                  color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'inherit',
                }}>{'\u25B6'} 执行计划</button>
              )}
              {onEditPlan && (
                <button onClick={onEditPlan} style={{
                  padding: '5px 14px', borderRadius: 5, border: '1px solid rgba(255,255,255,0.15)',
                  background: '#374151', color: '#c9d1d9', fontSize: 11, cursor: 'pointer',
                  fontFamily: 'inherit',
                }}>{'\uD83D\uDCDD'} 审核调整</button>
              )}
              {onSaveAsTemplate && (
                <button onClick={onSaveAsTemplate} style={{
                  padding: '5px 14px', borderRadius: 5, border: '1px solid rgba(255,255,255,0.1)',
                  background: 'transparent', color: '#9ca3af', fontSize: 11, cursor: 'pointer',
                  fontFamily: 'inherit', marginLeft: 'auto',
                }}>{'\uD83D\uDCBE'} 保存为模板</button>
              )}
            </div>
          </>
        )}

        {/* 阶段二：执行进度 — 可折叠子Agent卡片列表 */}
        {phase === 'executing' && plan && (
          <div ref={scrollRef} style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 500, overflowY: 'auto' }}>
            {plan.map((agent, i) => {
              const status = getAgentStatus(agent.id);
              const progress = getAgentProgress(agent.id);
              const isRunning = status === 'running';
              const result = taskResults?.find(r => r.taskId === agent.id);
              return (
                <div key={agent.id} data-running={isRunning ? 'true' : undefined}>
                  <AgentTaskItem
                    agent={agent}
                    status={status}
                    progress={progress}
                    isRunning={isRunning}
                    result={result}
                    index={i}
                  />
                </div>
              );
            })}
            <style>{`
              @keyframes agent-progress-slide {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(200%); }
              }
            `}</style>
          </div>
        )}

        {/* 阶段三：CEO 总结 */}
        {phase === 'summary' && ceoSummary && (
          <div style={{
            fontSize: 12, color: 'var(--text-primary)',
            whiteSpace: 'pre-wrap', lineHeight: 1.7,
            fontFamily: "'JetBrains Mono', monospace",
            maxHeight: 400, overflowY: 'auto',
            padding: '4px 0',
          }}>
            {ceoSummary}
          </div>
        )}

        {/* 无计划时执行中占位 */}
        {phase === 'executing' && (!plan || plan.length === 0) && (
          <div style={{ fontSize: 11, color: '#6b7280', textAlign: 'center', padding: 12 }}>
            {'\u23F3'} 等待 Agent 任务...
          </div>
        )}
      </div>
    </div>
  );
}

export default CEOAgentCard;
