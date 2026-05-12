import { useState, useCallback, useRef, useEffect } from 'react';
import { dispatchGlobalPromptsWithDefaults } from '@/services/globalDispatchService';
import { dispatchExecutePromptAdapter } from '@/services/globalDispatchExecutor';
import { useMultiDispatchStore } from '@/stores/useMultiDispatchStore';
import { useTaskStore } from '@/stores/useTaskStore';
import type { DispatchResult } from '@/types/global-dispatch';
import type { Workspace } from '@/types/workspace';
import { getCEOAgent } from '@/services/multi-agent/ceo-agent/CEOAgent';
import { createTerminalExecutor } from '@/services/multi-agent/TerminalExecutor';
import { CEOAgentCard, type CEOPhase } from './CEOAgentCard';
import { LLMDecomposer, createLLMCall } from '@/services/multi-agent/ceo-agent/LLMDecomposer';
import { PlanConfirmModal } from '@/components/DAG/PlanConfirmModal';
import type { AgentPlanItem } from '@/types/multi-agent/ceo-agent';
import type { TaskResult } from '@/types/multi-agent/worker-agents';
import type { MarkdownCardData } from '@/stores/taskTypes';
import type { FlowDefinition } from '@/types/multi-agent/flow-definition';

export interface GlobalTerminalProps {
  workspaces: Workspace[];
}

type LoadingState = 'idle' | 'loading';

interface WorkspaceResultEntry {
  workspaceId: string;
  workspaceName: string;
  status: 'success' | 'partial' | 'failed';
  prompts: Array<{ prompt: string; status: 'success' | 'failed' | 'skipped'; reason?: string }>;
}

function buildAgentMarkdownCard(inputText: string, report: {
  summary: string;
  completedGoals: { description: string }[];
  missedGoals: { description: string }[];
  taskResults: TaskResult[];
  totalDuration: number;
  skillsUsed?: string[];
}): MarkdownCardData {
  const now = Date.now();
  const totalGoals = report.completedGoals.length + report.missedGoals.length;

  // 提取恢复记录
  const recoveries: Array<{ type: string; agentId: string; success: boolean }> = [];
  const grouped = new Map<string, TaskResult[]>();
  for (const r of report.taskResults) {
    const arr = grouped.get(r.taskId) || [];
    arr.push(r);
    grouped.set(r.taskId, arr);
  }
  for (const [taskId, results] of grouped) {
    const hasFailure = results.some(r => !r.success);
    const hasSuccess = results.some(r => r.success);
    if (hasFailure && hasSuccess) {
      recoveries.push({ type: 'retry', agentId: taskId, success: true });
    }
  }

  return {
    id: `agent-${now}`,
    queryId: `agent-${now}`,
    timestamp: now,
    query: inputText,
    analysis: [
      `### CEO 执行统计`,
      ``,
      `| 指标 | 值 |`,
      `|------|-----|`,
      `| 总目标数 | ${totalGoals} |`,
      `| 已完成 | ${report.completedGoals.length} |`,
      `| 未完成 | ${report.missedGoals.length} |`,
      `| 总耗时 | ${report.totalDuration}ms |`,
    ].join('\n'),
    summary: report.summary,
    completeSummary: report.summary,
    variant: 'agent',
    agentReport: {
      totalGoals,
      completedGoals: report.completedGoals.length,
      missedGoals: report.missedGoals.length,
      duration: report.totalDuration,
      skillsUsed: (report.skillsUsed ?? []).map((s: string) => ({ name: s, domain: 'general' })),
      recoveries,
    },
  };
}

