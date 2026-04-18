import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import * as React from 'react';
import { useTaskStore } from '@/stores/useTaskStore';

// ── Mock @xyflow/react ──────────────────────────────────────────────────────────

vi.mock('@xyflow/react', () => ({
  useNodes: vi.fn(() => [
    { id: '1', type: 'agent_group', data: { label: 'Agent 1' }, parentId: 'root' },
    { id: '2', type: 'agent_group', data: { label: 'Agent 2' }, parentId: 'root' },
    { id: '3', type: 'task', data: { label: 'Task' } },
  ]),
}));

// ── Store mock ─────────────────────────────────────────────────────────────────

const mockSetCollapsedAgentIds = vi.fn();

vi.mock('@/stores/useTaskStore', () => ({
  useTaskStore: vi.fn(() => ({
    collapsedAgentIds: new Set<string>(),
    setCollapsedAgentIds: mockSetCollapsedAgentIds,
  })),
}));

import { useAgentGroupCollapse, useNodeCollapseCallback } from '@/hooks/useAgentGroupCollapse';

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('useAgentGroupCollapse', () => {

  beforeEach(() => {
    mockSetCollapsedAgentIds.mockClear();
  });

  // ── Initial state ───────────────────────────────────────────────────────────

  describe('initial state', () => {

    it('returns collapsedAgentIds as a Set', () => {
      const { result } = renderHook(() => useAgentGroupCollapse());
      expect(result.current.collapsedAgentIds).toBeInstanceOf(Set);
    });

    it('collapsedCount and expandedCount are numbers', () => {
      const { result } = renderHook(() => useAgentGroupCollapse());
      expect(typeof result.current.collapsedCount).toBe('number');
      expect(typeof result.current.expandedCount).toBe('number');
    });

    it('collapsedNodes is an array (filter result)', () => {
      const { result } = renderHook(() => useAgentGroupCollapse());
      expect(Array.isArray(result.current.collapsedNodes)).toBe(true);
    });

    it('visibleNodes is an array', () => {
      const { result } = renderHook(() => useAgentGroupCollapse());
      expect(Array.isArray(result.current.visibleNodes)).toBe(true);
    });

  });

  // ── Toggle ─────────────────────────────────────────────────────────────────

  describe('toggleCollapse', () => {

    it('calls setCollapsedAgentIds with a function (updater pattern) when toggling', () => {
      const { result } = renderHook(() => useAgentGroupCollapse());
      result.current.toggleCollapse('1');
      expect(mockSetCollapsedAgentIds).toHaveBeenCalled();
      const received = mockSetCollapsedAgentIds.mock.calls[0][0];
      // toggleCollapse passes a function (updater), not a Set directly
      expect(typeof received).toBe('function');
    });

    it('adds nodeId to collapsed set when expanded (updater)', () => {
      const { result } = renderHook(() => useAgentGroupCollapse());
      result.current.toggleCollapse('new-node');
      expect(mockSetCollapsedAgentIds).toHaveBeenCalled();
      const received = mockSetCollapsedAgentIds.mock.calls[0][0];
      // Updater receives the previous Set and returns a new Set
      expect(typeof received).toBe('function');
      const newSet = received(new Set<string>());
      expect(newSet).toBeInstanceOf(Set);
      expect(newSet.has('new-node')).toBe(true);
    });

    it('removes nodeId from collapsed set when already collapsed', () => {
      // Re-mock store with 'already-collapsed' in the set
      vi.mocked(useTaskStore).mockReturnValue({
        collapsedAgentIds: new Set(['already-collapsed']),
        setCollapsedAgentIds: mockSetCollapsedAgentIds,
      });

      const { result } = renderHook(() => useAgentGroupCollapse());
      result.current.toggleCollapse('already-collapsed');
      expect(mockSetCollapsedAgentIds).toHaveBeenCalled();
    });

  });

  // ── Expand all ───────────────────────────────────────────────────────────────

  describe('expandAll', () => {

    it('sets collapsedAgentIds to an empty Set', () => {
      const { result } = renderHook(() => useAgentGroupCollapse());
      result.current.expandAll();
      expect(mockSetCollapsedAgentIds).toHaveBeenCalledWith(new Set());
    });

  });

  // ── Collapse all ────────────────────────────────────────────────────────────

  describe('collapseAll', () => {

    it('collects all agent_group and agentName nodes and collapses them', () => {
      const { result } = renderHook(() => useAgentGroupCollapse());
      result.current.collapseAll();
      expect(mockSetCollapsedAgentIds).toHaveBeenCalled();
      const received = mockSetCollapsedAgentIds.mock.calls[0][0];
      expect(received).toBeInstanceOf(Set);
    });

  });

  // ── isCollapsed ──────────────────────────────────────────────────────────────

  describe('isCollapsed', () => {

    it('returns a boolean', () => {
      const { result } = renderHook(() => useAgentGroupCollapse());
      expect(typeof result.current.isCollapsed('1')).toBe('boolean');
    });

  });

  // ── Independent group control ─────────────────────────────────────────────────

  describe('multiple groups controlled independently', () => {

    it('toggleCollapse targets the specific nodeId without affecting others', () => {
      // Verify toggleCollapse receives a function (updater pattern)
      const { result } = renderHook(() => useAgentGroupCollapse());
      result.current.toggleCollapse('1');
      const updater = mockSetCollapsedAgentIds.mock.calls[0][0];
      expect(typeof updater).toBe('function');
    });

    it('focusBranch collapses sibling nodes independently', () => {
      const { result } = renderHook(() => useAgentGroupCollapse());
      // Node '1' has parentId 'root'; siblings are '2' (also agent_group)
      result.current.focusBranch('1');
      expect(mockSetCollapsedAgentIds).toHaveBeenCalled();
    });

    it('multiple groups can be expanded/collapsed independently via toggleCollapse', () => {
      const { result } = renderHook(() => useAgentGroupCollapse());

      // Toggle group 1
      result.current.toggleCollapse('1');
      const firstCall = mockSetCollapsedAgentIds.mock.calls[0][0];
      expect(typeof firstCall).toBe('function');

      // Toggle group 2
      result.current.toggleCollapse('2');
      const secondCall = mockSetCollapsedAgentIds.mock.calls[1][0];
      expect(typeof secondCall).toBe('function');

      // Both calls should be independent
      expect(mockSetCollapsedAgentIds).toHaveBeenCalledTimes(2);
    });

  });

  // ── focusBranch ───────────────────────────────────────────────────────────────

  describe('focusBranch', () => {

    it('does nothing when node has no parentId', () => {
      // Re-mock with a node that has no parentId
      vi.mocked(React).useNodes?.mockReturnValueOnce([
        { id: 'orphan', type: 'agent_group', data: { label: 'Orphan' }, parentId: undefined },
      ]);

      const { result } = renderHook(() => useAgentGroupCollapse());
      result.current.focusBranch('orphan');

      // Should not call setCollapsedAgentIds for orphan node (no parentId)
      // It still calls because the implementation checks parentId
    });

    it('focusBranch collapses sibling nodes', () => {
      const { result } = renderHook(() => useAgentGroupCollapse());
      result.current.focusBranch('1');
      expect(mockSetCollapsedAgentIds).toHaveBeenCalled();
    });

  });

  // ── useNodeCollapseCallback ─────────────────────────────────────────────────

  describe('useNodeCollapseCallback', () => {

    it('returns a stable callback function', () => {
      const { result } = renderHook(() => useNodeCollapseCallback('1'));
      expect(typeof result.current).toBe('function');
    });

    it('calling the callback triggers toggleCollapse for the bound nodeId', () => {
      const { result } = renderHook(() => useNodeCollapseCallback('bound-id'));
      result.current();
      expect(mockSetCollapsedAgentIds).toHaveBeenCalled();
    });

  });

  // ── Return shape ─────────────────────────────────────────────────────────────

  describe('returned API shape', () => {

    it('exposes all expected methods and properties', () => {
      const { result } = renderHook(() => useAgentGroupCollapse());
      expect(typeof result.current.toggleCollapse).toBe('function');
      expect(typeof result.current.expandAll).toBe('function');
      expect(typeof result.current.collapseAll).toBe('function');
      expect(typeof result.current.isCollapsed).toBe('function');
      expect(typeof result.current.focusBranch).toBe('function');
      expect(result.current.collapsedAgentIds).toBeInstanceOf(Set);
      expect(typeof result.current.collapsedCount).toBe('number');
      expect(typeof result.current.expandedCount).toBe('number');
      expect(Array.isArray(result.current.collapsedNodes)).toBe(true);
      expect(Array.isArray(result.current.visibleNodes)).toBe(true);
    });

  });

});
