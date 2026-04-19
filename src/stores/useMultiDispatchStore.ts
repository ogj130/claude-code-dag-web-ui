/**
 * useMultiDispatchStore — 多工作区 Dispatch 全局状态
 *
 * 包含 batchResult、batchId、allCompleted 等状态
 */

import { create } from 'zustand';
import type { DispatchWorkspaceResult } from '@/types/global-dispatch';

interface MultiDispatchState {
  /** 当前批次的所有工作区执行结果 */
  batchResult: DispatchWorkspaceResult[] | null;
  /** 当前批次 ID */
  batchId: string | null;
  /** 是否全部完成 */
  allCompleted: boolean;
  /** 是否处于活跃状态 */
  isActive: boolean;
  /** 是否请求 AI 分析（由 GlobalSummaryPanel 触发） */
  analysisRequested: boolean;
}

interface MultiDispatchActions {
  setBatchResult: (result: DispatchWorkspaceResult[] | null) => void;
  setBatchId: (id: string | null) => void;
  setAllCompleted: (completed: boolean) => void;
  setActive: (active: boolean) => void;
  /** 请求 AI 分析（GlobalSummaryPanel 的 [查看全局分析] 触发） */
  requestAnalysis: () => void;
  reset: () => void;
}

type MultiDispatchStore = MultiDispatchState & MultiDispatchActions;

const initialState: MultiDispatchState = {
  batchResult: null,
  batchId: null,
  allCompleted: false,
  isActive: false,
  analysisRequested: false,
};

export const useMultiDispatchStore = create<MultiDispatchStore>((set) => ({
  ...initialState,

  setBatchResult: (result) => set({ batchResult: result }),

  setBatchId: (id) => set({ batchId: id }),

  setAllCompleted: (completed) => set({ allCompleted: completed }),

  setActive: (active) => set({ isActive: active }),

  requestAnalysis: () => set({ analysisRequested: true }),

  reset: () => set(initialState),
}));
