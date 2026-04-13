/**
 * V1.4.0 - Compaction Store
 * Zustand store for context compression state management
 */

import { create } from 'zustand';
import type {
  CompactionReport,
  CompactionSettings,
  ContextUsageState,
  CompressionTriggerStatus,
} from '../types/compaction';
import { DEFAULT_COMPACTION_SETTINGS, getCompressionStatus } from '../types/compaction';

/**
 * Compaction store state
 */
interface CompactionState {
  // Compression reports
  reports: CompactionReport[];
  selectedReportId: string | null;

  // Context usage tracking
  contextUsage: ContextUsageState;

  // Settings
  settings: CompactionSettings;

  // UI state
  isDrawerOpen: boolean;
  isCompressing: boolean;

  // Actions
  addReport: (report: CompactionReport) => void;
  selectReport: (id: string | null) => void;
  clearReports: () => void;

  updateContextUsage: (inputTokens: number) => void;
  resetContextUsage: () => void;

  updateSettings: (settings: Partial<CompactionSettings>) => void;
  resetSettings: () => void;

  setDrawerOpen: (open: boolean) => void;
  setCompressing: (compressing: boolean) => void;

  // Computed
  getCompressionStatus: () => CompressionTriggerStatus;
  getTotalSavings: () => number;
}

/**
 * Initial context usage state
 */
const initialContextUsage: ContextUsageState = {
  totalInputTokens: 0,
  estimatedWindow: 128000, // Conservative default
  usagePct: 0,
  lastUpdated: Date.now(),
};

/**
 * Create compaction store
 */
export const useCompactionStore = create<CompactionState>((set, get) => ({
  // Initial state
  reports: [],
  selectedReportId: null,
  contextUsage: initialContextUsage,
  settings: DEFAULT_COMPACTION_SETTINGS,
  isDrawerOpen: false,
  isCompressing: false,

  // Actions
  addReport: (report) => {
    set((state) => ({
      reports: [report, ...state.reports].slice(0, 100), // Keep last 100 reports
    }));
  },

  selectReport: (id) => {
    set({ selectedReportId: id });
  },

  clearReports: () => {
    set({ reports: [], selectedReportId: null });
  },

  updateContextUsage: (inputTokens) => {
    set((state) => {
      const totalInputTokens = state.contextUsage.totalInputTokens + inputTokens;
      const usagePct = (totalInputTokens / state.contextUsage.estimatedWindow) * 100;
      return {
        contextUsage: {
          totalInputTokens,
          estimatedWindow: state.contextUsage.estimatedWindow,
          usagePct: Math.min(usagePct, 100),
          lastUpdated: Date.now(),
        },
      };
    });
  },

  resetContextUsage: () => {
    set({ contextUsage: initialContextUsage });
  },

  updateSettings: (updates) => {
    set((state) => ({
      settings: { ...state.settings, ...updates },
    }));
  },

  resetSettings: () => {
    set({ settings: DEFAULT_COMPACTION_SETTINGS });
  },

  setDrawerOpen: (open) => {
    set({ isDrawerOpen: open });
  },

  setCompressing: (compressing) => {
    set({ isCompressing: compressing });
  },

  // Computed values
  getCompressionStatus: () => {
    const { usagePct } = get().contextUsage;
    return getCompressionStatus(usagePct);
  },

  getTotalSavings: () => {
    const { reports } = get();
    if (reports.length === 0) return 0;
    const totalBefore = reports.reduce((sum, r) => sum + r.beforeTokens, 0);
    const totalAfter = reports.reduce((sum, r) => sum + r.afterTokens, 0);
    if (totalBefore === 0) return 0;
    return ((totalBefore - totalAfter) / totalBefore) * 100;
  },
}));

/**
 * Selector hooks for specific state slices
 */
export const useCompressionStatus = () => useCompactionStore((s) => s.getCompressionStatus());
export const useCompactionReports = () => useCompactionStore((s) => s.reports);
export const useCompactionSettings = () => useCompactionStore((s) => s.settings);
export const useIsDrawerOpen = () => useCompactionStore((s) => s.isDrawerOpen);
