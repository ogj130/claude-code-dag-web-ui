import type {
  DispatchResult,
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

  const runtimeResult = await runGlobalTerminalRuntime({
    sessionId: sessionResult.session.id,
    prompts,
    executePrompt: async ({ sessionId, prompt }) => {
      return executePrompt({ workspaceId: workspace.id, sessionId, prompt });
    },
  });

  return {
    workspaceId: workspace.id,
    sessionId: sessionResult.session.id,
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
