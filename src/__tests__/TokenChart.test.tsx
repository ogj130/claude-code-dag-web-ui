/**
 * TokenChart — 渲染覆盖测试
 * 覆盖率标准: 组件 mount 成功，无崩溃
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { TokenChart } from '@/components/TokenChart';

// ── Mock Recharts ──────────────────────────────────────────────────────────────

vi.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: vi.fn(),
  XAxis: vi.fn(),
  YAxis: vi.fn(),
  CartesianGrid: vi.fn(),
  Tooltip: vi.fn(),
  ResponsiveContainer: ({ children, width = '100%', height = 200 }: { children: React.ReactNode; width?: string; height?: number }) => (
    <div data-testid="responsive-container" style={{ width, height }}>{children}</div>
  ),
}));

// ── 测试套件 ──────────────────────────────────────────────────────────────────

describe('TokenChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('data 为空时显示暂无趋势数据', () => {
    render(<TokenChart data={[]} />);
    expect(screen.getByText('暂无趋势数据')).toBeInTheDocument();
  });

  it('data 为 undefined 时显示暂无趋势数据', () => {
    // @ts-expect-error — 测试边界情况
    render(<TokenChart data={undefined} />);
    expect(screen.getByText('暂无趋势数据')).toBeInTheDocument();
  });

  it('有数据时渲染图表容器', () => {
    const data = [
      { date: '2026-04-01', totalTokens: 10000, queryCount: 5 },
      { date: '2026-04-02', totalTokens: 15000, queryCount: 7 },
    ];
    render(<TokenChart data={data} />);
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('渲染包含多个数据点的图表', () => {
    const data = [
      { date: '2026-04-01', totalTokens: 10000, queryCount: 5 },
      { date: '2026-04-02', totalTokens: 15000, queryCount: 7 },
      { date: '2026-04-03', totalTokens: 20000, queryCount: 10 },
      { date: '2026-04-04', totalTokens: 12000, queryCount: 6 },
    ];
    render(<TokenChart data={data} />);
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });
});
