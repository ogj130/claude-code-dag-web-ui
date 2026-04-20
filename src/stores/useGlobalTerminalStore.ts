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
      return {
        workspaceChunks: { ...state.workspaceChunks, [workspaceId]: [...existing, chunk] },
        mergedOrder: [...state.mergedOrder, { workspaceId, chunk }],
      };
    });
  },

  getMergedContent: () => get().mergedOrder,

  reset: () => set(initialState),
}));
