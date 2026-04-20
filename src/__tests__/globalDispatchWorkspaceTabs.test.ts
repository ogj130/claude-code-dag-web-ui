import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from '@testing-library/react';
import { useTerminalWorkspaceStore } from '../../src/stores/useTerminalWorkspaceStore';

describe('workspace tabs lifecycle', () => {
  beforeEach(() => {
    // Reset store state
    useTerminalWorkspaceStore.setState({
      activeTab: 'global',
      workspaceTabs: [],
    });
    // Reset module-level variables
    vi.resetModules();
  });

  it('onExecutionStart adds all workspace tabs with running status', () => {
    const workspaces = [
      { id: 'ws-A', name: '工作区 A' },
      { id: 'ws-B', name: '工作区 B' },
    ];
    act(() => {
      useTerminalWorkspaceStore.getState().onExecutionStart(workspaces);
    });
    const tabs = useTerminalWorkspaceStore.getState().workspaceTabs;
    expect(tabs).toHaveLength(2);
    expect(tabs.map(t => t.status)).toEqual(['running', 'running']);
    expect(tabs.map(t => t.id)).toEqual(['ws-A', 'ws-B']);
  });

  it('updateWorkspaceTab updates individual tab status', () => {
    const workspaces = [{ id: 'ws-A', name: 'A' }];
    act(() => {
      useTerminalWorkspaceStore.getState().onExecutionStart(workspaces);
      useTerminalWorkspaceStore.getState().updateWorkspaceTab('ws-A', 'completed');
    });
    const tabs = useTerminalWorkspaceStore.getState().workspaceTabs;
    expect(tabs[0].status).toBe('completed');
  });

  it('clearWorkspaceTabs removes all tabs', () => {
    const workspaces = [{ id: 'ws-A', name: 'A' }];
    act(() => {
      useTerminalWorkspaceStore.getState().onExecutionStart(workspaces);
      useTerminalWorkspaceStore.getState().clearWorkspaceTabs();
    });
    expect(useTerminalWorkspaceStore.getState().workspaceTabs).toEqual([]);
  });
});
