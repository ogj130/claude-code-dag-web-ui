import { createSession, getSession } from '@/stores/sessionStorage';
import type { DBSession } from '@/types/storage';
import { getWorkspaceById } from '@/stores/workspaceStorage';
import {
  bindSessionToWorkspace,
  getLatestSessionBindingByWorkspaceId,
  touchBinding,
} from '@/stores/sessionWorkspaceBindingStorage';

export interface CreateWorkspaceSessionInput {
  workspaceId: string;
  title: string;
}

export interface GetOrCreateWorkspaceSessionInput extends CreateWorkspaceSessionInput {
  createdBy: 'manual' | 'global-dispatch';
  /** 强制新建会话，忽略历史绑定 */
  forceNew?: boolean;
}

export interface WorkspaceSessionResult {
  workspaceId: string;
  modelConfigId: string;
  createdBy: 'manual' | 'global-dispatch';
  reused: boolean;
  session: DBSession;
}

async function loadWorkspaceOrThrow(workspaceId: string) {
  const workspace = await getWorkspaceById(workspaceId);
  if (!workspace) {
    throw new Error(`Workspace not found: ${workspaceId}`);
  }
  return workspace;
}

export async function createManualSessionForWorkspace(
  input: CreateWorkspaceSessionInput,
): Promise<WorkspaceSessionResult> {
  const workspace = await loadWorkspaceOrThrow(input.workspaceId);
  const session = await createSession({
    title: input.title,
    workspacePath: workspace.workspacePath,
  });

  await bindSessionToWorkspace(session.id, workspace.id, 'manual');

  return {
    workspaceId: workspace.id,
    modelConfigId: workspace.modelConfigId,
    createdBy: 'manual',
    reused: false,
    session,
  };
}

export async function getOrCreateSessionForWorkspace(
  input: GetOrCreateWorkspaceSessionInput,
): Promise<WorkspaceSessionResult> {
  const workspace = await loadWorkspaceOrThrow(input.workspaceId);

  if (!input.forceNew) {
    const latestBinding = await getLatestSessionBindingByWorkspaceId(workspace.id);

    if (latestBinding) {
      await touchBinding(latestBinding.sessionId);
      const session = await getSession(latestBinding.sessionId);

      if (session) {
        return {
          workspaceId: workspace.id,
          modelConfigId: workspace.modelConfigId,
          createdBy: latestBinding.createdBy,
          reused: true,
          session,
        };
      }
    }
  }

  const session = await createSession({
    title: input.title,
    workspacePath: workspace.workspacePath,
  });

  await bindSessionToWorkspace(session.id, workspace.id, input.createdBy);

  return {
    workspaceId: workspace.id,
    modelConfigId: workspace.modelConfigId,
    createdBy: input.createdBy,
    reused: false,
    session,
  };
}
