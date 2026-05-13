/**
 * useTerminalWorkspaceStore — TDD 测试
 *
 * 覆盖：
 * - activeWorkspaceId 初始为 null
 * - setActiveWorkspace 设置当前工作区
 * - expandGlobalSummary / collapseGlobalSummary 展开收起全局摘要面板
 * - addRunningWorkspace / removeRunningWorkspace 管理运行中工作区
 * - reset 还原所有状态
 */
import { afterEach, describe, expect, it } from 'vitest';
import { useTerminalWorkspaceStore } from '@/stores/useTerminalWorkspaceStore';

describe('useTerminalWorkspaceStore', () => {
  afterEach(() => {
    // 每个测试后重置 store 状态
    useTerminalWorkspaceStore.getState().reset();
  });

  // 1. 默认 activeWorkspaceId 为 null
  it('默认 activeWorkspaceId 为 null', () => {
    // 初始状态应直接来自初始值
    const state = useTerminalWorkspaceStore.getState();
    expect(state.activeWorkspaceId).toBeNull();
  });

  // 2. setActiveWorkspace 设置当前工作区
  it('setActiveWorkspace 设置当前工作区', () => {
    const { setActiveWorkspace } = useTerminalWorkspaceStore.getState();

    setActiveWorkspace('workspace-1');
    expect(useTerminalWorkspaceStore.getState().activeWorkspaceId).toBe('workspace-1');

    setActiveWorkspace('workspace-2');
    expect(useTerminalWorkspaceStore.getState().activeWorkspaceId).toBe('workspace-2');
  });

  // 3. expandGlobalSummary 设置展开状态和批次 ID
  it('expandGlobalSummary 设置展开状态和批次 ID', () => {
    const { expandGlobalSummary } = useTerminalWorkspaceStore.getState();

    expandGlobalSummary('batch-abc');

    const state = useTerminalWorkspaceStore.getState();
    expect(state.isGlobalSummaryExpanded).toBe(true);
    expect(state.currentBatchId).toBe('batch-abc');
  });

  // 4. collapseGlobalSummary 收起面板
  it('collapseGlobalSummary 收起面板', () => {
    const { expandGlobalSummary, collapseGlobalSummary } = useTerminalWorkspaceStore.getState();

    expandGlobalSummary('batch-xyz');
    collapseGlobalSummary();

    const state = useTerminalWorkspaceStore.getState();
    expect(state.isGlobalSummaryExpanded).toBe(false);
    // collapseGlobalSummary 不修改 currentBatchId
    expect(state.currentBatchId).toBe('batch-xyz');
  });

  // 5. addRunningWorkspace / removeRunningWorkspace 管理运行中工作区
  it('addRunningWorkspace 将工作区加入运行中集合', () => {
    const { addRunningWorkspace } = useTerminalWorkspaceStore.getState();

    addRunningWorkspace('ws-running-1');
    expect(useTerminalWorkspaceStore.getState().runningWorkspaces.has('ws-running-1')).toBe(true);

    addRunningWorkspace('ws-running-2');
    const { runningWorkspaces } = useTerminalWorkspaceStore.getState();
    expect(runningWorkspaces.has('ws-running-1')).toBe(true);
    expect(runningWorkspaces.has('ws-running-2')).toBe(true);
  });

  it('removeRunningWorkspace 将工作区从运行中集合移除', () => {
    const { addRunningWorkspace, removeRunningWorkspace } = useTerminalWorkspaceStore.getState();

    addRunningWorkspace('ws-to-remove');
    expect(useTerminalWorkspaceStore.getState().runningWorkspaces.has('ws-to-remove')).toBe(true);

    removeRunningWorkspace('ws-to-remove');
    expect(useTerminalWorkspaceStore.getState().runningWorkspaces.has('ws-to-remove')).toBe(false);
  });

  it('addRunningWorkspace 不会导致 Set 状态被意外修改（不可变原则）', () => {
    const { addRunningWorkspace } = useTerminalWorkspaceStore.getState();

    addRunningWorkspace('ws-immutable');
    const firstSet = useTerminalWorkspaceStore.getState().runningWorkspaces;

    addRunningWorkspace('ws-immutable-2');
    const secondSet = useTerminalWorkspaceStore.getState().runningWorkspaces;

    // 两次获取的 Set 引用应不同（每次 set 都创建新实例）
    expect(firstSet).not.toBe(secondSet);
    // firstSet 不应包含新添加的元素
    expect(firstSet.has('ws-immutable-2')).toBe(false);
  });

  // 6. reset 还原所有状态
  it('reset 还原所有状态', () => {
    const store = useTerminalWorkspaceStore.getState();

    store.setActiveWorkspace('ws-active');
    store.expandGlobalSummary('batch-reset');
    store.addRunningWorkspace('ws-running-reset');

    store.reset();

    const state = useTerminalWorkspaceStore.getState();
    expect(state.activeWorkspaceId).toBeNull();
    expect(state.isGlobalSummaryExpanded).toBe(false);
    expect(state.currentBatchId).toBeNull();
    expect(state.runningWorkspaces.size).toBe(0);
  });

  it('reset 后 runningWorkspaces 是全新的空 Set', () => {
    const store = useTerminalWorkspaceStore.getState();
    store.addRunningWorkspace('ws-before-reset');
    store.reset();

    const { runningWorkspaces } = store;
    expect(runningWorkspaces.size).toBe(0);
    // 新 Set 实例
    expect(runningWorkspaces.has('ws-before-reset')).toBe(false);
  });

  // ── workspace tabs lifecycle（合并自 globalDispatchWorkspaceTabs.test.ts）──

  it('onExecutionStart 添加所有工作区标签，初始状态为 running', () => {
    const workspaces = [
      { id: 'ws-A', name: '工作区 A' },
      { id: 'ws-B', name: '工作区 B' },
    ];
    useTerminalWorkspaceStore.getState().onExecutionStart(workspaces);
    const tabs = useTerminalWorkspaceStore.getState().workspaceTabs;
    expect(tabs).toHaveLength(2);
    expect(tabs.map(t => t.status)).toEqual(['running', 'running']);
    expect(tabs.map(t => t.id)).toEqual(['ws-A', 'ws-B']);
  });

  it('updateWorkspaceTab 更新单个标签状态', () => {
    const workspaces = [{ id: 'ws-A', name: 'A' }];
    const store = useTerminalWorkspaceStore.getState();
    store.onExecutionStart(workspaces);
    store.updateWorkspaceTab('ws-A', 'completed');
    const updated = useTerminalWorkspaceStore.getState();
    expect(updated.workspaceTabs[0].status).toBe('completed');
  });

  it('clearWorkspaceTabs 清除所有标签', () => {
    const workspaces = [{ id: 'ws-A', name: 'A' }];
    const store = useTerminalWorkspaceStore.getState();
    store.onExecutionStart(workspaces);
    store.clearWorkspaceTabs();
    expect(store.workspaceTabs).toEqual([]);
  });

  // ── 多工作区 UI state（Task 1: 扩展 store）──

  it('selectedDispatchWorkspaceIds 和 selectedAnalysisWorkspaceIds 分别存储', () => {
    useTerminalWorkspaceStore.getState().setSelectedDispatchWorkspaceIds(['ws-a', 'ws-b']);
    useTerminalWorkspaceStore.getState().setSelectedAnalysisWorkspaceIds(['ws-b']);

    expect(useTerminalWorkspaceStore.getState().selectedDispatchWorkspaceIds).toEqual(['ws-a', 'ws-b']);
    expect(useTerminalWorkspaceStore.getState().selectedAnalysisWorkspaceIds).toEqual(['ws-b']);
  });

  it('setActiveTab 切换到工作区时同步 activeWorkspaceId', () => {
    useTerminalWorkspaceStore.getState().setActiveTab('ws-a');

    expect(useTerminalWorkspaceStore.getState().activeTab).toBe('ws-a');
    expect(useTerminalWorkspaceStore.getState().activeWorkspaceId).toBe('ws-a');
  });

  it('activeTab 对应的工作区被禁用后回退到 global', () => {
    useTerminalWorkspaceStore.getState().setActiveTab('ws-gone');
    useTerminalWorkspaceStore.getState().reconcileEnabledWorkspaces(['ws-a', 'ws-b']);

    expect(useTerminalWorkspaceStore.getState().activeTab).toBe('global');
  });

  it('reconcileEnabledWorkspaces 清除禁用工作区的选择范围', () => {
    useTerminalWorkspaceStore.getState().setSelectedDispatchWorkspaceIds(['ws-a', 'ws-gone']);
    useTerminalWorkspaceStore.getState().setSelectedAnalysisWorkspaceIds(['ws-gone']);
    useTerminalWorkspaceStore.getState().reconcileEnabledWorkspaces(['ws-a', 'ws-b']);

    expect(useTerminalWorkspaceStore.getState().selectedDispatchWorkspaceIds).toEqual(['ws-a']);
    expect(useTerminalWorkspaceStore.getState().selectedAnalysisWorkspaceIds).toEqual([]);
  });

  it('markGlobalTerminalUsed 跟踪全局终端使用状态', () => {
    useTerminalWorkspaceStore.getState().markGlobalTerminalUsed();
    expect(useTerminalWorkspaceStore.getState().hasUsedGlobalTerminal).toBe(true);

    useTerminalWorkspaceStore.getState().clearGlobalTerminalUsage();
    expect(useTerminalWorkspaceStore.getState().hasUsedGlobalTerminal).toBe(false);
  });
});
