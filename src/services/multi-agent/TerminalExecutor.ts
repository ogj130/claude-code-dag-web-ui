import type { WorkerExecutor, WorkerExecutorContext } from './types';
import { dispatchExecutePromptAdapter } from '@/services/globalDispatchExecutor';
import type { Workspace } from '@/types/workspace';
import type { SkillRef } from '@/types/multi-agent/skill';
import type { TaskResult } from '@/types/multi-agent/worker-agents';
import { getOrCreateSessionForWorkspace } from '@/services/sessionService';

export function createTerminalExecutor(
  workspaces: Workspace[],
): WorkerExecutor {
  return {
    async execute(task: WorkerExecutorContext, skills: SkillRef[]) {
      const workspace = workspaces.find(w => w.id === task.workspaceId);
      const target = workspace ?? workspaces[0];

      if (!target) {
        return makeResult(task.taskId, skills, false, 0, null, `No workspace found: ${task.workspaceId || '(empty)'}`);
      }

      // 始终尝试真实执行（Electron IPC 或 WebSocket）
      // 如果 WS 服务器未运行，dispatchExecutePromptAdapter 会在连接失败时返回 failed
      return executeWithWorkspace(target, task, skills);
    },
  };
}

function makeResult(
  taskId: string,
  skills: SkillRef[],
  success: boolean,
  duration: number,
  output: string | null,
  error?: string,
): TaskResult {
  return { taskId, workerType: 'execution', output, success, duration, skillsUsed: skills, subTasks: [], error };
}

async function executeWithWorkspace(
  workspace: Workspace,
  task: WorkerExecutorContext,
  skills: SkillRef[],
): Promise<TaskResult> {
  const startTime = Date.now();

  try {
    const sessionResult = await getOrCreateSessionForWorkspace({
      workspaceId: workspace.id,
      workspacePath: workspace.workspacePath,
      title: `CEO Task ${task.taskId}`,
      createdBy: 'global-dispatch',
      forceNew: false,
    });

    const result = await dispatchExecutePromptAdapter({
      workspaceId: workspace.id,
      workspacePath: workspace.workspacePath,
      modelConfigId: workspace.modelConfigId,
      sessionId: sessionResult.session.id,
      prompt: task.description,
    });

    return makeResult(
      task.taskId,
      skills,
      result.status === 'success',
      Date.now() - startTime,
      result.output ?? null,
      result.reason,
    );
  } catch (error) {
    return makeResult(
      task.taskId,
      skills,
      false,
      Date.now() - startTime,
      null,
      error instanceof Error ? error.message : String(error),
    );
  }
}
