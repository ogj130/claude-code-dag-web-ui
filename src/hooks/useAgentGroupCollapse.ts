/**
 * V1.4.0 - useAgentGroupCollapse Hook
 * Manages collapse/expand state for Agent Group nodes
 */

import { useCallback, useMemo } from 'react';
import { useNodes } from '@xyflow/react';
import { useTaskStore } from '../stores/useTaskStore';
import type { Node } from '@xyflow/react';


/**
 * Hook to manage Agent Group collapse/expand state
 */
export function useAgentGroupCollapse() {
  const nodes = useNodes();
  const { collapsedAgentIds, setCollapsedAgentIds } = useTaskStore();

  /**
   * Toggle collapse state for a single agent node
   */
  const toggleCollapse = useCallback((nodeId: string) => {
    setCollapsedAgentIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  }, [setCollapsedAgentIds]);

  /**
   * Expand all agent group nodes
   */
  const expandAll = useCallback(() => {
    setCollapsedAgentIds(new Set());
  }, [setCollapsedAgentIds]);

  /**
   * Collapse all agent group nodes
   */
  const collapseAll = useCallback(() => {
    const agentNodeIds = nodes
      .filter((n) => n.type === 'agent_group' || n.data?.agentName)
      .map((n) => n.id);
    setCollapsedAgentIds(new Set(agentNodeIds));
  }, [nodes, setCollapsedAgentIds]);

  /**
   * Check if a specific node is collapsed
   */
  const isCollapsed = useCallback((nodeId: string): boolean => {
    return collapsedAgentIds.has(nodeId);
  }, [collapsedAgentIds]);

  /**
   * Get collapsed nodes (hidden children)
   */
  const collapsedNodes = useMemo(() => {
    return nodes.filter((n) => collapsedAgentIds.has(n.id));
  }, [nodes, collapsedAgentIds]);

  /**
   * Get visible nodes (not hidden by collapsed parent)
   */
  const visibleNodes = useMemo(() => {
    return nodes.filter((n) => {
      // Root level nodes are always visible
      if (!n.parentId) return true;

      // Check if any ancestor is collapsed
      let current: Node | undefined = n;
      while (current?.parentId) {
        if (collapsedAgentIds.has(current.parentId)) {
          return false;
        }
        current = nodes.find((n) => n.id === current?.parentId);
      }
      return true;
    });
  }, [nodes, collapsedAgentIds]);

  /**
   * Focus on a specific branch (collapse siblings)
   */
  const focusBranch = useCallback((nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node?.parentId) return;

    // Find all siblings
    const siblings = nodes.filter((n) => n.parentId === node.parentId);
    const siblingIds = siblings
      .filter((n) => n.id !== nodeId)
      .map((n) => n.id);

    // Collapse siblings
    setCollapsedAgentIds((prev) => {
      const newSet = new Set(prev);
      siblingIds.forEach((id) => newSet.add(id));
      return newSet;
    });
  }, [nodes, setCollapsedAgentIds]);

  /**
   * Count of collapsed agent groups
   */
  const collapsedCount = collapsedAgentIds.size;

  /**
   * Count of expanded agent groups
   */
  const expandedCount = nodes.filter(
    (n) => n.type === 'agent_group' || n.data?.agentName
  ).length - collapsedCount;

  return {
    toggleCollapse,
    expandAll,
    collapseAll,
    isCollapsed,
    collapsedNodes,
    visibleNodes,
    focusBranch,
    collapsedAgentIds,
    collapsedCount,
    expandedCount,
  };
}

/**
 * Hook to get collapse callback for a specific node
 */
export function useNodeCollapseCallback(nodeId: string) {
  const { toggleCollapse } = useAgentGroupCollapse();
  return useCallback(() => toggleCollapse(nodeId), [nodeId, toggleCollapse]);
}
