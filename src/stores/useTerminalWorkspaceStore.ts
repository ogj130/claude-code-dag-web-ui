/**
 * useTerminalWorkspaceStore — Terminal 侧 UI 状态管理
 *
 * 管理：
 * - 当前选中的工作区标签（activeWorkspaceId）
 * - 全局摘要面板展开状态（isGlobalSummaryExpanded / currentBatchId）
 * - 当前运行中的工作区集合（runningWorkspaces）
 * - 动态工作区标签（workspaceTabs / activeTab）
 *
 * 与 useMultiDispatchStore 互补：后者管理 batchResult 和 AI 分析，
 * 本 store 管理 TerminalView 的 UI 交互状态。
 */

import { create } from 'zustand';

export type ExecutionStatus = 'idle' | 'running' | 'success' | 'partial' | 'failed';

// 动态工作区标签状态
export type TabStatus = 'idle' | 'running' | 'completed' | 'error';

export interface WorkspaceTab {
  id: string;
  name: string;
  status: TabStatus;
  addedAt: number;
  batchId: number;
}

// 竞态安全：模块级 timer 引用
let removalTimer: ReturnType<typeof setTimeout> | null = null;
let executionBatchId = 0;

interface TerminalWorkspaceState {
  activeWorkspaceId: string | null;
  isGlobalSummaryExpanded: boolean;
  runningWorkspaces: Set<string>;
  currentBatchId: string | null;
  // 新增：视图切换状态
  activeTab: 'global' | string;
  // 新增：动态工作区标签
  workspaceTabs: WorkspaceTab[];
}

interface TerminalWorkspaceActions {
  setActiveWorkspace: (workspaceId: string) => void;
  expandGlobalSummary: (batchId: string) => void;
  collapseGlobalSummary: () => void;
  addRunningWorkspace: (workspaceId: string) => void;
  removeRunningWorkspace: (workspaceId: string) => void;
  reset: () => void;
  // 新增：开始执行时添加所有工作区标签
  onExecutionStart: (workspaces: Array<{ id: string; name: string }>) => void;
  // 新增：单个状态更新
  updateWorkspaceTab: (workspaceId: string, status: TabStatus) => void;
  // 新增：所有完成时竞态安全的延迟移除
  onAllCompleted: () => void;
  // 新增：重置标签
  clearWorkspaceTabs: () => void;
  // 新增：视图切换
  setActiveTab: (tab: 'global' | string) => void;
}

type TerminalWorkspaceStore = TerminalWorkspaceState & TerminalWorkspaceActions;

const initialState: TerminalWorkspaceState = {
  activeWorkspaceId: null,
  isGlobalSummaryExpanded: false,
  runningWorkspaces: new Set<string>(),
  currentBatchId: null,
  activeTab: 'global',
  workspaceTabs: [],
};

export const useTerminalWorkspaceStore = create<TerminalWorkspaceStore>((set) => ({
  ...initialState,

  setActiveWorkspace: (workspaceId) => set({ activeWorkspaceId: workspaceId }),

  expandGlobalSummary: (batchId) =>
    set({
      isGlobalSummaryExpanded: true,
      currentBatchId: batchId,
    }),

  collapseGlobalSummary: () =>
    set({
      isGlobalSummaryExpanded: false,
    }),

  addRunningWorkspace: (workspaceId) =>
    set((state) => ({
      runningWorkspaces: new Set(state.runningWorkspaces).add(workspaceId),
    })),

  removeRunningWorkspace: (workspaceId) =>
    set((state) => {
      const next = new Set(state.runningWorkspaces);
      next.delete(workspaceId);
      return { runningWorkspaces: next };
    }),

  reset: () =>
    set({ ...initialState, runningWorkspaces: new Set<string>() }),

  // 新增：视图切换
  setActiveTab: (tab) => set({ activeTab: tab }),

  // 新增：开始执行时添加所有工作区标签
  onExecutionStart: (workspaces) => {
    // 取消待执行的移除计时器
    if (removalTimer !== null) {
      clearTimeout(removalTimer);
      removalTimer = null;
    }
    executionBatchId++;
    const batchId = executionBatchId;
    set(() => ({
      workspaceTabs: workspaces.map((ws) => ({
        id: ws.id,
        name: ws.name,
        status: 'running' as TabStatus,
        addedAt: Date.now(),
        batchId,
      })),
    }));
  },

  // 新增：单个状态更新
  updateWorkspaceTab: (workspaceId, status) =>
    set((state) => ({
      workspaceTabs: state.workspaceTabs.map((tab) =>
        tab.id === workspaceId ? { ...tab, status } : tab
      ),
    })),

  // 新增：所有完成时竞态安全的延迟移除
  onAllCompleted: () => {
    const batchId = executionBatchId;
    removalTimer = setTimeout(() => {
      const current = useTerminalWorkspaceStore.getState();
      if (current.workspaceTabs.length > 0 && current.workspaceTabs[0].batchId === batchId) {
        useTerminalWorkspaceStore.setState({ workspaceTabs: [] });
      }
      removalTimer = null;
    }, 5000);
  },

  // 新增：重置标签
  clearWorkspaceTabs: () => set({ workspaceTabs: [] }),
}));
