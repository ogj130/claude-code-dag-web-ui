import { create } from 'zustand';

export interface MergedChunk {
  workspaceId: string;
  chunk: string;
}

interface GlobalTerminalState {
  workspaceChunks: Record<string, string[]>;
  mergedOrder: MergedChunk[];
}

interface GlobalTerminalActions {
  appendChunk: (workspaceId: string, chunk: string) => void;
  getMergedContent: () => MergedChunk[];
  reset: () => void;
}

type GlobalTerminalStore = GlobalTerminalState & GlobalTerminalActions;

const initialState: GlobalTerminalState = {
  workspaceChunks: {},
  mergedOrder: [],
};

export const useGlobalTerminalStore = create<GlobalTerminalStore>((set, get) => ({
  ...initialState,

  appendChunk: (workspaceId, chunk) => {
    set(state => {
      const existing = state.workspaceChunks[workspaceId] ?? [];
      // ── 幂等保护：防止双 WS 连接（globalDispatch + terminal）处理同一 session 时重复追加 ──
      // 两个 WS 连接收到相同事件流时（session 复用场景），最后一个 chunk 必然相同
      const lastChunk = existing[existing.length - 1];
      const lastMerged = state.mergedOrder[state.mergedOrder.length - 1];
      if (lastChunk === chunk && lastMerged?.workspaceId === workspaceId) {
        return state; // 跳过重复追加
      }
      return {
        workspaceChunks: { ...state.workspaceChunks, [workspaceId]: [...existing, chunk] },
        mergedOrder: [...state.mergedOrder, { workspaceId, chunk }],
      };
    });
  },

  getMergedContent: () => get().mergedOrder,

  reset: () => set(initialState),
}));
