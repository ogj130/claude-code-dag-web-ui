export interface PromptInput {
  prompt: string;
}

export type GlobalInputMode = 'single' | 'list';

export type GlobalSessionPolicy =
  | 'new_session_for_all'
  | 'continue_current_by_workspace';

export interface DispatchPromptResult {
  prompt: string;
  status: 'success' | 'failed' | 'skipped';
  reason?: string;
}

export interface DispatchWorkspaceResult {
  workspaceId: string;
  sessionId?: string;
  status: 'success' | 'partial' | 'failed';
  promptResults: DispatchPromptResult[];
  errorMessage?: string;
}

export interface DispatchResult {
  batchId: string;
  mode: GlobalInputMode;
  policy: GlobalSessionPolicy;
  workspaceResults: DispatchWorkspaceResult[];
}
