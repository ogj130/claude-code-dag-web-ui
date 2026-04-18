/**
 * AgentGroupNode — Group Node Tests
 *
 * V2.0.0 DAG Features:
 * - Group node shows collapsed count badge
 * - Expand button expands the group
 * - Collapse button collapses the group
 * - Child nodes are rendered when expanded
 * - Group node shows aggregated status (running/completed/error)
 * - Click on group toggles expand/collapse
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import AgentGroupNode from '@/components/DAG/AgentGroupNode';

// ── Mock @xyflow/react handles ────────────────────────────────────────────────

vi.mock('@xyflow/react', () => ({
  Handle: ({ type, position, className }: any) => (
    <div data-testid={`handle-${type}-${position}`} className={className} />
  ),
  Position: { Left: 'Left', Right: 'Right', Top: 'Top', Bottom: 'Bottom' },
}));

// ── Helper: minimal valid data object ─────────────────────────────────────────

function makeData(overrides: Record<string, unknown> = {}) {
  return {
    id: 'group-1',
    label: 'Agent Alpha',
    status: 'pending' as const,
    agentName: 'Alpha Agent',
    collapsed: false,
    childCount: 0,
    onToggleCollapse: vi.fn(),
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('AgentGroupNode', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Test 1: Collapsed count badge ──────────────────────────────────────────

  it('shows collapsed count badge when collapsed', () => {
    const data = makeData({
      collapsed: true,
      childCount: 5,
      onToggleCollapse: vi.fn(),
    });

    render(<AgentGroupNode data={data} />);

    // When collapsed, child count info should be visible
    expect(screen.getByText('5 children')).toBeTruthy();
  });

  it('shows "No children" when collapsed with childCount=0', () => {
    const data = makeData({
      collapsed: true,
      childCount: 0,
      onToggleCollapse: vi.fn(),
    });

    render(<AgentGroupNode data={data} />);
    expect(screen.getByText('No children')).toBeTruthy();
  });

  it('hides collapsed info when expanded', () => {
    const data = makeData({
      collapsed: false,
      childCount: 3,
      onToggleCollapse: vi.fn(),
    });

    render(<AgentGroupNode data={data} />);
    expect(screen.queryByText('3 children')).toBeNull();
  });

  // ── Test 2: Expand button ────────────────────────────────────────────────────

  it('expand button (▶) is shown when collapsed', () => {
    const data = makeData({ collapsed: true });
    render(<AgentGroupNode data={data} />);

    // Collapsed state shows ▶
    const toggle = screen.getByTitle('Expand');
    expect(toggle).toBeTruthy();
    expect(toggle).toHaveTextContent('▶');
  });

  it('expand button calls onToggleCollapse with node id', () => {
    const onToggleCollapse = vi.fn();
    const data = makeData({ collapsed: true, id: 'group-abc', onToggleCollapse });
    render(<AgentGroupNode data={data} />);

    fireEvent.click(screen.getByTitle('Expand'));

    expect(onToggleCollapse).toHaveBeenCalledTimes(1);
    expect(onToggleCollapse).toHaveBeenCalledWith('group-abc');
  });

  // ── Test 3: Collapse button ─────────────────────────────────────────────────

  it('collapse button (▼) is shown when expanded', () => {
    const data = makeData({ collapsed: false });
    render(<AgentGroupNode data={data} />);

    // Expanded state shows ▼
    const toggle = screen.getByTitle('Collapse');
    expect(toggle).toBeTruthy();
    expect(toggle).toHaveTextContent('▼');
  });

  it('collapse button calls onToggleCollapse with node id', () => {
    const onToggleCollapse = vi.fn();
    const data = makeData({ collapsed: false, id: 'group-xyz', onToggleCollapse });
    render(<AgentGroupNode data={data} />);

    fireEvent.click(screen.getByTitle('Collapse'));

    expect(onToggleCollapse).toHaveBeenCalledTimes(1);
    expect(onToggleCollapse).toHaveBeenCalledWith('group-xyz');
  });

  // ── Test 4: Child nodes rendered when expanded ─────────────────────────────

  it('renders agent name when expanded', () => {
    const data = makeData({
      collapsed: false,
      agentName: 'Beta Agent',
      onToggleCollapse: vi.fn(),
    });

    render(<AgentGroupNode data={data} />);

    // Agent name should be visible when expanded
    expect(screen.getByText('Beta Agent')).toBeTruthy();
  });

  it('renders toolMessage truncated when collapsed', () => {
    const data = makeData({
      collapsed: true,
      childCount: 2,
      toolMessage: 'Reading file: config.yaml from project root',
      onToggleCollapse: vi.fn(),
    });

    render(<AgentGroupNode data={data} />);

    // Component truncates toolMessage > 30 chars to 30 chars + '...'
    // Verify the activity div shows a truncated form ending with '...'
    const activity = document.querySelector('.agent-group-activity');
    expect(activity).toBeTruthy();
    expect(activity!.textContent).toMatch(/^Reading.+\.\.\.$/);
    expect(activity!.textContent!.endsWith('...')).toBe(true);
  });

  // ── Test 5: Aggregated status ───────────────────────────────────────────────

  it('shows running status indicator (purple)', () => {
    const data = makeData({ status: 'running' });
    render(<AgentGroupNode data={data} />);

    const indicator = screen.getByTitle('running');
    expect(indicator).toBeTruthy();
    expect(indicator).toHaveClass('status-indicator');
    // Status color should be purple for running
    expect(indicator).toHaveStyle({ backgroundColor: '#8B5CF6' });
  });

  it('shows completed status indicator (green)', () => {
    const data = makeData({ status: 'completed' });
    render(<AgentGroupNode data={data} />);

    const indicator = screen.getByTitle('completed');
    expect(indicator).toHaveStyle({ backgroundColor: '#10B981' });
  });

  it('shows failed status indicator (red)', () => {
    const data = makeData({ status: 'failed' });
    render(<AgentGroupNode data={data} />);

    const indicator = screen.getByTitle('failed');
    expect(indicator).toHaveStyle({ backgroundColor: '#EF4444' });
  });

  it('shows pending status indicator (gray)', () => {
    const data = makeData({ status: 'pending' });
    render(<AgentGroupNode data={data} />);

    const indicator = screen.getByTitle('pending');
    expect(indicator).toHaveStyle({ backgroundColor: '#94A3B8' });
  });

  // ── Test 6: Click on group toggles expand/collapse ──────────────────────────

  it('clicking the collapse-toggle button calls onToggleCollapse', () => {
    const onToggleCollapse = vi.fn();
    const data = makeData({ id: 'toggle-test', onToggleCollapse });
    render(<AgentGroupNode data={data} />);

    // The toggle button is the collapse-toggle element
    const toggleBtn = screen.getByRole('button');
    fireEvent.click(toggleBtn);

    expect(onToggleCollapse).toHaveBeenCalledTimes(1);
    expect(onToggleCollapse).toHaveBeenCalledWith('toggle-test');
  });

  it('renders with selected class when selected prop is true', () => {
    // selected is a direct prop on AgentGroupNodeProps, not inside data
    render(<AgentGroupNode data={makeData()} selected={true} />);

    expect(screen.getByTestId('agent-group-node-root')).toHaveClass('selected');
  });

  it('renders without selected class when selected prop is false', () => {
    render(<AgentGroupNode data={makeData()} selected={false} />);

    expect(screen.getByTestId('agent-group-node-root')).not.toHaveClass('selected');
  });

  // ── Additional: displays label when agentName is absent ─────────────────────

  it('displays label when agentName is not provided', () => {
    const data = makeData({ agentName: undefined, label: 'Fallback Label' });
    render(<AgentGroupNode data={data} />);

    expect(screen.getByText('Fallback Label')).toBeTruthy();
  });

  // ── Additional: renders both handles ───────────────────────────────────────

  it('renders input (left) and output (right) handles', () => {
    const data = makeData();
    render(<AgentGroupNode data={data} />);

    expect(screen.getByTestId('handle-target-Left')).toBeTruthy();
    expect(screen.getByTestId('handle-source-Right')).toBeTruthy();
  });

  // ── Additional: agent-icon emoji is rendered ─────────────────────────────────

  it('renders the agent icon', () => {
    const data = makeData();
    render(<AgentGroupNode data={data} />);

    expect(screen.getByText('👤')).toBeTruthy();
  });
});
