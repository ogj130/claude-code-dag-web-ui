/**
 * ExecutionAnalytics — 渲染覆盖测试
 * 覆盖率标准: 组件 mount 成功，无崩溃
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { ExecutionAnalytics } from '@/components/ExecutionAnalytics';
import { useSessionStore } from '@/stores/useSessionStore';

// ── Mock ────────────────────────────────────────────────────────────────────────

vi.mock('@/components/ToolDistribution', () => ({
  ToolDistribution: ({ timeRange, workspacePath }: { timeRange: unknown; workspacePath: string; style: React.CSSProperties }) => (
    <div data-testid="tool-distribution">ToolDistribution</div>
  ),
}));

vi.mock('@/components/ToolRanking', () => ({
  ToolRanking: ({ timeRange, workspacePath }: { timeRange: unknown; workspacePath: string; style: React.CSSProperties }) => (
    <div data-testid="tool-ranking">ToolRanking</div>
  ),
}));

vi.mock('@/components/ErrorRateTrendChart', () => ({
  ErrorRateTrendChart: ({ timeRange, workspacePath }: { timeRange: unknown; workspacePath: string }) => (
    <div data-testid="error-rate-chart">ErrorRateTrendChart</div>
  ),
}));

vi.mock('@/utils/executionStats', () => ({
  getExecutionSummary: vi.fn().mockResolvedValue({
    totalCalls: 100,
    successCalls: 90,
    errorCalls: 10,
    errorRate: 10,
    avgDuration: 500,
    uniqueTools: 5,
  }),
}));

vi.mock('@/stores/useSessionStore', () => ({
  useSessionStore: vi.fn(),
}));

// ── 测试套件 ──────────────────────────────────────────────────────────────────

describe('ExecutionAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ;(useSessionStore as ReturnType<typeof vi.fn>).mockImplementation((selector) => {
      const state = { sessions: [], activeSessionId: null };
      return selector ? selector(state) : state;
    });
  });

  it('isOpen=false 时返回 null', () => {
    const { container } = render(<ExecutionAnalytics isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('isOpen=true 时渲染标题', async () => {
    render(<ExecutionAnalytics isOpen={true} />);
    await waitFor(() => {
      expect(screen.getByText('执行分析')).toBeInTheDocument();
    });
  });

  it('isOpen=true 时渲染时间范围按钮', async () => {
    render(<ExecutionAnalytics isOpen={true} />);
    await waitFor(() => {
      expect(screen.getByText('7 天')).toBeInTheDocument();
      expect(screen.getByText('30 天')).toBeInTheDocument();
      expect(screen.getByText('全部')).toBeInTheDocument();
    });
  });

  it('点击时间范围切换按钮', async () => {
    render(<ExecutionAnalytics isOpen={true} />);
    await waitFor(() => {
      expect(screen.getByText('7 天')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('30 天'));
    await waitFor(() => {
      expect(screen.getByText('30 天')).toBeInTheDocument();
    });
  });

  it('关闭按钮存在时触发 onClose', async () => {
    const onClose = vi.fn();
    render(<ExecutionAnalytics isOpen={true} onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByTitle('关闭 (ESC)')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTitle('关闭 (ESC)'));
    expect(onClose).toHaveBeenCalled();
  });

  it('ESC 键触发 onClose', async () => {
    const onClose = vi.fn();
    render(<ExecutionAnalytics isOpen={true} onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByTitle('关闭 (ESC)')).toBeInTheDocument();
    });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
