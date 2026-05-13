/**
 * useMultiDispatchStore — 多工作区 Dispatch 全局状态
 *
 * 包含 batchResult、batchId、allCompleted 等状态
 */

import { create } from 'zustand';
import type { DispatchWorkspaceResult } from '@/types/global-dispatch';

type AnalysisStatus = 'idle' | 'loading' | 'success' | 'error';

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
  /** 分析任务状态 */
  analysisStatus: AnalysisStatus;
  /** 分析结果 */
  analysisResult: unknown;
  /** 分析错误信息 */
  analysisError: string | null;
  /** 当前分析请求 ID（用于防竞态） */
  analysisRequestId: number | null;
  /** 分析发起时的范围快照（用于 stale 判定） */
  analysisScopeSnapshot: string[];
  /** 分析结果生成时间 */
  analysisGeneratedAt: number | null;
}

interface MultiDispatchActions {
  setBatchResult: (result: DispatchWorkspaceResult[] | null) => void;
  setBatchId: (id: string | null) => void;
  setAllCompleted: (completed: boolean) => void;
  setActive: (active: boolean) => void;
  /** 请求 AI 分析（GlobalSummaryPanel 的 [查看全局分析] 触发） */
  requestAnalysis: () => void;
  /** 启动分析任务 */
  startAnalysis: (workspaceIds: string[], requestId: number) => void;
  /** 完成分析任务（防竞态：requestId 不匹配则忽略） */
  finishAnalysis: (requestId: number, result: unknown) => void;
  /** 分析失败（防竞态：requestId 不匹配则忽略） */
  failAnalysis: (requestId: number, error: string) => void;
  reset: () => void;
}

type MultiDispatchStore = MultiDispatchState & MultiDispatchActions;

const initialState: MultiDispatchState = {
  batchResult: null,
  batchId: null,
  allCompleted: false,
  isActive: false,
  analysisRequested: false,
  analysisStatus: 'idle',
  analysisResult: null,
  analysisError: null,
  analysisRequestId: null,
  analysisScopeSnapshot: [],
  analysisGeneratedAt: null,
};

export const useMultiDispatchStore = create<MultiDispatchStore>((set) => ({
  ...initialState,

  setBatchResult: (result) => set({ batchResult: result }),

  setBatchId: (id) => set({ batchId: id }),

  setAllCompleted: (completed) => set({ allCompleted: completed }),

  setActive: (active) => set({ isActive: active }),

  requestAnalysis: () => set({ analysisRequested: true }),

  startAnalysis: (workspaceIds, requestId) =>
    set({
      analysisStatus: 'loading',
      analysisError: null,
      analysisRequestId: requestId,
      analysisScopeSnapshot: workspaceIds,
    }),

  finishAnalysis: (requestId, result) =>
    set((state) => {
      if (state.analysisRequestId !== requestId) return state;
      return {
        analysisStatus: 'success',
        analysisResult: result,
        analysisGeneratedAt: Date.now(),
      };
    }),

  failAnalysis: (requestId, error) =>
    set((state) => {
      if (state.analysisRequestId !== requestId) return state;
      return {
        analysisStatus: 'error',
        analysisError: error,
      };
    }),

  reset: () => set(initialState),
}));
