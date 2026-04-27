import { create } from 'zustand';

export interface DockState {
  activeItemId: string | null;
  isPanelOpen: boolean;
  hoveredItemId: string | null;

  openPanel: (itemId: string) => void;
  closePanel: () => void;
  setHoveredItem: (itemId: string | null) => void;
}

export const useDockStore = create<DockState>((set, get) => ({
  activeItemId: null,
  isPanelOpen: false,
  hoveredItemId: null,

  openPanel: (itemId: string) => {
    const current = get();
    if (current.activeItemId === itemId && current.isPanelOpen) {
      set({ activeItemId: null, isPanelOpen: false });
    } else {
      set({ activeItemId: itemId, isPanelOpen: true });
    }
  },

  closePanel: () => {
    set({ activeItemId: null, isPanelOpen: false });
  },

  setHoveredItem: (itemId: string | null) => {
    set({ hoveredItemId: itemId });
  },
}));
