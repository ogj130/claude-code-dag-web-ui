import { create } from 'zustand';

export type DockContainerType = 'panel' | 'drawer' | 'modal';

export interface DockState {
  activeItemId: string | null;
  activeSubItemId: string | null;
  isPanelOpen: boolean;
  containerType: DockContainerType | null;
  hoveredItemId: string | null;

  openPanel: (itemId: string) => void;
  openSubItem: (groupId: string, subItemId: string, type: DockContainerType) => void;
  closePanel: () => void;
  setHoveredItem: (itemId: string | null) => void;
}

export const useDockStore = create<DockState>((set, get) => ({
  activeItemId: null,
  activeSubItemId: null,
  isPanelOpen: false,
  containerType: null,
  hoveredItemId: null,

  openPanel: (itemId: string) => {
    const current = get();
    // Toggle: clicking same group closes the sub-grid panel
    if (current.activeItemId === itemId && current.isPanelOpen && current.containerType === 'panel') {
      set({ activeItemId: null, activeSubItemId: null, isPanelOpen: false, containerType: null });
    } else {
      set({ activeItemId: itemId, activeSubItemId: null, isPanelOpen: true, containerType: 'panel' });
    }
  },

  openSubItem: (groupId: string, subItemId: string, type: DockContainerType) => {
    const current = get();
    // Toggle: clicking same sub-item closes
    if (current.activeSubItemId === subItemId && current.isPanelOpen) {
      set({ activeItemId: null, activeSubItemId: null, isPanelOpen: false, containerType: null });
    } else {
      set({ activeItemId: groupId, activeSubItemId: subItemId, isPanelOpen: true, containerType: type });
    }
  },

  closePanel: () => {
    set({ activeItemId: null, activeSubItemId: null, isPanelOpen: false, containerType: null });
  },

  setHoveredItem: (itemId: string | null) => {
    set({ hoveredItemId: itemId });
  },
}));
