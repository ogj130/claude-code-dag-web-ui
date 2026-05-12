/**
 * AgentGroupNode — Group Node Tests
 *
 * V3.0.0 Enhanced AgentGroupNode:
 * - Inline styles with CSS variables (no className-based CSS)
 * - Unicode status indicators: ✓ ✗ ⏳
 * - Agent type badge with text (context, planning, execution, review)
 * - Collapse/expand via ▸/▾ indicators
 * - Collapsed shows "{childCount} 个子工具"
 * - Detail button when expanded
 * - Handles on Top/Bottom instead of Left/Right
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import AgentGroupNode from '@/components/DAG/AgentGroupNode';

// ── Mock @xyflow/react handles ────────────────────────────────────────────────

vi.mock('@xyflow/react', () => ({
  Handle: ({ type, position }: any) => (
    <div data-testid={`handle-${type}-${position}`} />
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
    agentType: 'context',
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

  it('shows child count text when collapsed', () => {
    const data = makeData({
      collapsed: true,
      childCount: 5,
      onToggleCollapse: vi.fn(),
    });

    render(<AgentGroupNode data={data} />);

    // When collapsed, shows "{childCount} 个子工具"
    expect(screen.getByText('5 个子工具')).toBeTruthy();
  });

  it('shows taskDescription when collapsed with childCount=0', () => {
    const data = makeData({
      collapsed: true,
      childCount: 0,
      taskDescription: '分析项目结构',
      onToggleCollapse: vi.fn(),
    });

    render(<AgentGroupNode data={data} />);
    // childCount=0 时显示 taskDescription 而非 "0 个子工具"
    expect(screen.getByText('分析项目结构')).toBeTruthy();
  });

  it('hides child count when expanded', () => {
    const data = makeData({
      collapsed: false,
      childCount: 3,
      onToggleCollapse: vi.fn(),
    });

    render(<AgentGroupNode data={data} />);
    expect(screen.queryByText('3 个子工具')).toBeNull();
  });

  // ── Test 2: Expand/collapse toggle indicators ───────────────────────────────

  it('shows collapsed indicator ▸ when collapsed', () => {
    const data = makeData({ collapsed: true });
    render(<AgentGroupNode data={data} />);

    expect(screen.getByText('\u25B8')).toBeTruthy();
  });

  it('shows expanded indicator ▾ when expanded', () => {
    const data = makeData({ collapsed: false });
    render(<AgentGroupNode data={data} />);

    expect(screen.getByText('\u25BE')).toBeTruthy();
  });

  // ── Test 3: Toggle calls onToggleCollapse ──────────────────────────────────

  it('clicking the header when collapsed calls onToggleCollapse with node id', () => {
    const onToggleCollapse = vi.fn();
    const data = makeData({ collapsed: true, id: 'group-abc', onToggleCollapse });
    render(<AgentGroupNode data={data} />);

    // Click the header div (parent of the ▸ indicator)
    fireEvent.click(screen.getByText('\u25B8').parentElement!);

    expect(onToggleCollapse).toHaveBeenCalledTimes(1);
    expect(onToggleCollapse).toHaveBeenCalledWith('group-abc');
  });

  it('clicking the header when expanded calls onToggleCollapse with node id', () => {
    const onToggleCollapse = vi.fn();
    const data = makeData({ collapsed: false, id: 'group-xyz', onToggleCollapse });
    render(<AgentGroupNode data={data} />);

    fireEvent.click(screen.getByText('\u25BE').parentElement!);

    expect(onToggleCollapse).toHaveBeenCalledTimes(1);
    expect(onToggleCollapse).toHaveBeenCalledWith('group-xyz');
  });

  // ── Test 4: Agent name display ──────────────────────────────────────────────

  it('renders agent name', () => {
    const data = makeData({
      agentName: 'Beta Agent',
      onToggleCollapse: vi.fn(),
    });

    render(<AgentGroupNode data={data} />);

    // Agent name should be visible (always shown in header)
    expect(screen.getByText('Beta Agent')).toBeTruthy();
  });

  it('displays label when agentName is not provided', () => {
    const data = makeData({ agentName: undefined, label: 'Fallback Label' });
    render(<AgentGroupNode data={data} />);

    expect(screen.getByText('Fallback Label')).toBeTruthy();
  });

  // ── Test 5: Status indicators (unicode characters) ─────────────────────────

  it('shows running status indicator ⏳', () => {
    const data = makeData({ status: 'running', agentType: 'context' });
    render(<AgentGroupNode data={data} />);

    // Running status shows ⏳ (U+23F3) with agent type text color
    const indicator = screen.getByText('\u23F3');
    expect(indicator).toBeTruthy();
    // context agentType text color = #93c5fd
    expect(indicator.style.color).toBe('rgb(147, 197, 253)');
  });

  it('shows completed status indicator ✓', () => {
    const data = makeData({ status: 'completed' });
    render(<AgentGroupNode data={data} />);

    const indicator = screen.getByText('\u2713');
    expect(indicator).toBeTruthy();
    // Completed color is hardcoded #10b981
    expect(indicator.style.color).toBe('rgb(16, 185, 129)');
  });

  it('shows failed status indicator ✗', () => {
    const data = makeData({ status: 'failed' });
    render(<AgentGroupNode data={data} />);

    const indicator = screen.getByText('\u2717');
    expect(indicator).toBeTruthy();
    // Failed color is hardcoded #ef4444
    expect(indicator.style.color).toBe('rgb(239, 68, 68)');
  });

  it('does not show status indicator for pending', () => {
    const data = makeData({ status: 'pending' });
    render(<AgentGroupNode data={data} />);

    // Pending status has no unicode indicator character
    expect(screen.queryByText('\u2713')).toBeNull();
    expect(screen.queryByText('\u2717')).toBeNull();
    expect(screen.queryByText('\u23F3')).toBeNull();
  });

  // ── Test 6: Detail button when expanded ─────────────────────────────────────

  it('renders detail button when expanded', () => {
    const data = makeData({ collapsed: false, agentType: 'execution' });
    render(<AgentGroupNode data={data} />);

    const detailBtn = screen.getByRole('button');
    expect(detailBtn).toBeTruthy();
    // Button text contains the agent type
    expect(detailBtn.textContent).toContain('execution');
  });

  it('does not render detail button when collapsed', () => {
    const data = makeData({ collapsed: true });
    render(<AgentGroupNode data={data} />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  // ── Test 7: Agent type badge ────────────────────────────────────────────────

  it('renders agent type badge', () => {
    const data = makeData({ agentType: 'planning' });
    render(<AgentGroupNode data={data} />);

    // Agent type badge shows the type text
    expect(screen.getByText('planning')).toBeTruthy();
  });

  // ── Test 8: Selected state via inline style ─────────────────────────────────

  it('applies selected boxShadow when selected prop is true', () => {
    const { container } = render(<AgentGroupNode data={makeData()} selected={true} />);
    const root = container.firstChild as HTMLElement;
    expect(root.style.boxShadow).toBe('0 0 0 2px rgba(139,92,246,0.3)');
  });

  it('applies no boxShadow when selected prop is false', () => {
    const { container } = render(<AgentGroupNode data={makeData()} selected={false} />);
    const root = container.firstChild as HTMLElement;
    expect(root.style.boxShadow).toBe('none');
  });

  // ── Test 9: Handles ─────────────────────────────────────────────────────────

  it('renders input (top) and output (bottom) handles', () => {
    const data = makeData();
    render(<AgentGroupNode data={data} />);

    expect(screen.getByTestId('handle-target-Top')).toBeTruthy();
    expect(screen.getByTestId('handle-source-Bottom')).toBeTruthy();
  });

  // ── Test 10: Running animation and opacity ───────────────────────────────────

  it('applies pending opacity when status is pending', () => {
    const { container } = render(<AgentGroupNode data={makeData({ status: 'pending' })} />);
    const root = container.firstChild as HTMLElement;
    expect(root.style.opacity).toBe('0.6');
  });

  it('applies full opacity when status is not pending', () => {
    const { container } = render(<AgentGroupNode data={makeData({ status: 'completed' })} />);
    const root = container.firstChild as HTMLElement;
    expect(root.style.opacity).toBe('1');
  });

  // ── Test 11: Running animation is applied ───────────────────────────────────

  it('applies pulse animation when status is running', () => {
    const { container } = render(<AgentGroupNode data={makeData({ status: 'running' })} />);
    const root = container.firstChild as HTMLElement;
    expect(root.style.animation).toContain('agent-pulse');
  });

  it('applies blink animation when status is failed', () => {
    const { container } = render(<AgentGroupNode data={makeData({ status: 'failed' })} />);
    const root = container.firstChild as HTMLElement;
    expect(root.style.animation).toContain('agent-blink');
  });
});
