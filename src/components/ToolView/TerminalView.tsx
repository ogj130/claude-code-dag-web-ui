import { useEffect, useRef, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTaskStore } from '../../stores/useTaskStore';
import type { MarkdownCardData } from '../../stores/taskTypes';
import { useRAGContext } from '../../hooks/useRAGContext';
import type { RAGContextItem } from '../../hooks/useRAGContext';
import { MarkdownCard } from './MarkdownCard';
import { LiveCard } from './LiveCard';
import { useHistoryRecall } from '../../hooks/useHistoryRecall';
import { useWorkspaceFilter } from '../../hooks/useWorkspaceFilter';
// V1.4.1: Attachment components
import { AttachmentButton, AttachmentPreviewStrip, AttachmentDetailPanel, AttachmentPreviewModal, TerminalAttachmentSection } from '../Attachment';
import { useFileUpload } from '../../hooks/useFileUpload';
import { useAttachmentStore, usePendingAttachments } from '../../stores/useAttachmentStore';
import type { PendingAttachment } from '../../types/attachment';
// Task 5: Upper/lower split
import { WorkspaceTagBar } from './WorkspaceTagBar';
import { StatusBar } from './StatusBar';
import { RecallPanel } from './RecallPanel';
import { GlobalSummaryPanel } from './GlobalSummaryPanel';
import { useTerminalWorkspaceStore } from '../../stores/useTerminalWorkspaceStore';
import { useMultiDispatchStore } from '../../stores/useMultiDispatchStore';
import { getEnabledPresets } from '../../stores/workspacePresetStorage';
import type { Workspace } from '../../types/workspace';
import { getCEOAgent } from '@/services/multi-agent/ceo-agent/CEOAgent';
import { LLMDecomposer, createLLMCall } from '@/services/multi-agent/ceo-agent/LLMDecomposer';
import { createTerminalExecutor } from '@/services/multi-agent/TerminalExecutor';
import type { AgentPlan } from '@/types/multi-agent/ceo-agent';
import type { TaskResult } from '@/types/multi-agent/worker-agents';
import type { FlowDefinition } from '@/types/multi-agent/flow-definition';
import { PlanConfirmModal } from '@/components/DAG/PlanConfirmModal';
import { CEOAgentCard, type CEOPhase } from '@/components/GlobalTerminal/CEOAgentCard';
import { WelcomePage } from '@/components/Welcome/WelcomePage';

interface Props {
  theme: 'dark' | 'light';
  onInput?: (input: string) => boolean | void;
  style?: React.CSSProperties;
}

// ── 神里绫华角色 Prompt ─────────────────────────────────────
const AYAKA_PERSONA = `[回复风格]
请以神里绫华（原神社奉行大小姐）的口吻回复，自称"本小姐"，称呼用户为"你"。保持优雅温柔的语调，偶尔用剑道或花道的比喻，句末偶尔加"~"表示轻松语气。

[最重要原则]
你的首要目标是准确、完整地回答用户的问题。绫华的语气只是让回答更亲切的风格包装，绝不能因为角色扮演而忽略或弱化实际内容。先确保信息正确，再考虑措辞。

[简短规则]
- 代码、技术解释、步骤说明等内容要专业严谨
- 用"~"、"本小姐"、"你这笨蛋"（仅限轻松调侃）点缀，但不要泛滥
- 长回答中，技术段落保持专业，开头结尾可带角色语气
- 不要每一句都强行角色扮演，技术密集时自然一些`;

