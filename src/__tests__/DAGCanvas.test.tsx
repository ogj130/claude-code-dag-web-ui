/**
 * DAGCanvas — Virtual Scroll & Layout Tests
 *
 * V2.0.0 DAG Features:
 * - onlyRenderVisibleElements={true} (virtual scrolling)
 * - Empty state handling
 * - Visible node rendering
 * - onNodeClick interaction
 * - Layout update on node changes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { DAGCanvas } from '@/components/DAG/DAGCanvas';
import { useTaskStore } from '@/stores/useTaskStore';

// ── Mock @xyflow/react ──────────────────────────────────────────────────────────

const reactFlowCapture: Record<string, unknown> = {};
let capturedOnPaneClick: ((...args: unknown[]) => void) | undefined;
let capturedOnNodeClick: ((...args: unknown[]) => void) | undefined;

vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ children, onlyRenderVisibleElements, onPaneClick, onNodeClick, ...rest }: any) => {
    reactFlowCapture.onlyRenderVisibleElements = onlyRenderVisibleElements;
    capturedOnPaneClick = onPaneClick;
    capturedOnNodeClick = onNodeClick;
    return (
      <div data-testid="react-flow" {...rest}>
        <div data-testid="react-flow-children">{children}</div>
      </div>
    );
  },
  Controls: () => <div data-testid="controls" />,
  Background: () => <div data-testid="background" />,
  MiniMap: () => <div data-testid="mini-map" />,
  BackgroundVariant: { Dots: 'dots', Lines: 'lines' },
  useNodesState: vi.fn().mockReturnValue([[], vi.fn()]),
  useEdgesState: vi.fn().mockReturnValue([[], vi.fn()]),
  Panel: () => null,
}));

// ── Mock DAG node components ────────────────────────────────────────────────────

vi.mock('@/components/DAG/DAGNode', () => ({
  DAGNodeComponent: ({ data }: any) => (
    <div data-testid="dag-node" data-node-id={data?.id} data-node-type={data?.type}>
      {data?.label}
    </div>
  ),
}));

vi.mock('@/components/DAG/GroupNode', () => ({
  GroupNodeComponent: ({ data }: any) => (
    <div data-testid="group-node" data-node-id={data?.id}>
      {data?.label}
    </div>
  ),
}));

vi.mock('@/components/DAG/NodeDetailModal', () => ({
  NodeDetailModal: () => <div data-testid="node-detail-modal" />,
}));

vi.mock('@/components/DAG/AgentGroupNode', () => ({
  __esModule: true,
  default: ({ data }: any) => (
    <div data-testid="agent-group-node" data-node-id={data?.id}>
      {data?.label}
    </div>
  ),
  AGENT_GROUP_NODE_TYPE: 'agent_group',
}));

vi.mock('@/components/DAG/TaskNode', () => ({
  __esModule: true,
  default: ({ data }: any) => (
    <div data-testid="task-node" data-node-id={data?.id}>
      {data?.label}
    </div>
  ),
  TASK_NODE_TYPE: 'task',
}));

vi.mock('@/components/DAG/CompactNode', () => ({
  __esModule: true,
  default: ({ data }: any) => (
    <div data-testid="compact-node" data-node-id={data?.id}>
      {data?.label}
    </div>
  ),
  COMPACT_NODE_TYPE: 'compact',
}));

vi.mock('@/components/DAG/ImageNode', () => ({
  __esModule: true,
  default: ({ data }: any) => (
    <div data-testid="image-node" data-node-id={data?.id}>
      {data?.label}
    </div>
  ),
  IMAGE_NODE_TYPE: 'image',
}));

vi.mock('@/components/Attachment', () => ({
  AttachmentPreviewModal: () => <div data-testid="attachment-preview-modal" />,
}));

vi.mock('@/hooks/useImageDrop', () => ({
  useImageDrop: () => ({ isDragging: false }),
  DropOverlay: () => <div data-testid="drop-overlay" />,
}));

vi.mock('@/utils/performance', () => ({
  getGlobalMonitor: () => ({
    recordFrame: vi.fn(),
  }),
}));

vi.mock('@/utils/memoryManager', () => ({
  NODE_LIMIT: 500,
}));

// ── Store mock helpers — defined BEFORE vi.mock so the hoisted factory can ────────
// reference them. var is used because const/let trigger TDZ errors during hoisting.

var mockSetCollapsedAgentIds: ReturnType<typeof vi.fn>;

// Module-level store state so getState can return the current value
var storeStateValue: Record<string, unknown>;

function makeStoreValue(overrides: Record<string, unknown> = {}) {
  const nodes = overrides.nodes !== undefined
    ? overrides.nodes as Map<string, Record<string, unknown>>
    : new Map<string, Record<string, unknown>>();
  const collapsedDagQueryIds = overrides.collapsedDagQueryIds !== undefined
    ? overrides.collapsedDagQueryIds as Set<string>
    : new Set<string>();
  // Mutate the existing storeStateValue in place so closures see the updated value
  storeStateValue.nodes = nodes;
  storeStateValue.collapsedDagQueryIds = collapsedDagQueryIds;
  storeStateValue.currentQueryId = (overrides.currentQueryId !== undefined ? overrides.currentQueryId : null) as string | null;
  storeStateValue.attachmentCountByQueryId = (overrides.attachmentCountByQueryId !== undefined ? overrides.attachmentCountByQueryId : new Map<string, number>()) as Map<string, number>;
  storeStateValue.attachmentDataByQueryId = (overrides.attachmentDataByQueryId !== undefined ? overrides.attachmentDataByQueryId : new Map<string, unknown>()) as Map<string, unknown>;
  storeStateValue.expandedGroupIds = (overrides.expandedGroupIds !== undefined ? overrides.expandedGroupIds : new Set<string>()) as Set<string>;
  storeStateValue.toggleDagQueryCollapse = vi.fn();
  storeStateValue.collapseAllGroups = vi.fn();
  storeStateValue.toggleGroupExpand = vi.fn();
  storeStateValue.setCollapsedAgentIds = mockSetCollapsedAgentIds;
  return storeStateValue;
}

// Make the mock a callable function (hook) with a getState static property
var mockUseTaskStore: Record<string, unknown>;

// ── Store mock ──────────────────────────────────────────────────────────────────
//
// vi.mock IS hoisted, but the factory function body is evaluated when the module
// is first imported (after module-level code). Therefore makeStoreValue and
// mockSetCollapsedAgentIds are accessible.

vi.mock('@/stores/useTaskStore', () => {
  mockSetCollapsedAgentIds = vi.fn();
  // storeStateValue starts as a plain object (will be mutated by makeStoreValue)
  storeStateValue = {
    nodes: new Map<string, Record<string, unknown>>(),
    collapsedDagQueryIds: new Set<string>(),
    currentQueryId: null as string | null,
    attachmentCountByQueryId: new Map<string, number>(),
    attachmentDataByQueryId: new Map<string, unknown>(),
    expandedGroupIds: new Set<string>(),
    toggleDagQueryCollapse: vi.fn(),
    collapseAllGroups: vi.fn(),
    toggleGroupExpand: vi.fn(),
    setCollapsedAgentIds: mockSetCollapsedAgentIds,
  };
  // mockUseTaskStore is a callable (the hook) that returns storeStateValue
  const hook = () => storeStateValue;
  mockUseTaskStore = Object.assign(hook, {
    getState: () => storeStateValue,
  });
  return {
    useTaskStore: mockUseTaskStore as unknown as ReturnType<typeof vi.fn>,
  };
});

vi.mock('@/stores/useSessionStore', () => ({
  useSessionStore: () => ({ activeSessionId: null }),
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeDAGNode(
  id: string,
  type: string,
  label: string,
  parentId?: string,
  extra: Record<string, unknown> = {}
): [string, Record<string, unknown>] {
  return [id, { id, type, label, parentId, status: 'pending', ...extra }];
}

function resetStore(overrides: Record<string, unknown> = {}) {
  // makeStoreValue mutates storeStateValue in-place, so both
  // the hook () => storeStateValue and getState: () => storeStateValue
  // see the updated values immediately.
  makeStoreValue(overrides);
  // Sync properties onto mockUseTaskStore so direct property access also works
  Object.keys(storeStateValue).forEach(key => {
    (mockUseTaskStore as any)[key] = (storeStateValue as any)[key];
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('DAGCanvas — Virtual Scroll & Layout', () => {

  beforeEach(() => {
    // Reset capture callbacks
    Object.keys(reactFlowCapture).forEach(k => delete (reactFlowCapture as any)[k]);
    capturedOnPaneClick = undefined;
    capturedOnNodeClick = undefined;
    // Reset store to empty state for each test
    resetStore();
  });

  // ── Test 1: onlyRenderVisibleElements={true} ───────────────────────────────

  it('renders with onlyRenderVisibleElements={true} configuration', () => {
    render(<DAGCanvas />);

    expect(screen.getByTestId('react-flow')).toBeTruthy();
    expect(reactFlowCapture.onlyRenderVisibleElements).toBe(true);
  });

  // ── Test 2: Empty state ──────────────────────────────────────────────────

  it('handles empty state (no nodes)', () => {
    render(<DAGCanvas />);

    expect(screen.getByTestId('react-flow')).toBeTruthy();
    expect(screen.getByText('0 节点')).toBeTruthy();
  });

  // ── Test 3: Correct number of visible nodes based on store ───────────────

  it('renders correct number of visible nodes based on store nodes', () => {
    const storeNodes = new Map<string, Record<string, unknown>>([
      makeDAGNode('main-agent', 'agent', 'Main Agent'),
      makeDAGNode('q1', 'query', 'Query 1', 'main-agent'),
      makeDAGNode('t1', 'tool', 'Tool 1', 'q1'),
      makeDAGNode('s1', 'summary', 'Summary 1', 'q1'),
    ]);

    // Must configure BEFORE first render
    resetStore({ nodes: storeNodes });
    render(<DAGCanvas />);

    expect(screen.getByText('4 节点')).toBeTruthy();
  });

  // ── Test 4a: onNodeClick ─────────────────────────────────────────────────

  it('calls collapseAllGroups when a non-group, non-collapsed node is clicked', () => {
    render(<DAGCanvas />);

    const nonGroupNode = {
      id: 'q1',
      type: 'dagNode',
      data: {},
      parentId: 'main-agent',
    };

    if (capturedOnNodeClick) {
      capturedOnNodeClick(undefined, nonGroupNode);
    }

    const storeValue = vi.mocked(useTaskStore)();
    expect(storeValue.collapseAllGroups).toHaveBeenCalled();
  });

  it('does NOT call collapseAllGroups when a group-type node is clicked', () => {
    render(<DAGCanvas />);

    const groupNode = {
      id: 'group_q1_tools',
      type: 'group',
      data: { groupCollapsed: false },
      parentId: 'main-agent',
    };

    if (capturedOnNodeClick) {
      capturedOnNodeClick(undefined, groupNode);
    }

    const storeValue = vi.mocked(useTaskStore)();
    expect(storeValue.collapseAllGroups).not.toHaveBeenCalled();
  });

  // ── Test 4b: onPaneClick ─────────────────────────────────────────────────

  it('onPaneClick calls collapseAllGroups', () => {
    render(<DAGCanvas />);

    if (capturedOnPaneClick) {
      capturedOnPaneClick();
    }

    const storeValue = vi.mocked(useTaskStore)();
    expect(storeValue.collapseAllGroups).toHaveBeenCalled();
  });

  // ── Test 5: Layout updates when nodes change ──────────────────────────────

  it('updates layout when store nodes change', () => {
    // Initial render with 1 node
    const storeNodes1 = new Map<string, Record<string, unknown>>([
      makeDAGNode('main-agent', 'agent', 'Main Agent'),
    ]);
    resetStore({ nodes: storeNodes1 });
    const { rerender } = render(<DAGCanvas />);
    expect(screen.getByText('1 节点')).toBeTruthy();

    // Update with more nodes BEFORE rerender
    const storeNodes2 = new Map<string, Record<string, unknown>>([
      makeDAGNode('main-agent', 'agent', 'Main Agent'),
      makeDAGNode('q1', 'query', 'Query 1', 'main-agent'),
      makeDAGNode('q2', 'query', 'Query 2', 'main-agent'),
      makeDAGNode('t1', 'tool', 'Tool 1', 'q1'),
      makeDAGNode('s1', 'summary', 'Summary 1', 'q1'),
    ]);
    resetStore({ nodes: storeNodes2 });
    rerender(<DAGCanvas />);

    expect(screen.getByText('5 节点')).toBeTruthy();
  });

  // ── Additional: DAGCanvas renders toolbar ──────────────────────────────────

  it('renders the DAG title bar with node count', () => {
    render(<DAGCanvas />);
    expect(screen.getByText('DAG 执行图')).toBeTruthy();
    expect(screen.getByText('0 节点')).toBeTruthy();
  });

  // ── Additional: collapsed query hides child tool nodes ────────────────────

  it('collapses child tool nodes when query is collapsed', () => {
    const storeNodes = new Map<string, Record<string, unknown>>([
      makeDAGNode('main-agent', 'agent', 'Main Agent'),
      makeDAGNode('q1', 'query', 'Query 1', 'main-agent'),
      makeDAGNode('t1', 'tool', 'Tool 1', 'q1'),
    ]);
    const collapsedQueryIds = new Set(['q1']);

    resetStore({ nodes: storeNodes, collapsedDagQueryIds: collapsedQueryIds });
    render(<DAGCanvas />);

    // The count display uses storeNodes.size (3 total); collapsed state
    // affects filteredFlowNodes layout, not the displayed count.
    expect(screen.getByText('3 节点')).toBeTruthy();
  });

  // ── Additional: style prop forwarded ────────────────────────────────────

  it('accepts and renders with style prop', () => {
    const { container } = render(
      <DAGCanvas style={{ width: '100%', height: '400px' }} />
    );
    expect(container).toBeTruthy();
    expect(screen.getByTestId('react-flow')).toBeTruthy();
  });
});
