import type { GlobalSessionPolicy } from '@/types/global-dispatch';

export interface ResolveSessionPolicyInput {
  createNewSession?: boolean;
}

export function resolveSessionPolicy(
  input: ResolveSessionPolicyInput = {},
): GlobalSessionPolicy {
  return input.createNewSession
    ? 'new_session_for_all'
    : 'continue_current_by_workspace';
}
