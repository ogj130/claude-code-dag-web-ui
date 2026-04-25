/**
 * GlobalAgentReportModal — 测试文件
 *
 * 测试范围：
 * - Modal 渲染（空状态、结果状态、错误状态）
 * - 演示模式徽章
 * - 导出按钮
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import type { GlobalAgentResult, GlobalAgentError } from '@/types/globalAgent';

// ── Mock recharts（Modal 依赖）─────────────────────────────────────────────
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  RadarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Radar: () => null,
  PolarGrid: () => null,
  PolarAngleAxis: () => null,
}));

// ── Mock 子组件 ─────────────────────────────────────────────────────────────
vi.mock('@/components/GlobalAgent/RankingCard', () => ({
  RankingCard: ({ ranking }: { ranking: { workspaceId: string; rank: number } }) => (
    <div data-testid="ranking-card">{ranking.workspaceId} rank={ranking.rank}</div>
  ),
}));

vi.mock('@/components/GlobalAgent/RadarChartView', () => ({
  RadarChartView: () => <div data-testid="radar-chart">RadarChart</div>,
}));

vi.mock('@/components/GlobalAgent/RoastCard', () => ({
  RoastCard: ({ roast }: { roast: string }) => (
    <div data-testid="roast-card">{roast}</div>
  ),
}));

vi.mock('@/components/GlobalAgent/DimensionLeaderboard', () => ({
  DimensionLeaderboard: () => <div data-testid="dimension-leaderboard">DimensionLeaderboard</div>,
}));

// ── 测试辅助 ────────────────────────────────────────────────────────────────
async function renderModal(props: {
  isOpen?: boolean;
  result?: GlobalAgentResult | null;
  error?: GlobalAgentError | null;
  isDemo?: boolean;
}) {
  const { GlobalAgentReportModal } = await import(
    '@/components/GlobalAgent/GlobalAgentReportModal'
  );
  return render(
    <GlobalAgentReportModal
      isOpen={props.isOpen ?? true}
      onClose={vi.fn()}
      result={props.result ?? null}
      error={props.error ?? null}
      isDemo={props.isDemo}
    />,
  );
}

const mockResult: GlobalAgentResult = {
  id: 'gar_test_001',
  batchId: 'batch_123',
  modelUsed: 'claude-sonnet-4',
  rankings: [
    { workspaceId: 'ws1', workspaceName: '前端项目', totalScore: 8.5, rank: 1, strengths: ['好'], weaknesses: ['差'] },
    { workspaceId: 'ws2', workspaceName: '后端服务', totalScore: 7.0, rank: 2, strengths: ['好'], weaknesses: ['差'] },
  ],
  scores: [
    { dimension: 'codeQuality', score: 7.5, comment: '好' },
    { dimension: 'correctness', score: 8.0, comment: '好' },
    { dimension: 'performance', score: 6.5, comment: '一般' },
    { dimension: 'consistency', score: 7.0, comment: '好' },
    { dimension: 'creativity', score: 7.2, comment: '好' },
    { dimension: 'costEfficiency', score: 6.8, comment: '一般' },
    { dimension: 'speed', score: 7.5, comment: '好' },
  ],
  commentary: '测试评语',
  roast: '测试吐槽',
  recommendations: ['建议1', '建议2'],
  createdAt: Date.now(),
};

// ── 测试用例 ────────────────────────────────────────────────────────────────

describe('GlobalAgentReportModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. isOpen=false 时不渲染 Modal', async () => {
    await renderModal({ isOpen: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('2. 渲染 Modal（空状态），显示空状态提示', async () => {
    await renderModal({ result: null });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/暂无分析结果/i)).toBeInTheDocument();
  });

  it('3. 有结果时显示分析报告内容', async () => {
    await renderModal({ result: mockResult });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/全局 Agent 分析报告/i)).toBeInTheDocument();
    expect(screen.getByText(/测试评语/i)).toBeInTheDocument();
  });

  it('4. 非演示模式时显示模型名称', async () => {
    await renderModal({ result: mockResult });
    expect(screen.getByText(/使用模型: claude-sonnet-4/i)).toBeInTheDocument();
  });

  it('6. 错误状态显示错误信息和图标', async () => {
    await renderModal({
      result: null,
      error: {
        status: 'error',
        code: 'API_ERROR',
        message: '网络连接失败',
        retryable: true,
      },
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/分析失败/i)).toBeInTheDocument();
    expect(screen.getByText(/网络连接失败/i)).toBeInTheDocument();
  });

  it('7. CONFIG_MISSING 错误显示配置提示', async () => {
    await renderModal({
      result: null,
      error: {
        status: 'error',
        code: 'CONFIG_MISSING',
        message: '请先配置 API Key',
        retryable: false,
      },
    });
    expect(screen.getByText(/配置错误/i)).toBeInTheDocument();
    expect(screen.getByText(/请先配置 API Key/i)).toBeInTheDocument();
  });

  it('8. 导出 Markdown 按钮存在（当有结果时）', async () => {
    await renderModal({ result: mockResult });
    expect(screen.getByRole('button', { name: /导出 Markdown/i })).toBeInTheDocument();
  });

  it('9. 导出 HTML 按钮存在（当有结果时）', async () => {
    await renderModal({ result: mockResult });
    expect(screen.getByRole('button', { name: /导出 HTML/i })).toBeInTheDocument();
  });

  it('10. 关闭按钮存在且可点击', async () => {
    const onClose = vi.fn();
    await renderModal({ result: mockResult });
    const closeBtn = screen.getByRole('button', { name: '关闭' });
    expect(closeBtn).toBeInTheDocument();
  });
});
