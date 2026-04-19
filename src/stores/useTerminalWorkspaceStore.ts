/**
 * useTerminalWorkspaceStore — Terminal 侧 UI 状态管理
 *
 * 管理：
 * - 当前选中的工作区标签（activeWorkspaceId）
 * - 全局摘要面板展开状态（isGlobalSummaryExpanded / currentBatchId）
 * - 当前运行中的工作区集合（runningWorkspaces）
 *
 * 与 useMultiDispatchStore 互补：后者管理 batchResult 和 AI 分析，
 * 本 store 管理 TerminalView 的 UI 交互状态。
 */

import { create } from 'zustand';

export type ExecutionStatus = 'idle' | 'running' | 'success' | 'partial' | 'failed';

interface TerminalWorkspaceState {
  activeWorkspaceId: string | null;
  isGlobalSummaryExpanded: boolean;
  runningWorkspaces: Set<string>;
  currentBatchId: string | null;
}

interface TerminalWorkspaceActions {
  setActiveWorkspace: (workspaceId: string) => void;
  expandGlobalSummary: (batchId: string) => void;
  collapseGlobalSummary: () => void;
  addRunningWorkspace: (workspaceId: string) => void;
  removeRunningWorkspace: (workspaceId: string) => void;
  reset: () => void;
}

type TerminalWorkspaceStore = TerminalWorkspaceState & TerminalWorkspaceActions;

const initialState: TerminalWorkspaceState = {
  activeWorkspaceId: null,
  isGlobalSummaryExpanded: false,
  runningWorkspaces: new Set<string>(),
  currentBatchId: null,
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
}));