export function TerminalView({ theme: _theme, onInput, style }: Props) {
  const [inputValue, setInputValue] = useState('');
  /** 本次发送的 query 文本（用于在上方分离显示） */
  const [pendingQueryText, setPendingQueryText] = useState('');
  /** 本次发送的 RAG chunks（用于在上方分离显示） */
  const [pendingRAGChunks, setPendingRAGChunks] = useState<RAGContextItem[]>([]);
  // V1.4.1: Attachment preview modal state
  const [previewAttachment, setPreviewAttachment] = useState<PendingAttachment | null>(null);
  // V1.4.1: Sent attachments for current query
  const [sentAttachments, setSentAttachments] = useState<PendingAttachment[]>([]);
  // Multi-Agent mode toggle
  const [agentMode, setAgentMode] = useState(false);
  // 计划确认模式 (planMode)
  const [planMode, setPlanMode] = useState<'auto' | 'confirm'>('auto');
  const [showPlanConfirm, setShowPlanConfirm] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<AgentPlan | null>(null);
  const [pendingCleanInput, setPendingCleanInput] = useState('');
  // Agent 执行状态（用于 CEOAgentCard 展示，替代 xterm 原始输出）
  const [ceoPhase, setCeoPhase] = useState<CEOPhase>('planning');
  const [ceoPlan, setCeoPlan] = useState<AgentPlan['agents']>([]);
  const [ceoStrategy, setCeoStrategy] = useState('');
  const [ceoTaskResults, setCeoTaskResults] = useState<TaskResult[]>([]);
  const [ceoSummary, setCeoSummary] = useState('');
  const [ceoCompletedCount, setCeoCompletedCount] = useState(0);
  const [ceoTotalCount, setCeoTotalCount] = useState(0);
  const [planConfirmed, setPlanConfirmed] = useState(false);
  const [agentExecuting, setAgentExecuting] = useState(false);

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

  // 监听编排画布事件：打开终端并切换到 Agent + Plan 确认模式
  useEffect(() => {
    const handler = () => {
      setAgentMode(true);
      setPlanMode('confirm');
    };
    window.addEventListener('cc-open-terminal-with-orchestration', handler);
    return () => window.removeEventListener('cc-open-terminal-with-orchestration', handler);
  }, []);

  // Task 5: Upper/lower split state
  const [workspaceList, setWorkspaceList] = useState<Workspace[]>([]);
  const {
    activeWorkspaceId,
    setActiveWorkspace,
    isGlobalSummaryExpanded,
    collapseGlobalSummary,
    runningWorkspaces,
  } = useTerminalWorkspaceStore();

  const activeTab = useTerminalWorkspaceStore(s => s.activeTab);
  const workspaceTabs = useTerminalWorkspaceStore(s => s.workspaceTabs);
  const isGlobalView = activeTab === 'global';

  // Task 7: Connect batchResult for GlobalSummaryPanel
  const batchResult = useMultiDispatchStore(s => s.batchResult);
  const requestAnalysis = useMultiDispatchStore(s => s.requestAnalysis);

  // Task 2.1: Global terminal store (keep import, mergedOrder no longer displayed inline)

  // V1.4.1: File upload hook
  const { handleFileSelect, handleRemoveAttachment, handleClearAll, getReadyAttachments } = useFileUpload();
  const { setPreviewExpanded } = useAttachmentStore();
  const pendingAttachments = usePendingAttachments();
  const {
    isStarting,
    isRunning,
    error,
    tokenUsage,
    pendingInputsCount = 0,
    collapsedCardIds,
    summaryChunks,
  } = useTaskStore();

  // ── V3.0.0: 工作区隔离 — 非全局视图时过滤卡片 ──
  const { markdownCards, currentCard, previousCard } = useWorkspaceFilter();

  // 历史召回 Hook
  const {
    state: recallState,
    onInputChange,
    onToolError,
    dismissSimilarHint,
    dismissErrorHint,
  } = useHistoryRecall({ debounceMs: 250, similarityThreshold: 0.8, maxResults: 4 });

  // 监听 toolCalls 错误以触发错误解决方案推荐
  const prevToolCallsRef = useRef(0);
  useEffect(() => {
    if (recallState.isIndexing) return;
    const toolCalls = useTaskStore.getState().toolCalls;
    if (toolCalls.length > prevToolCallsRef.current) {
      const lastCall = toolCalls[toolCalls.length - 1];
      if (lastCall.status === 'error' && lastCall.result) {
        onToolError(String(lastCall.result));
      }
    }
    prevToolCallsRef.current = toolCalls.length;
  });

  // 输入变化时触发召回
  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);
    onInputChange(value);
  }, [onInputChange]);

  // 点击推荐项时填充输入框
  const handleApplyRecall = useCallback((query: string) => {
    setInputValue(query);
    onInputChange(query);
  }, [onInputChange]);

  // Task 5: Load enabled workspaces on mount
  useEffect(() => {
    getEnabledPresets().then(presets => {
      const wsList: Workspace[] = presets.map(p => ({
        id: p.id,
        name: p.name || p.workspacePath.split('/').pop() || '未命名',
        workspacePath: p.workspacePath,
        modelConfigId: p.configId || '',
        enabled: p.isEnabled,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      }));
      setWorkspaceList(wsList);
      // Default to first workspace
      if (wsList.length > 0 && !activeWorkspaceId) {
        setActiveWorkspace(wsList[0].id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 外部文本框按 Enter 时发送
  const { getPromptContext, items: ragItems } = useRAGContext();

  // V1.4.1: Handle preview modal
  const handlePreviewAttachment = useCallback((attachment: PendingAttachment) => {
    setPreviewAttachment(attachment);
  }, []);

  // V1.4.1: Handle send with attachments
  const handleSendWithAttachments = useCallback(async () => {
    const text = inputValue.trim();
    if (!text && pendingAttachments.length === 0) return;

    // ── Agent 前缀检测 ───────────────────────────────────────
    const isAgentPrefix = text.startsWith('/agent');
    const cleanInput = isAgentPrefix ? text.replace(/^\/agent\s*/, '').trim() : text;

    // ── Multi-Agent 模式路由 ─────────────────────────────────
    if (agentMode || isAgentPrefix) {
      if (!cleanInput) return;

      // 注入绫华角色设定（仅 LLM 调用使用，UI 显示用原始 cleanInput）
      const agentInput = AYAKA_PERSONA + '\n\n[用户任务]\n' + cleanInput;

      // 清空输入框
      setInputValue('');

      // 重置 Agent 状态
      setCeoPhase('planning');
      setCeoPlan([]);
      setCeoTaskResults([]);
      setCeoSummary('');
      setCeoCompletedCount(0);
      setCeoTotalCount(0);
      setPlanConfirmed(false);
      setAgentExecuting(true);

      try {
        const ceoAgent = getCEOAgent({ maxIterations: 3, autoSkillLoad: true });
        const executor = createTerminalExecutor(workspaceList);
        const decomposer = new LLMDecomposer({ llmAvailable: true, llmCall: createLLMCall() });
        ceoAgent.setDecomposer(decomposer);
        if (workspaceList.length > 0) {
          ceoAgent.setWorkspace(workspaceList[0].id, workspaceList[0].workspacePath);
        }
        if (orchestrationFlowRef.current) {
          ceoAgent.setOrchestrationFlow(orchestrationFlowRef.current);
        } else {
          ceoAgent.clearOrchestrationFlow();
        }

        const plan = await decomposer.decompose(agentInput);
        setCeoPlan(plan.agents);
        setCeoStrategy(plan.strategy);
        setCeoTotalCount(plan.agents.length);

        if (planMode === 'confirm') {
          setPendingPlan(plan);
          setPendingCleanInput(agentInput);
          setShowPlanConfirm(true);
          return;
        }

        setCeoPhase('executing');
        setCeoCompletedCount(0);
        setCeoTaskResults([]);
        setPlanConfirmed(true);

        const report = await ceoAgent.processWithDecomposer(agentInput, executor, {
          plan,
          onTaskStart: (taskId) => {
            setCeoTaskResults(prev => [...prev, {
              taskId, workerType: 'execution',
              output: null, success: false,
              duration: 0, skillsUsed: [], subTasks: [],
            }]);
            try {
              const planAgent = plan.agents.find(a => a.id === taskId);
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (useTaskStore.getState().handleEvent as any)({
                type: 'agent_start',
                agentId: taskId,
                label: planAgent?.name ?? taskId,
                parentId: 'main-agent',
                agentType: planAgent?.type ?? 'execution',
                taskDescription: planAgent?.description ?? '',
              });
            } catch { /* 静默忽略 */ }
          },
          onTaskComplete: (result) => {
            setCeoTaskResults(prev => prev.map(r =>
              r.taskId === result.taskId ? result : r
            ));
            setCeoCompletedCount(prev => prev + 1);
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (useTaskStore.getState().handleEvent as any)({
                type: 'agent_end',
                agentId: result.taskId,
                toolMessage: result.error,
                duration: result.duration,
                skillsUsed: result.skillsUsed,
              });
            } catch { /* 静默忽略 */ }
          },
        });

        setCeoPhase('summary');
        setCeoSummary(report.summary);
        setAgentExecuting(false);

        const agentCard: MarkdownCardData = {
          id: `agent-${Date.now()}`,
          queryId: `agent-${Date.now()}`,
          timestamp: Date.now(),
          query: cleanInput,
          analysis: [
            `### CEO 执行统计`,
            ``,
            `| 指标 | 值 |`,
            `|------|-----|`,
            `| 总目标数 | ${report.completedGoals.length + report.missedGoals.length} |`,
            `| 已完成 | ${report.completedGoals.length} |`,
            `| 未完成 | ${report.missedGoals.length} |`,
            `| 总耗时 | ${report.totalDuration}ms |`,
          ].join('\n'),
          summary: report.summary,
          completeSummary: report.summary,
          variant: 'agent' as const,
          agentReport: {
            totalGoals: report.completedGoals.length + report.missedGoals.length,
            completedGoals: report.completedGoals.length,
            missedGoals: report.missedGoals.length,
            duration: report.totalDuration,
            skillsUsed: (report.skillsUsed ?? []).map((s: string) => ({ name: s, domain: 'general' })),
            recoveries: (() => {
              const grouped = new Map<string, import('@/types/multi-agent/worker-agents').TaskResult[]>();
              for (const r of report.taskResults) {
                const arr = grouped.get(r.taskId) || [];
                arr.push(r);
                grouped.set(r.taskId, arr);
              }
              const recovered: Array<{ type: string; agentId: string; success: boolean }> = [];
              for (const [taskId, results] of grouped) {
                const hasFailure = results.some(r => !r.success);
                const hasSuccess = results.some(r => r.success);
                if (hasFailure && hasSuccess) {
                  recovered.push({ type: 'retry', agentId: taskId, success: true });
                }
              }
              return recovered;
            })(),
          },
          workspaceId: (() => {
            const termTab = useTerminalWorkspaceStore.getState().activeTab;
            return termTab !== 'global' ? termTab : undefined;
          })(),
        };

        useTaskStore.getState().addMarkdownCard(agentCard);

      } catch (error) {
        setAgentExecuting(false);
        setCeoPhase('summary');
        const errMsg = error instanceof Error ? error.message : String(error);
        setCeoSummary(`执行失败: ${errMsg}`);

        // 推送错误卡片到对话框，确保用户能看到失败反馈
        const errorCard: MarkdownCardData = {
          id: `agent-error-${Date.now()}`,
          queryId: `agent-error-${Date.now()}`,
          timestamp: Date.now(),
          query: cleanInput,
          analysis: `### Agent 执行失败\n\n\`\`\`\n${errMsg}\n\`\`\``,
          summary: 'Agent 执行出错，请检查配置后重试。',
          completeSummary: 'Agent 执行出错，请检查配置后重试。',
          variant: 'agent' as const,
        };
        useTaskStore.getState().addMarkdownCard(errorCard);
      }
      return;
    }

    // 先清空输入框
    setInputValue('');

    // 获取附件
    const readyAttachments = getReadyAttachments();

    // ── 构造 payload（绫华角色作为独立字段，不污染 query）─────
    const payload: Record<string, unknown> = {
      query: text,
      systemPrompt: AYAKA_PERSONA,
    };
    if (ragItems.length > 0) {
      payload.ragChunks = ragItems;
    }

    // V1.4.1: 添加附件信息到 payload
    if (readyAttachments.length > 0) {
      payload.attachments = readyAttachments.map(att => ({
        type: att.type,
        mimeType: att.mimeType,
        fileName: att.fileName,
        imageData: att.imageData,
        textContent: att.textContent,
      }));

      // V1.4.1: 同步到 TaskStore（保留完整数据用于预览，仅 payload 不发送 textContent）
      useTaskStore.getState().setPendingAttachments(readyAttachments.map((att) => ({
        id: att.id,
        type: att.type,
        mimeType: att.mimeType,
        fileName: att.fileName,
        fileSize: att.fileSize,
        thumbnailData: att.thumbnailData,
        imageData: att.imageData,
        textContent: att.textContent,
        textPreview: att.textPreview,
      })));

      // 显示发送的附件（终端中）
      setSentAttachments([...readyAttachments]);
    }

    // ── 设置 pending RAG 状态 ────────────────────────────────
    if (ragItems.length > 0) {
      useTaskStore.getState().setPendingRAGItems(
        ragItems.map(item => ({
          id: item.id,
          content: item.content,
          summary: item.summary,
          score: item.score,
          sourceSessionId: item.sourceSessionId,
          sourceSessionTitle: item.sourceSessionTitle,
          timestamp: item.timestamp,
        }))
      );
      setPendingQueryText(text);
      setPendingRAGChunks([...ragItems]);
    }

    // 获取 RAG 上下文
    const ragContext = getPromptContext();
    const finalPayload = ragContext
      ? `${ragContext}用户问题：${JSON.stringify(payload)}`
      : JSON.stringify(payload);

    // 发送消息
    try {
      const sent = onInput?.(finalPayload);
      if (sent === false) {
        // sendInput 返回 false 表示 WS 未 OPEN（正在连接中或已关闭）
        // 消息已自动加入重连队列，稍后会自动发送
      } else {
        // 清除 RAG 上下文
        if (ragItems.length > 0) {
          useRAGContext.getState().clearAll();
          setTimeout(() => {
            setPendingQueryText('');
            setPendingRAGChunks([]);
          }, 3000);
        }

        // V1.4.1: 清除已发送的附件
        if (readyAttachments.length > 0) {
          handleClearAll();
          // 3秒后清除终端中的附件显示
          setTimeout(() => {
            setSentAttachments([]);
          }, 3000);
        }
      }
    } catch (err) {
      console.error('[TerminalView] Send error:', err);
    }
  }, [inputValue, pendingAttachments, markdownCards, ragItems, getPromptContext, getReadyAttachments, handleClearAll, onInput, agentMode, planMode, workspaceList]);

  // CEO Agent 计划确认后的执行函数
  const executeCEOPlan = useCallback(async (inputText: string, plan: AgentPlan) => {
    setCeoPhase('executing');
    setCeoPlan(plan.agents);
    setCeoStrategy(plan.strategy);
    setCeoTotalCount(plan.agents.length);
    setCeoCompletedCount(0);
    setCeoTaskResults([]);
    setPlanConfirmed(true);

    try {
      const ceoAgent = getCEOAgent({ maxIterations: 3, autoSkillLoad: true });
      const executor = createTerminalExecutor(workspaceList);
      const decomposer = new LLMDecomposer({ llmAvailable: true, llmCall: createLLMCall() });
      ceoAgent.setDecomposer(decomposer);
      // 注入工作区信息
      if (workspaceList.length > 0) {
        ceoAgent.setWorkspace(workspaceList[0].id, workspaceList[0].workspacePath);
      }
      // 编排模式：加载预定义 Flow 拓扑
      if (orchestrationFlowRef.current) {
        ceoAgent.setOrchestrationFlow(orchestrationFlowRef.current);
      } else {
        ceoAgent.clearOrchestrationFlow();
      }

      const report = await ceoAgent.processWithDecomposer(inputText, executor, {
        plan,
        onTaskStart: (taskId) => {
          setCeoTaskResults(prev => [...prev, {
            taskId, workerType: 'execution',
            output: null, success: false,
            duration: 0, skillsUsed: [], subTasks: [],
          }]);
          // DAG 联动
          try {
            const planAgent = plan.agents.find(a => a.id === taskId);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (useTaskStore.getState().handleEvent as any)({
              type: 'agent_start',
              agentId: taskId,
              label: planAgent?.name ?? taskId,
              parentId: 'main-agent',
              agentType: planAgent?.type ?? 'execution',
              taskDescription: planAgent?.description ?? '',
            });
          } catch { /* 静默忽略 */ }
        },
        onTaskComplete: (result) => {
          setCeoTaskResults(prev => prev.map(r =>
            r.taskId === result.taskId ? result : r
          ));
          setCeoCompletedCount(prev => prev + 1);
          // DAG 联动
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (useTaskStore.getState().handleEvent as any)({
              type: 'agent_end',
              agentId: result.taskId,
              toolMessage: result.error,
              duration: result.duration,
              skillsUsed: result.skillsUsed,
            });
          } catch { /* 静默忽略 */ }
        },
      });

      setCeoPhase('summary');
      setCeoSummary(report.summary);
      setAgentExecuting(false);

      // 构建 Agent 结果卡片
      const agentCard: MarkdownCardData = {
        id: `agent-${Date.now()}`,
        queryId: `agent-${Date.now()}`,
        timestamp: Date.now(),
        query: inputText,
        analysis: [
          `### CEO 执行统计`,
          ``,
          `| 指标 | 值 |`,
          `|------|-----|`,
          `| 总目标数 | ${report.completedGoals.length + report.missedGoals.length} |`,
          `| 已完成 | ${report.completedGoals.length} |`,
          `| 未完成 | ${report.missedGoals.length} |`,
          `| 总耗时 | ${report.totalDuration}ms |`,
        ].join('\n'),
        summary: report.summary,
        completeSummary: report.summary,
        variant: 'agent' as const,
        agentReport: {
          totalGoals: report.completedGoals.length + report.missedGoals.length,
          completedGoals: report.completedGoals.length,
          missedGoals: report.missedGoals.length,
          duration: report.totalDuration,
          skillsUsed: (report.skillsUsed ?? []).map((s: string) => ({ name: s, domain: 'general' })),
          recoveries: (() => {
            const grouped = new Map<string, import('@/types/multi-agent/worker-agents').TaskResult[]>();
            for (const r of report.taskResults) {
              const arr = grouped.get(r.taskId) || [];
              arr.push(r);
              grouped.set(r.taskId, arr);
            }
            const recovered: Array<{ type: string; agentId: string; success: boolean }> = [];
            for (const [taskId, results] of grouped) {
              const hasFailure = results.some(r => !r.success);
              const hasSuccess = results.some(r => r.success);
              if (hasFailure && hasSuccess) {
                recovered.push({ type: 'retry', agentId: taskId, success: true });
              }
            }
            return recovered;
          })(),
        },
        workspaceId: (() => {
          const termTab = useTerminalWorkspaceStore.getState().activeTab;
          return termTab !== 'global' ? termTab : undefined;
        })(),
      };

      useTaskStore.getState().addMarkdownCard(agentCard);

      // 完成状态已通过 CEOAgentCard Phase 3 展示
    } catch (error) {
      setAgentExecuting(false);
      setCeoPhase('summary');
      const errMsg = error instanceof Error ? error.message : String(error);
      setCeoSummary(`执行失败: ${errMsg}`);

      const errorCard: MarkdownCardData = {
        id: `agent-error-${Date.now()}`,
        queryId: `agent-error-${Date.now()}`,
        timestamp: Date.now(),
        query: inputText,
        analysis: `### Agent 执行失败\n\n\`\`\`\n${errMsg}\n\`\`\``,
        summary: 'Agent 执行出错，请检查配置后重试。',
        completeSummary: 'Agent 执行出错，请检查配置后重试。',
        variant: 'agent' as const,
      };
      useTaskStore.getState().addMarkdownCard(errorCard);
    }
  }, [workspaceList, activeWorkspaceId]);

  // 兼容旧的 handleInputKeyDown（用于 Ctrl+Enter 发送）
  const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendWithAttachments();
    }
  }, [handleSendWithAttachments]);

  // StatusBar now handles these

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%', ...style }}>
      {/* Task 5: 工作区标签栏 */}
      <WorkspaceTagBar
        activeTab={activeTab}
        onTabChange={useTerminalWorkspaceStore.getState().setActiveTab}
        workspaceTabs={workspaceTabs}
        workspaces={workspaceList}
        runningWorkspaces={runningWorkspaces}
      />

      {/* Task 5: UpperPane — 现有终端内容 */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <StatusBar isRunning={isRunning} error={error} tokenUsage={tokenUsage} />

      {/* 主内容区 */}
      <div
        data-testid={isGlobalView ? 'global-workspace-home' : 'workspace-current-workbench'}
        style={{
        flex: 1,
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--term-bg)',
        border: '1px solid var(--term-border)',
        borderTop: 'none',
        borderBottom: 'none',
        transition: 'background 0.3s, border-color 0.3s',
        maxHeight: '65vh',
      }}>

        {/* 欢迎页：无历史卡片、无进行中会话时展示 */}
        {(() => {
          const hasContent = agentExecuting
            || markdownCards.length > 0
            || currentCard !== null
            || previousCard !== null
            || summaryChunks.length > 0
            || pendingQueryText !== ''
            || pendingRAGChunks.length > 0;
          return !hasContent;
        })() && <WelcomePage />}

        {/* Agent 执行卡片（Multi-Agent 模式下的结构化展示） */}
        {agentExecuting && (
          <div style={{ padding: '0 4px' }}>
            <CEOAgentCard
              phase={ceoPhase}
              plan={ceoPlan}
              taskResults={ceoTaskResults}
              ceoSummary={ceoSummary}
              strategy={ceoStrategy}
              completedCount={ceoCompletedCount}
              totalCount={ceoTotalCount}
              planConfirmed={planConfirmed}
            />
          </div>
        )}

        {/* MarkdownCard 列表（已完成） */}
        {markdownCards.length > 0 && (
          <div style={{ padding: '0 4px' }}>
            {markdownCards.map(card => (
              <MarkdownCard key={`${card.queryId}-${collapsedCardIds.has(card.queryId)}`} card={card} defaultAnalysisOpen={card.variant === 'agent'} defaultCollapsed={card.variant !== 'agent' && collapsedCardIds.has(card.queryId)} onAttachmentClick={(att) => setPreviewAttachment(att)} />
            ))}
          </div>
        )}

        {/* 上一轮问答（已完成的当前轮） */}
        {previousCard && (
          <div style={{ padding: '0 4px' }}>
            <LiveCard card={previousCard} />
          </div>
        )}


        {/* 当前问答（进行中） */}
        {currentCard && (
          <div style={{ padding: '0 4px' }}>
            <LiveCard card={currentCard} />
          </div>
        )}


        {/* 流式总结（实时 Markdown 渲染，只要有 chunk 就显示，不依赖 currentCard） */}
        {summaryChunks.length > 0 && (
          <div style={{
            padding: '10px 12px',
            background: 'rgba(46,204,113,0.04)',
            borderTop: '1px solid rgba(46,204,113,0.15)',
            marginTop: 4,
          }}>
            {/* 状态头 */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginBottom: 6,
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'var(--success)',
                animation: 'stream-pulse 1s ease-in-out infinite',
                flexShrink: 0,
              }} />
              <span style={{
                fontSize: 9, color: 'var(--success)',
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: '0.08em', textTransform: 'uppercase',
              }}>
                总结生成中
              </span>
              <span style={{
                color: 'var(--success)', fontSize: 11,
                animation: 'cursor-blink 0.8s step-end infinite',
              }}>▊</span>
            </div>
            {/* Markdown 流式内容 */}
            <div style={{
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              fontSize: 11,
              color: 'var(--text-secondary)',
              lineHeight: 1.7,
              maxHeight: 300,
              overflowY: 'auto',
            }}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code: ({ className, children, ...props }) => {
                    const isBlock = className?.startsWith('language-');
                    return isBlock
                      ? <code style={{ background: 'transparent', padding: 0, color: 'var(--text-secondary)', fontSize: 10 }} className={className} {...props}>{children}</code>
                      : <code style={{ background: 'var(--bg-input)', borderRadius: 3, padding: '1px 4px', fontSize: 10, color: 'var(--accent)', fontFamily: "'JetBrains Mono', monospace" }} {...props}>{children}</code>;
                  },
                  pre: ({ children }) => <pre style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', overflowX: 'auto', margin: '6px 0' }}>{children}</pre>,
                }}
              >
                {summaryChunks.join('')}
              </ReactMarkdown>
            </div>
            <style>{`
              @keyframes stream-pulse {
                0%, 100% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.4; transform: scale(0.85); }
              }
              @keyframes cursor-blink {
                0%, 100% { opacity: 1; }
                50% { opacity: 0; }
              }
            `}</style>
          </div>
        )}

        {/* ── Query + RAG Chunks 分离显示 ────────────────────────────── */}
        {(pendingQueryText || pendingRAGChunks.length > 0) && (
          <div style={{
            padding: '8px 12px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}>
            {/* Query 区（蓝色边框） */}
            {pendingQueryText && (
              <div style={{
                border: '1px solid rgba(74,142,255,0.35)',
                borderRadius: 6,
                padding: '6px 10px',
                background: 'rgba(74,142,255,0.04)',
              }}>
                <div style={{
                  fontSize: 9,
                  color: 'rgba(74,142,255,0.7)',
                  fontFamily: "'JetBrains Mono', monospace",
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  marginBottom: 3,
                }}>
                  用户问题
                </div>
                <div style={{
                  fontSize: 12,
                  color: 'var(--text-primary)',
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  {pendingQueryText}
                </div>
              </div>
            )}

            {/* RAG Chunks 区（紫色边框） */}
            {pendingRAGChunks.length > 0 && (
              <div style={{
                border: '1px solid rgba(167,139,250,0.35)',
                borderRadius: 6,
                padding: '6px 10px',
                background: 'rgba(167,139,250,0.04)',
              }}>
                <div style={{
                  fontSize: 9,
                  color: 'rgba(167,139,250,0.7)',
                  fontFamily: "'JetBrains Mono', monospace",
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  marginBottom: 4,
                }}>
                  历史召回 ({pendingRAGChunks.length} 条)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {pendingRAGChunks.map((chunk, index) => (
                    <div key={chunk.id} style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 6,
                      fontSize: 10,
                      color: 'var(--text-secondary)',
                    }}>
                      <span style={{
                        color: 'rgba(167,139,250,0.7)',
                        fontFamily: "'JetBrains Mono', monospace",
                        flexShrink: 0,
                      }}>
                        [{index + 1}]
                      </span>
                      <span style={{
                        color: chunk.chunkType === 'answer' ? 'var(--text-secondary)' :
                               chunk.chunkType === 'query' ? 'rgba(74,142,255,0.8)' :
                               'rgba(74,222,128,0.7)',
                        flexShrink: 0,
                      }}>
                        {chunk.chunkType === 'answer' ? '回答' : chunk.chunkType === 'query' ? '问题' : '工具'}
                      </span>
                      <span style={{
                        color: 'rgba(167,139,250,0.6)',
                        fontFamily: "'JetBrains Mono', monospace",
                        flexShrink: 0,
                      }}>
                        {(chunk.score * 100).toFixed(0)}%
                      </span>
                      <span style={{
                        color: 'var(--text-muted)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {chunk.content.length > 60 ? chunk.content.substring(0, 60) + '…' : chunk.content}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
      </div>
      <RecallPanel
        recallState={recallState}
        inputValue={inputValue}
        onApplyRecall={handleApplyRecall}
        onDismissSimilar={dismissSimilarHint}
        onDismissError={dismissErrorHint}
      />

      <GlobalSummaryPanel
        isExpanded={isGlobalSummaryExpanded}
        workspaces={workspaceList}
        batchResult={batchResult}
        activeWorkspaceId={activeWorkspaceId}
        onCollapse={collapseGlobalSummary}
        onAnalyze={requestAnalysis}
      />

      {/* V1.4.1: 附件预览条带（发送前） */}
      <AttachmentPreviewStrip
        onRemove={handleRemoveAttachment}
        onClearAll={handleClearAll}
        onToggleExpand={() => setPreviewExpanded(true)}
        onPreview={handlePreviewAttachment}
        onFileSelect={handleFileSelect}
      />

      {/* V1.4.1: 附件详情面板（可展开） */}
      <AttachmentDetailPanel
        onRemove={handleRemoveAttachment}
        onPreview={handlePreviewAttachment}
      />

      {/* V1.4.1: 已发送的附件（终端中显示） */}
      {sentAttachments.length > 0 && (
        <TerminalAttachmentSection
          attachments={sentAttachments}
          onPreview={handlePreviewAttachment}
        />
      )}

      {/* Multi-Agent 模式开关 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px' }}>
        <label onClick={() => setAgentMode(!agentMode)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', userSelect: 'none' as const }}>
          <div
            style={{
              position: 'relative' as const, width: 36, height: 20, borderRadius: 10,
              background: agentMode ? '#8b5cf6' : 'var(--border)',
              transition: 'background 0.2s',
              pointerEvents: 'none',
            }}
            >
              <div style={{
                position: 'absolute' as const, top: 2,
                left: agentMode ? 18 : 2,
                width: 16, height: 16, borderRadius: '50%',
                background: 'white', transition: 'left 0.2s',
              }} />
            </div>
            <span style={{ color: agentMode ? '#8b5cf6' : 'var(--text-secondary)', fontSize: 12 }}>
              🧠 Agent
            </span>
            {agentMode && (
              <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 4 }}>
                输入后将由 CEO Agent 分解执行
              </span>
            )}
          </label>
          {/* 计划确认模式开关（仅 Agent 模式时显示） */}
          {agentMode && (
            <label onClick={() => setPlanMode(prev => prev === 'auto' ? 'confirm' : 'auto')} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', userSelect: 'none' as const }}>
              <div style={{
                position: 'relative' as const, width: 36, height: 20, borderRadius: 10,
                background: planMode === 'confirm' ? '#f59e0b' : 'var(--border)',
                transition: 'background 0.2s',
                pointerEvents: 'none',
              }}>
                <div style={{
                  position: 'absolute' as const, top: 2,
                  left: planMode === 'confirm' ? 18 : 2,
                  width: 16, height: 16, borderRadius: '50%',
                  background: 'white', transition: 'left 0.2s',
                }} />
              </div>
              <span style={{ color: planMode === 'confirm' ? '#f59e0b' : 'var(--text-secondary)', fontSize: 12 }}>
                📋 Plan
              </span>
              {planMode === 'confirm' && (
                <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 4 }}>
                  分解后需确认再执行
                </span>
              )}
            </label>
          )}
      </div>

      {/* 输入框 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        background: 'var(--bg-card)',
        border: agentMode ? '1px solid #8b5cf6' : '1px solid var(--border)',
        borderTop: 'none',
        borderRadius: '0 0 8px 8px',
        padding: '0 12px',
        transition: 'border-color 0.2s',
        boxShadow: agentMode ? '0 0 0 1px rgba(139,92,246,0.3)' : undefined,
      }}
        onFocus={e => { e.currentTarget.style.borderColor = agentMode ? '#8b5cf6' : 'var(--accent)'; }}
        onBlur={e => { e.currentTarget.style.borderColor = agentMode ? '#8b5cf6' : 'var(--border)'; }}
      >
        {/* V1.4.1: 附件按钮 */}
        <AttachmentButton onFilesSelected={handleFileSelect} />

        <span style={{
          color: 'var(--accent)',
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: 13,
          fontWeight: 700,
          lineHeight: 1,
          userSelect: 'none',
          marginLeft: 4,
        }}>›</span>
        <input
          type="text"
          value={inputValue}
          onChange={e => handleInputChange(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder={
            agentMode
              ? '🧠 Agent 模式：输入目标，CEO Agent 分解执行...'
              : isRunning
              ? 'Claude 工作中，可继续输入...'
              : isStarting
              ? '等待 Claude Code 启动...'
              : '输入消息，按 Enter 发送...'
          }
          disabled={false}
          style={{
            flex: 1,
            padding: '10px 8px',
            fontSize: 12,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            background: 'transparent',
            color: 'var(--text-primary)',
            border: 'none',
            outline: 'none',
            cursor: isRunning ? 'text' : 'not-allowed',
          }}
        />
        {pendingInputsCount > 0 && (
          <span style={{
            padding: '2px 8px',
            borderRadius: 10,
            fontSize: 10,
            background: 'var(--warn-bg)',
            color: 'var(--warn)',
            border: '1px solid var(--warn-border)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}>
            +{pendingInputsCount} 条等待
          </span>
        )}
      </div>

      {/* V1.4.1: 附件预览弹窗 */}
      <AttachmentPreviewModal
        attachment={previewAttachment}
        onClose={() => setPreviewAttachment(null)}
      />

      {/* 计划确认弹窗（Agent 模式 + Plan 确认模式） */}
      {showPlanConfirm && pendingPlan && (
        <PlanConfirmModal
          agents={pendingPlan.agents}
          strategy={pendingPlan.strategy}
          onConfirm={(agents) => {
            setShowPlanConfirm(false);
            // 使用用户可能修改后的 agents 更新 plan
            const updatedPlan: AgentPlan = {
              ...pendingPlan!,
              agents,
            };
            setCeoPlan(agents);
            setCeoStrategy(pendingPlan!.strategy);
            setCeoTotalCount(agents.length);
            executeCEOPlan(pendingCleanInput, updatedPlan);
          }}
          onCancel={() => {
            setShowPlanConfirm(false);
            setPendingPlan(null);
            setPendingCleanInput('');
          }}
        />
      )}
    </div>
  );
}