// ── StatusBadge ─────────────────────────────────────────────────
function StatusBadge({ status }: { status: 'success' | 'partial' | 'failed' }) {
  const cfg = {
    success: { label: '成功', bg: 'var(--success-bg)', color: 'var(--success)', borderColor: 'var(--success)' },
    partial: { label: '部分', bg: 'var(--warn-bg)', color: 'var(--warn)', borderColor: 'var(--warn)' },
    failed: { label: '失败', bg: 'var(--error-bg)', color: 'var(--error)', borderColor: 'var(--error)' },
  }[status];

  const icons = {
    success: <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="3" fill="none" />,
    partial: <path d="M5 12h14" stroke="currentColor" strokeWidth="3" fill="none" />,
    failed: <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="3" fill="none" />,
  }[status];

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '1px 8px', borderRadius: 10, fontSize: 11, fontWeight: 500,
      background: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.borderColor}`, borderLeftWidth: 3,
      verticalAlign: 'middle', marginLeft: 8,
    }}>
      <svg width="10" height="10" viewBox="0 0 24 24">{icons}</svg>
      {cfg.label}
    </span>
  );
}

// ── PromptStatus ───────────────────────────────────────────────
function PromptStatus({ status }: { status: 'success' | 'failed' | 'skipped' }) {
  const cfg = {
    success: { label: '[成功]', color: 'var(--success)' },
    failed: { label: '[失败]', color: 'var(--error)' },
    skipped: { label: '[跳过]', color: 'var(--text-muted)' },
  }[status];
  return <span style={{ minWidth: 64, flexShrink: 0, fontWeight: 500, color: cfg.color }}>{cfg.label}</span>;
}

export function GlobalTerminal({ workspaces }: GlobalTerminalProps) {
  const [input, setInput] = useState('');
  const [createNewSession, setCreateNewSession] = useState(false);
  const [multiAgentMode, setMultiAgentMode] = useState(false);
  const [loading, setLoading] = useState<LoadingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<WorkspaceResultEntry[] | null>(null);
  const [textareaFocused, setTextareaFocused] = useState(false);
  const abortRef = useRef<boolean>(false);
  const [ceoPhase, setCeoPhase] = useState<CEOPhase>('planning');
  const [ceoPlan, setCeoPlan] = useState<AgentPlanItem[]>([]);
  const [ceoStrategy, setCeoStrategy] = useState<string>('');
  const [ceoTaskResults, setCeoTaskResults] = useState<TaskResult[]>([]);
  const [ceoSummary, setCeoSummary] = useState<string>('');
  const [ceoCompletedCount, setCeoCompletedCount] = useState(0);
  const [ceoTotalCount, setCeoTotalCount] = useState(0);
  const [planMode, setPlanMode] = useState<'auto' | 'confirm'>('auto');
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [pendingInput, setPendingInput] = useState('');

  // 编排模式：终端打开时从 localStorage 加载预定义 Flow 拓扑
  const orchestrationFlowRef = useRef<FlowDefinition | null>(null);
  useEffect(() => {
    try {
      const stored = localStorage.getItem('cc-agent-orchestration-flow');
      if (stored) {
        orchestrationFlowRef.current = JSON.parse(stored) as FlowDefinition;
      } else {
        orchestrationFlowRef.current = null;
      }
    } catch {
      orchestrationFlowRef.current = null;
    }
  }, []);

  const handleSend = useCallback(async () => {
    if (!input.trim() || loading === 'loading') return;

    const rawInput = input.trim();
    const hasAgentPrefix = rawInput.startsWith('/agent ')
      || rawInput === '/agent'
      || rawInput.startsWith('/agent\n');
    const cleanInput = hasAgentPrefix
      ? rawInput.replace(/^\/agent(?:\s+|\n)?/, '').trim()
      : rawInput;
    const shouldUseAgentMode = multiAgentMode || hasAgentPrefix;

    if (shouldUseAgentMode && !cleanInput) {
      setError('请输入 /agent 后要执行的任务内容');
      return;
    }

    setLoading('loading');
    setError(null);
    setResults(null);
    abortRef.current = false;

    try {
      // 多代理模式：通过 CEO Agent + LLMDecomposer 分解目标并执行
      if (shouldUseAgentMode) {
        try {
          const decomposer = new LLMDecomposer({ llmAvailable: true, llmCall: createLLMCall() });

          // 阶段一：规划
          setCeoPhase('planning');
          // 使用 decompose() 而非 decomposeWithRules() —— LLM 在线时走 LLM，不可用时自动降级
          const plan = await decomposer.decompose(cleanInput);
          setCeoPlan(plan.agents);
          setCeoStrategy(plan.strategy);
          setCeoTotalCount(plan.agents.length);
          setPendingInput(cleanInput);

          if (planMode === 'confirm') {
            // 计划确认模式：弹出弹窗等待用户确认
            setShowPlanModal(true);
            setLoading('idle');
            return;
          }

          // 自动模式：直接执行
          const ceo = getCEOAgent({ maxIterations: 3 });
          const executor = createTerminalExecutor(workspaces);
          ceo.setDecomposer(decomposer);
          // 注入编排配置（编排模式 vs 独立模式）
          if (orchestrationFlowRef.current) {
            ceo.setOrchestrationFlow(orchestrationFlowRef.current);
          } else {
            ceo.clearOrchestrationFlow();
          }
          // 注入工作区信息，供 ContextAgent / PlanningAgent 获取项目路径
          if (workspaces.length > 0) {
            ceo.setWorkspace(workspaces[0].id, workspaces[0].workspacePath);
          }

          setCeoPhase('executing');
          setCeoCompletedCount(0);
          setCeoTaskResults([]);

          const report = await ceo.processWithDecomposer(cleanInput, executor, {
            plan,
            onTaskStart: (taskId) => {
              setCeoTaskResults(prev => [...prev, {
                taskId, workerType: 'execution',
                output: null, success: false,
                duration: 0, skillsUsed: [], subTasks: [],
              }]);
            },
            onTaskComplete: (result) => {
              setCeoTaskResults(prev => prev.map(r =>
                r.taskId === result.taskId ? result : r
              ));
              setCeoCompletedCount(prev => prev + 1);
            },
          });

          // 阶段三：总结
          setCeoPhase('summary');
          setCeoSummary(report.summary);
          useTaskStore.getState().addMarkdownCard(buildAgentMarkdownCard(cleanInput, report));

          setLoading('idle');
          setInput('');
        } catch (error) {
          setError(error instanceof Error ? error.message : '多代理执行失败');
          setLoading('idle');
        }
        return;
      }

      // 普通模式：使用原有的 dispatch 流程
      const result: DispatchResult = await dispatchGlobalPromptsWithDefaults({
        rawInput: input,
        createNewSession,
        executePrompt: dispatchExecutePromptAdapter,
      });

      if (abortRef.current) return;

      const workspaceMap = new Map(workspaces.map(w => [w.id, w]));
      const mappedResults = result.workspaceResults.map(wr => ({
        workspaceId: wr.workspaceId,
        workspaceName: workspaceMap.get(wr.workspaceId)?.name ?? wr.workspaceId,
        status: wr.status,
        prompts: wr.promptResults.map(pr => ({
          prompt: pr.prompt,
          status: pr.status,
          reason: pr.reason,
        })),
      }));
      setResults(mappedResults);

      // 更新 store，触发 GlobalAgentTrigger 显示分析按钮
      useMultiDispatchStore.getState().setBatchResult(result.workspaceResults);
      useMultiDispatchStore.getState().setBatchId(result.batchId);
      useMultiDispatchStore.getState().setAllCompleted(true);
      useMultiDispatchStore.getState().setActive(true);
    } catch (err) {
      if (abortRef.current) return;
      setError(err instanceof Error ? err.message : 'Dispatch failed');
    } finally {
      if (!abortRef.current) setLoading('idle');
    }
  }, [input, createNewSession, multiAgentMode, planMode, loading, workspaces]);

  // CEO Agent 计划确认后的执行函数
  const executeCEOPlan = useCallback(async (inputText: string, _agents?: AgentPlanItem[]) => {
    setLoading('loading');
    setShowPlanModal(false);
    try {
      const ceo = getCEOAgent({ maxIterations: 3 });
      const executor = createTerminalExecutor(workspaces);
      const decomposer = new LLMDecomposer({ llmAvailable: true, llmCall: createLLMCall() });
      ceo.setDecomposer(decomposer);
      // 注入编排配置（编排模式 vs 独立模式）
      if (orchestrationFlowRef.current) {
        ceo.setOrchestrationFlow(orchestrationFlowRef.current);
      } else {
        ceo.clearOrchestrationFlow();
      }
      // 注入工作区信息
      if (workspaces.length > 0) {
        ceo.setWorkspace(workspaces[0].id, workspaces[0].workspacePath);
      }

      const plan = await decomposer.decompose(inputText);
      setCeoPlan(plan.agents);
      setCeoStrategy(plan.strategy);
      setCeoTotalCount(plan.agents.length);

      setCeoPhase('executing');
      setCeoCompletedCount(0);
      setCeoTaskResults([]);

      const report = await ceo.processWithDecomposer(inputText, executor, {
        plan,
        onTaskStart: (taskId) => {
          setCeoTaskResults(prev => [...prev, {
            taskId, workerType: 'execution',
            output: null, success: false,
            duration: 0, skillsUsed: [], subTasks: [],
          }]);
        },
        onTaskComplete: (result) => {
          setCeoTaskResults(prev => prev.map(r =>
            r.taskId === result.taskId ? result : r
          ));
          setCeoCompletedCount(prev => prev + 1);
        },
      });

      setCeoPhase('summary');
      setCeoSummary(report.summary);
      useTaskStore.getState().addMarkdownCard(buildAgentMarkdownCard(inputText, report));
      setInput('');
    } catch (error) {
      setError(error instanceof Error ? error.message : '多代理执行失败');
    } finally {
      setLoading('idle');
    }
  }, [workspaces]);

  const handlePlanConfirm = useCallback((agents: AgentPlanItem[]) => {
    setCeoPlan(agents);
    setCeoTotalCount(agents.length);
    executeCEOPlan(pendingInput, agents);
  }, [executeCEOPlan, pendingInput]);

  const handlePlanCancel = useCallback(() => {
    setShowPlanModal(false);
    setCeoPhase('planning');
    setCeoPlan([]);
    setPendingInput('');
  }, []);

  const handleSaveAsTemplate = useCallback((_agents: AgentPlanItem[]) => {
    // TODO: 保存到 V3 FlowBuilder 模板库
    console.log('[GlobalTerminal] Save as template:', _agents);
    setShowPlanModal(false);
  }, []);

  const handleClear = useCallback(() => {
    setInput('');
    setResults(null);
    setError(null);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  const isLoading = loading === 'loading';
  const hasContent = input.trim().length > 0;

  const textareaStyle = textareaFocused
    ? {
        background: 'var(--bg-input)', border: '1px solid var(--accent)',
        borderRadius: 8, padding: '10px 12px', color: 'var(--text-primary)',
        outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s',
        minHeight: 120, width: '100%', resize: 'vertical' as const, fontFamily: 'monospace', fontSize: '13px',
        boxShadow: '0 0 0 3px color-mix(in srgb, var(--accent) 15%, transparent)',
      }
    : {
        background: 'var(--bg-input)', border: '1px solid var(--border)',
        borderRadius: 8, padding: '10px 12px', color: 'var(--text-primary)',
        outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s',
        minHeight: 120, width: '100%', resize: 'vertical' as const, fontFamily: 'monospace', fontSize: '13px',
      };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
      {/* 输入区 */}
      <textarea
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setTextareaFocused(true)}
        onBlur={() => setTextareaFocused(false)}
        placeholder="输入 prompt（多行视为 list 模式）"
        rows={5}
        disabled={isLoading}
        aria-label="Prompt 输入框"
        style={textareaStyle}
      />

      {/* 控制行 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' as const }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' as const }}>
          <input
            type="checkbox"
            checked={createNewSession}
            onChange={e => setCreateNewSession(e.target.checked)}
            disabled={isLoading}
            aria-label="新建会话"
          />
          新建会话
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', userSelect: 'none' as const }}>
          <div
            onClick={() => !isLoading && setMultiAgentMode(!multiAgentMode)}
            style={{
              position: 'relative' as const,
              width: 36,
              height: 20,
              borderRadius: 10,
              background: multiAgentMode ? 'var(--accent)' : 'var(--border)',
              transition: 'background 0.2s',
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            <div style={{
              position: 'absolute' as const,
              top: 2,
              left: multiAgentMode ? 18 : 2,
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: 'white',
              transition: 'left 0.2s',
            }} />
          </div>
          <span style={{ color: multiAgentMode ? 'var(--accent)' : 'var(--text-secondary)' }}>
            多代理
          </span>
        </label>
        {/* 计划模式切换（仅多代理模式显示） */}
        {multiAgentMode && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, marginLeft: 8 }}>
            <span style={{ color: 'var(--text-secondary)' }}>计划：</span>
            <select
              value={planMode}
              onChange={e => setPlanMode(e.target.value as 'auto' | 'confirm')}
              style={{
                background: '#161b22', color: '#c9d1d9', border: '1px solid #30363d',
                borderRadius: 4, padding: '2px 6px', fontSize: 11, cursor: 'pointer',
              }}
            >
              <option value="auto">自动执行</option>
              <option value="confirm">确认后执行</option>
            </select>
          </label>
        )}
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {workspaces.length} 个工作区
        </span>
      </div>

      {/* 操作按钮 */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleSend}
          disabled={!hasContent || isLoading}
          onMouseEnter={e => { if (hasContent && !isLoading) e.currentTarget.style.background = 'var(--accent-dim)'; }}
          onMouseLeave={e => { if (hasContent && !isLoading) e.currentTarget.style.background = 'var(--accent)'; }}
          style={{
            background: hasContent && !isLoading ? 'var(--accent)' : 'var(--border)',
            color: hasContent && !isLoading ? 'white' : 'var(--text-muted)',
            border: 'none', padding: '7px 18px', borderRadius: 6,
            fontSize: 12, fontWeight: 500, cursor: hasContent && !isLoading ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit', transition: 'background 0.2s',
          }}
        >
          {isLoading ? '执行中…' : '发送'}
        </button>
        <button
          onClick={handleClear}
          disabled={isLoading}
          onMouseEnter={e => {
            if (!isLoading) {
              e.currentTarget.style.background = 'var(--bg-input)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }
          }}
          onMouseLeave={e => {
            if (!isLoading) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted)';
            }
          }}
          style={{
            background: 'transparent', color: 'var(--text-muted)',
            border: '1px solid var(--border)', padding: '7px 16px', borderRadius: 6,
            fontSize: 12, cursor: isLoading ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', transition: 'all 0.2s',
          }}
        >
          清空
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div role="alert" style={{
          background: 'var(--error-bg)', border: '1px solid var(--error-border)',
          borderRadius: 6, padding: '8px 12px', fontSize: 13, color: 'var(--error)',
        }}>
          {error}
        </div>
      )}

      {/* CEO Agent 阶段卡片 — 三阶段全部可见 */}
      {multiAgentMode && (
        <div style={{ padding: '10px 14px 0' }}>
          <CEOAgentCard
            phase={ceoPhase}
            plan={ceoPlan}
            taskResults={ceoTaskResults}
            ceoSummary={ceoSummary}
            strategy={ceoStrategy}
            completedCount={ceoCompletedCount}
            totalCount={ceoTotalCount}
            onExecute={ceoPhase === 'planning' ? () => executeCEOPlan(pendingInput, ceoPlan) : undefined}
            onEditPlan={ceoPhase === 'planning' ? () => {
              setPlanMode('confirm');
              setShowPlanModal(true);
            } : undefined}
          />
        </div>
      )}

      {/* 结果展示 */}
      {results !== null && results.length > 0 && (
        <div>
          <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0 8px' }} />
          <strong style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 8 }}>
            执行结果
          </strong>
          {results.map(entry => (
            <div key={entry.workspaceId} style={{
              border: '1px solid var(--border)', borderRadius: 8,
              background: 'var(--bg-card)', padding: 12, marginBottom: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', marginBottom: 8 }}>
                {entry.workspaceName}
                <StatusBadge status={entry.status} />
              </div>
              {entry.prompts.map((p, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  fontSize: 13, marginTop: 4, fontFamily: 'monospace', lineHeight: 1.5,
                }}>
                  <PromptStatus status={p.status} />
                  <span style={{ color: 'var(--text-primary)', wordBreak: 'break-word' as const }}>{p.prompt}</span>
                  {p.reason && (
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>({p.reason})</span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* 计划确认弹窗 */}
      {showPlanModal && (
        <PlanConfirmModal
          agents={ceoPlan}
          strategy={ceoStrategy}
          onConfirm={handlePlanConfirm}
          onCancel={handlePlanCancel}
          onSaveAsTemplate={handleSaveAsTemplate}
        />
      )}
    </div>
  );
}
