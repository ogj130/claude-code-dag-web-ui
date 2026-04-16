import type { DispatchResult,
  DispatchWorkspaceResult,
  GlobalSessionPolicy,
  GlobalInputMode,
  PromptInput,
} from '@/types/global-dispatch';
import { parsePromptInput } from '@/utils/promptParser';
import { resolveSessionPolicy } from '@/utils/sessionPolicyResolver';
import { getEnabledWorkspaces } from '@/stores/workspaceStorage';
import { getOrCreateSessionForWorkspace } from '@/services/sessionService';
import { runGlobalTerminalRuntime } from '@/services/globalTerminalRuntime';
import type { Workspace } from '@/types/workspace';
import type { ClaudeCodeEventPayload } from '@/services/globalDispatchExecutor';
import { getProcessManager } from '@/services/globalDispatchExecutor';
import { useTaskStore } from '@/stores/useTaskStore';
import type { ClaudeEvent } from '@/types/events';

export interface DispatchGlobalPromptsInput {
  rawInput: string;
  workspaces: Workspace[];
  createNewSession: boolean;
  executePrompt: (
    input: DispatchExecutePromptInput,
  ) => Promise<DispatchExecutePromptResult>;
}

export interface DispatchExecutePromptInput {
  workspaceId: string;
  sessionId: string;
  prompt: string;
}

export interface DispatchExecutePromptResult {
  status: 'success' | 'failed';
  reason?: string;
}

export interface DispatchGlobalPromptsWithDefaultsInput
  extends Omit<DispatchGlobalPromptsInput, 'workspaces'> {}

/**
 * 为单个工作区执行 prompt list，并映射为 DispatchWorkspaceResult。
 */
async function dispatchForWorkspace(
  workspace: Workspace,
  prompts: PromptInput[],
  createNewSession: boolean,
  executePrompt: DispatchGlobalPromptsInput['executePrompt'],
): Promise<DispatchWorkspaceResult> {
  const sessionResult = await getOrCreateSessionForWorkspace({
    workspaceId: workspace.id,
    title: `Dispatch ${new Date().toLocaleTimeString()}`,
    createdBy: 'global-dispatch',
    forceNew: createNewSession,
  });

  const sessionId = sessionResult.session.id;

  // ── 创建事件处理器：写入 dispatch store ──────────────────────────────
  const dispatchEventHandler = (payload: ClaudeCodeEventPayload) => {
    if (payload.sessionId !== sessionId) return;
    const evt = payload.event;

    // ★ Fix: 只在 session_end 时注销 handler，不在 streamEnd/result 时注销
    // 原因：session_end 紧跟在 streamEnd/result 之后到达（process 退出时）。
    // 若在 streamEnd/result 时提前注销，session_end 永远无人处理 → session 卡在 'running'。
    // 注：handler 通过 sessionId 隔离，注销早了不会影响其他 workspace。
    if (evt.type === 'session_end') {
      pm.off('event', dispatchEventHandler);
    }

    // terminalChunk / terminal → 写入终端行
    if (evt.type === 'terminalChunk') {
      const chunkEvt = evt as { type: 'terminalChunk'; text?: string };
      if (chunkEvt.text !== undefined) {
        useTaskStore.getState().addDispatchTerminalChunk(workspace.id, chunkEvt.text);
      }
      return;
    }
    if (evt.type === 'terminal') {
      const termEvt = evt as { type: 'terminal'; text?: string };
      if (termEvt.text !== undefined) {
        useTaskStore.getState().addDispatchTerminalLine(workspace.id, termEvt.text);
      }
      return;
    }
    // error 事件 → 写入终端行（DAG 节点也处理 error）
    if (evt.type === 'error') {
      const errEvt = evt as { type: 'error'; message?: string };
      useTaskStore.getState().addDispatchTerminalLine(workspace.id, `\x1b[31m✗ 错误: ${errEvt.message ?? 'unknown error'}\x1b[0m`);
    }

    // ★ Fix: user_input_sent 在 executePrompt 回调中已处理，此处不再重复处理
    // 原因：后端也会发送 user_input_sent，如果在此处也处理，会导致 dispatchCurrentCard 被设置两次
    // （终端里显示两条 "◐ hello dispatch"）
    if (evt.type === 'user_input_sent') return;

    // 其余事件 → 写入 DAG 节点
    useTaskStore.getState().handleDispatchEvent(workspace.id, evt as ClaudeEvent);
  };

  // ── 直接在 pm 上注册事件监听（捕获所有原始后端事件） ──────────────────
  const pm = getProcessManager();
  pm.onEvent(dispatchEventHandler);

  let promptIndex = 0;
  const runtimeResult = await runGlobalTerminalRuntime({
    sessionId,
    prompts,
    executePrompt: async ({ sessionId: sid, prompt }) => {
      // ★ Fix: 在每次发送前触发 user_input_sent，填充 dispatchCurrentCard
      // 这样 query_summary 事件才能拿到正确的 queryText 构建 Q&A 卡片
      const queryId = `dispatch_${workspace.id}_${promptIndex}_${Date.now()}`;
      promptIndex++;
      useTaskStore.getState().handleDispatchEvent(workspace.id, {
        type: 'user_input_sent',
        queryId,
        text: prompt,
        sessionId: sid,
      } as ClaudeEvent);
      return executePrompt({ workspaceId: workspace.id, sessionId: sid, prompt });
    },
  });

  // ★ Fix: 如果 runtimeResult.status 是 'failed'（executePrompt 早期返回，没有触发后端事件），
  // 手动补发 error 事件来同步 store。
  // 注意：不再手动 dispatch session_end，因为：
  // 1. session_start 已经在 session_start handler 中设置 session.status = 'running'（见 useTaskStore.ts）
  // 2. error 设置 session.status = 'failed'
  // 3. session_end 只在 session.status === 'running' 时才设置为 'completed'（session_end handler 有此检查）
  if (runtimeResult.status === 'failed') {
    const failedReason = runtimeResult.promptResults
      .map(r => r.reason ?? 'unknown error')
      .join('; ');
    useTaskStore.getState().handleDispatchEvent(workspace.id, {
      type: 'error',
      message: failedReason,
    } as unknown as ClaudeEvent);
  }

  return {
    workspaceId: workspace.id,
    sessionId,
    status: runtimeResult.status,
    promptResults: runtimeResult.promptResults,
  };
}

function generateBatchId(): string {
  return `batch_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * 核心编排函数：给定工作区列表、原始输入与执行器，
 * 按 session policy 执行所有 prompts 并汇总结果。
 */
export async function dispatchGlobalPrompts(
  input: DispatchGlobalPromptsInput,
): Promise<DispatchResult> {
  const { mode, prompts } = parsePromptInput(input.rawInput);
  const policy = resolveSessionPolicy({ createNewSession: input.createNewSession });

  const workspaceResults: DispatchWorkspaceResult[] = await Promise.all(
    input.workspaces.map(workspace =>
      dispatchForWorkspace(workspace, prompts, input.createNewSession, input.executePrompt),
    ),
  );

  return {
    batchId: generateBatchId(),
    mode: mode as GlobalInputMode,
    policy: policy as GlobalSessionPolicy,
    workspaceResults,
  };
}

/**
 * 便利包装：自动从存储加载所有启用中的工作区，
 * 再委托 dispatchGlobalPrompts 执行。
 */
export async function dispatchGlobalPromptsWithDefaults(
  input: DispatchGlobalPromptsWithDefaultsInput,
): Promise<DispatchResult> {
  const workspaces = await getEnabledWorkspaces();
  return dispatchGlobalPrompts({ ...input, workspaces });
}
