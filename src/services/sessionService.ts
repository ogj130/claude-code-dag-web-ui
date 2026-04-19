import { createSession, getSession } from '@/stores/sessionStorage';
import type { DBSession } from '@/types/storage';
import {
  bindSessionToWorkspace,
  getLatestSessionBindingByWorkspaceId,
  touchBinding,
} from '@/stores/sessionWorkspaceBindingStorage';

export interface CreateWorkspaceSessionInput {
  /** 工作区 ID（来自 workspacePresetStorage） */
  workspaceId: string;
  /** 工作区路径（由调用方直接传入，无需跨 DB 查询） */
  workspacePath: string;
  title: string;
}

export interface GetOrCreateWorkspaceSessionInput extends CreateWorkspaceSessionInput {
  createdBy: 'manual' | 'global-dispatch';
  /** 强制新建会话，忽略历史绑定 */
  forceNew?: boolean;
}

export interface WorkspaceSessionResult {
  workspaceId: string;
  createdBy: 'manual' | 'global-dispatch';
  reused: boolean;
  session: DBSession;
}

export async function createManualSessionForWorkspace(
  input: CreateWorkspaceSessionInput,
): Promise<WorkspaceSessionResult> {
  const session = await createSession({
    title: input.title,
    workspacePath: input.workspacePath,
  });

  await bindSessionToWorkspace(session.id, input.workspaceId, 'manual');

  return {
    workspaceId: input.workspaceId,
    createdBy: 'manual',
    reused: false,
    session,
  };
}

export async function getOrCreateSessionForWorkspace(
  input: GetOrCreateWorkspaceSessionInput,
): Promise<WorkspaceSessionResult> {
  if (!input.forceNew) {
    const latestBinding = await getLatestSessionBindingByWorkspaceId(input.workspaceId);

    if (latestBinding) {
      await touchBinding(latestBinding.sessionId);
      const session = await getSession(latestBinding.sessionId);

      if (session) {
        return {
          workspaceId: input.workspaceId,
          createdBy: latestBinding.createdBy,
          reused: true,
          session,
        };
      }
    }
  }

  const session = await createSession({
    title: input.title,
    workspacePath: input.workspacePath,
  });

  await bindSessionToWorkspace(session.id, input.workspaceId, input.createdBy);

  return {
    workspaceId: input.workspaceId,
    createdBy: input.createdBy,
    reused: false,
    session,
  };
}
