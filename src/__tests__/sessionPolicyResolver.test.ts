import { describe, expect, it } from 'vitest';
import { resolveSessionPolicy } from '@/utils/sessionPolicyResolver';

describe('sessionPolicyResolver', () => {
  it('显式选择全部新建会话时返回 new_session_for_all', () => {
    expect(resolveSessionPolicy({ createNewSession: true })).toBe('new_session_for_all');
  });

  it('未显式选择时默认按工作区续问', () => {
    expect(resolveSessionPolicy({ createNewSession: false })).toBe('continue_current_by_workspace');
    expect(resolveSessionPolicy({})).toBe('continue_current_by_workspace');
  });
});
