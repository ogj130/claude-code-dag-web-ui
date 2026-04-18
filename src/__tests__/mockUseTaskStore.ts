/**
 * Mock for @/stores/useTaskStore — Zustand store
 *
 * Provides:
 * - A mockable useTaskStore hook that returns configurable state
 * - A resetStore() helper to reconfigure state between test renders
 * - Exposed mock functions (collapseAllGroups, etc.) for assertions
 *
 * Usage in tests:
 *   import { mockUseTaskStore, resetStore, mockCollapseAllGroups } from './mockUseTaskStore';
 */
import { vi } from 'vitest';

const _mockCollapseAllGroups = vi.fn();
const _mockToggleDagQueryCollapse = vi.fn();
const _mockToggleGroupExpand = vi.fn();

const _mockState = {
  nodes: new Map<string, Record<string, unknown>>(),
  collapsedDagQueryIds: new Set<string>(),
  currentQueryId: null as string | null,
  attachmentCountByQueryId: new Map<string, number>(),
  attachmentDataByQueryId: new Map<string, unknown>(),
  expandedGroupIds: new Set<string>(),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _mockUseTaskStore: any = () => ({
  ..._mockState,
  collapseAllGroups: _mockCollapseAllGroups,
  toggleDagQueryCollapse: _mockToggleDagQueryCollapse,
  toggleGroupExpand: _mockToggleGroupExpand,
});
_mockUseTaskStore.getState = () => ({
  ..._mockState,
  collapseAllGroups: _mockCollapseAllGroups,
  toggleDagQueryCollapse: _mockToggleDagQueryCollapse,
  toggleGroupExpand: _mockToggleGroupExpand,
});
_mockUseTaskStore.__collapseAllGroups = _mockCollapseAllGroups;

export const mockUseTaskStore = _mockUseTaskStore;
export const mockCollapseAllGroups = _mockCollapseAllGroups;
export const mockToggleDagQueryCollapse = _mockToggleDagQueryCollapse;
export const mockToggleGroupExpand = _mockToggleGroupExpand;

/**
 * Reset the store state and clear all mock function calls.
 * MUST be called BEFORE render() to ensure the component sees the right state.
 */
export function resetStore(overrides: Record<string, unknown> = {}) {
  _mockState.nodes.clear();
  _mockState.collapsedDagQueryIds.clear();
  _mockState.currentQueryId = null;
  _mockState.attachmentCountByQueryId.clear();
  _mockState.attachmentDataByQueryId.clear();
  _mockState.expandedGroupIds.clear();

  if (overrides.nodes !== undefined) {
    (overrides.nodes as Map<string, Record<string, unknown>>).forEach((v, k) => _mockState.nodes.set(k, v));
  }
  if (overrides.collapsedDagQueryIds !== undefined) {
    (overrides.collapsedDagQueryIds as Set<string>).forEach(v => _mockState.collapsedDagQueryIds.add(v));
  }

  _mockCollapseAllGroups.mockClear();
  _mockToggleDagQueryCollapse.mockClear();
  _mockToggleGroupExpand.mockClear();
}
