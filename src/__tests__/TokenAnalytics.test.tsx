/**
 * TokenAnalytics — 渲染覆盖测试
 * 覆盖率标准: 组件 mount 成功，无崩溃
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { TokenAnalytics } from '@/components/TokenAnalytics';
import { useSessionStore } from '@/stores/useSessionStore';

// ── Mock ────────────────────────────────────────────────────────────────────────

vi.mock('@/components/TokenChart', () => ({
  TokenChart: ({ data }: { data: unknown[] }) => (
    <div data-testid="token-chart">TokenChart</div>
  ),
}));

vi.mock('@/components/TokenPricing', () => ({
  TokenPricing: () => <div data-testid="token-pricing">TokenPricing</div>,
}));

vi.mock('@/utils/tokenStats', () => ({
  getOverallStats: vi.fn().mockResolvedValue({
    totalTokens: 100000,
    totalQueries: 10,
    avgTokensPerQuery: 10000,
  }),
  getRecentStats: vi.fn().mockResolvedValue({
    totalTokens: 50000,
    totalQueries: 5,
    avgTokensPerQuery: 10000,
    dailyAvg: 5000,
  }),
  getTokenTrend: vi.fn().mockResolvedValue([]),
  formatTokens: (n: number) => (n / 1000).toFixed(1) + 'K',
}));

vi.mock('@/stores/useSessionStore', () => ({
  useSessionStore: vi.fn(),
}));

// ── 测试套件 ──────────────────────────────────────────────────────────────────

describe('TokenAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 默认无 sessions
    ;(useSessionStore as ReturnType<typeof vi.fn>).mockImplementation((selector) => {
      const state = { sessions: [], activeSessionId: null };
      return selector ? selector(state) : state;
    });
  });

  it('isOpen=false 时返回 null', () => {
    const { container } = render(
      <TokenAnalytics isOpen={false} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('isOpen=true 时渲染标题', async () => {
    render(<TokenAnalytics isOpen={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Token 统计')).toBeInTheDocument();
    });
  });

  it('isOpen=true 时渲染关闭按钮', async () => {
    render(<TokenAnalytics isOpen={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByTitle('关闭 (ESC)')).toBeInTheDocument();
    });
  });

  it('isOpen=true 时渲染 Tab 切换按钮', async () => {
    render(<TokenAnalytics isOpen={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Token 趋势')).toBeInTheDocument();
      expect(screen.getByText('模型定价')).toBeInTheDocument();
    });
  });

  it('点击关闭按钮触发 onClose', async () => {
    const onClose = vi.fn();
    render(<TokenAnalytics isOpen={true} onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByTitle('关闭 (ESC)')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTitle('关闭 (ESC)'));
    expect(onClose).toHaveBeenCalled();
  });

  it('点击模型定价 Tab 渲染 TokenPricing', async () => {
    render(<TokenAnalytics isOpen={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('模型定价')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('模型定价'));
    await waitFor(() => {
      expect(screen.getByTestId('token-pricing')).toBeInTheDocument();
    });
  });

  it('ESC 键触发 onClose', async () => {
    const onClose = vi.fn();
    render(<TokenAnalytics isOpen={true} onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByTitle('关闭 (ESC)')).toBeInTheDocument();
    });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
