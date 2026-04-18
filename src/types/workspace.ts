export interface Workspace {
  id: string;
  name: string;
  workspacePath: string;
  enabled: boolean;
  modelConfigId: string;
  systemPrompt?: string;
  createdAt: number;
  updatedAt: number;
}

export interface SessionWorkspaceBinding {
  sessionId: string;
  workspaceId: string;
  createdBy: 'manual' | 'global-dispatch';
  createdAt: number;
  lastActiveAt: number;
}

export interface CreateWorkspaceInput {
  name: string;
  workspacePath: string;
  modelConfigId: string;
  enabled?: boolean;
  systemPrompt?: string;
}
