import type {
  DispatchResult,
  DispatchWorkspaceResult,
  GlobalSessionPolicy,
  GlobalInputMode,
  PromptInput,
} from '@/types/global-dispatch';
import { useTerminalWorkspaceStore } from '../stores/useTerminalWorkspaceStore';
import { parsePromptInput } from '@/utils/promptParser';
import { resolveSessionPolicy } from '@/utils/sessionPolicyResolver';
import { getEnabledPresets } from '@/stores/workspacePresetStorage';
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
  /** 工作区路径（来自 workspacePresetStorage，用于 WebSocket 连接） */
  workspacePath: string;
  /** 模型配置 ID（来自 workspacePresetStorage，调用方总是传入） */
  modelConfigId: string;
  sessionId: string;
  prompt: string;
}

export interface DispatchExecutePromptResult {
  status: 'success' | 'failed';
  output?: string;
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
    workspacePath: workspace.workspacePath,
    title: `Dispatch ${new Date().toLocaleTimeString()}`,
    createdBy: 'global-dispatch',
    forceNew: createNewSession,
  });

  const runtimeResult = await runGlobalTerminalRuntime({
    sessionId: sessionResult.session.id,
    prompts,
    executePrompt: async ({ sessionId, prompt }) => {
      return executePrompt({ workspaceId: workspace.id, workspacePath: workspace.workspacePath, modelConfigId: workspace.modelConfigId, sessionId, prompt });
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

  // 添加工作区标签（Phase 1 扩展的 store）
  useTerminalWorkspaceStore.getState().onExecutionStart(
    input.workspaces.map(ws => ({ id: ws.id, name: ws.name }))
  );

  const workspaceResults: DispatchWorkspaceResult[] = await Promise.all(
    input.workspaces.map(workspace =>
      dispatchForWorkspace(workspace, prompts, input.createNewSession, input.executePrompt),
    ),
  );

  // 更新每个工作区标签状态
  for (const result of workspaceResults) {
    const tabStatus = result.status === 'success' || result.status === 'failed'
      ? (result.status === 'success' ? 'completed' : 'error')
      : 'completed';
    useTerminalWorkspaceStore.getState().updateWorkspaceTab(result.workspaceId, tabStatus);
  }

  // 所有工作区完成时触发延迟移除
  const allCompleted = workspaceResults.every(r => r.status === 'success' || r.status === 'failed');
  if (allCompleted) {
    useTerminalWorkspaceStore.getState().onAllCompleted();
    // 标记全局终端已使用（门控全局终端输出显示）
    useTerminalWorkspaceStore.getState().markGlobalTerminalUsed();
  }

  return {
    batchId: generateBatchId(),
    mode: mode as GlobalInputMode,
    policy: policy as GlobalSessionPolicy,
    workspaceResults,
  };
}

/**
 * 便利包装：自动从 workspacePresetStorage（cc-web-model）加载所有启用中的工作区，
 * 再委托 dispatchGlobalPrompts 执行。
 */
export async function dispatchGlobalPromptsWithDefaults(
  input: DispatchGlobalPromptsWithDefaultsInput,
): Promise<DispatchResult> {
  const presets = await getEnabledPresets();
  let workspaces = presets
    .filter(p => p.configId !== null)
    .map(p => ({
      id: p.id,
      name: p.name || p.workspacePath.split('/').pop() || '未命名',
      workspacePath: p.workspacePath,
      modelConfigId: p.configId!,
      enabled: p.isEnabled,
      createdAt: p.createdAt || Date.now(),
      updatedAt: p.updatedAt || Date.now(),
    }));

  // 按用户选择的工作区范围过滤（scope 为空时全量发送，向后兼容）
  const selectedIds = useTerminalWorkspaceStore.getState().selectedDispatchWorkspaceIds;
  if (selectedIds.length > 0) {
    workspaces = workspaces.filter(ws => selectedIds.includes(ws.id));
  }

  return dispatchGlobalPrompts({ ...input, workspaces });
}
