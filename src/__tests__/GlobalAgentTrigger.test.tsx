/**
 * GlobalAgentTrigger — 测试文件
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import React from 'react';
import type { GlobalAgentResult } from '@/types/globalAgent';
import type { DispatchWorkspaceResult } from '@/types/global-dispatch';

const mockWorkspaceResults: DispatchWorkspaceResult[] = [
  {
    workspaceId: 'ws1',
    sessionId: 'session1',
    status: 'success',
    promptResults: [
      { prompt: 'hello', status: 'success', summary: 'Done' },
      { prompt: 'world', status: 'success', summary: 'OK' },
    ],
  },
  {
    workspaceId: 'ws2',
    sessionId: 'session2',
    status: 'partial',
    promptResults: [
      { prompt: 'hello', status: 'success', summary: 'Done' },
      { prompt: 'world', status: 'failed', reason: 'timeout' },
    ],
  },
];

const mockGlobalAgentResult: GlobalAgentResult = {
  id: 'gar_test_001',
  batchId: 'batch_123',
  modelUsed: 'claude-sonnet-4-20250514',
  rankings: [
    { workspaceId: 'ws1', workspaceName: '前端项目', totalScore: 8.5, rank: 1, strengths: ['代码结构清晰'], weaknesses: ['性能优化'] },
    { workspaceId: 'ws2', workspaceName: '后端服务', totalScore: 7.2, rank: 2, strengths: ['完成任务'], weaknesses: ['有失败'] },
  ],
  scores: [
    { dimension: 'codeQuality', score: 7.5, comment: '代码组织合理' },
    { dimension: 'correctness', score: 8.0, comment: '逻辑完全正确' },
    { dimension: 'performance', score: 6.5, comment: '执行效率良好' },
    { dimension: 'consistency', score: 7.0, comment: '大部分代码风格统一' },
    { dimension: 'creativity', score: 7.2, comment: '采用了实用的方案' },
    { dimension: 'costEfficiency', score: 6.8, comment: '消耗合理' },
    { dimension: 'speed', score: 7.5, comment: '速度正常' },
  ],
  commentary: '本次全局 Agent 分析共评估了 2 个工作区。',
  roast: '整体还行，但也别高兴太早。',
  recommendations: ['考虑使用缓存', '制定并遵循代码规范'],
  createdAt: Date.now(),
};

const mockAnalyzeSuccess = { status: 'success' as const, result: mockGlobalAgentResult, latencyMs: 100 };

// ── Mock state ──────────────────────────────────────────────────────────────
const mockState = vi.hoisted(() => ({
  batchResult: null as DispatchWorkspaceResult[] | null,
  allCompleted: false,
  batchId: null as string | null,
  isActive: true,
}));

const mockAnalyzeWorkspaceResults = vi.fn();

vi.mock('@/services/globalAgentService', () => ({
  analyzeWorkspaceResults: (...args: unknown[]) => mockAnalyzeWorkspaceResults(...args),
  getGlobalAgentResult: vi.fn(),
}));

vi.mock('@/stores/useMultiDispatchStore', () => ({
  useMultiDispatchStore: Object.assign(
    vi.fn((selector: (state: typeof mockState) => unknown) => {
      if (typeof selector !== 'function') return {};
      return selector(mockState);
    }),
    { getState: () => mockState },
  ),
}));

// ── 辅助 ───────────────────────────────────────────────────────────────────
function setupStoreMock(opts: {
  batchResult: DispatchWorkspaceResult[] | null;
  allCompleted: boolean;
  batchId: string | null;
}) {
  mockState.batchResult = opts.batchResult;
  mockState.allCompleted = opts.allCompleted;
  mockState.batchId = opts.batchId;
}

async function renderTrigger() {
  const { GlobalAgentTrigger } = await import('@/components/GlobalAgent/GlobalAgentTrigger');
  return render(<GlobalAgentTrigger />);
}

// ── 测试 ───────────────────────────────────────────────────────────────────

describe('GlobalAgentTrigger', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();
    setupStoreMock({ batchResult: null, allCompleted: false, batchId: null });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('AnalyzeButton — 按钮状态', () => {
    it('1. batchResult 为 null 时按钮禁用', async () => {
      await renderTrigger();
      expect(screen.getByRole('button', { name: /全局分析/i })).toBeDisabled();
    });

    it('2. batchResult 存在时按钮启用', async () => {
      setupStoreMock({ batchResult: mockWorkspaceResults, allCompleted: true, batchId: 'batch_123' });
      await renderTrigger();
      expect(screen.getByRole('button', { name: /全局分析/i })).not.toBeDisabled();
    });
  });

  describe('点击与 API 调用', () => {
    it('3. 点击按钮调用 analyzeWorkspaceResults（demoMode=false）', async () => {
      setupStoreMock({ batchResult: mockWorkspaceResults, allCompleted: true, batchId: 'batch_123' });
      mockAnalyzeWorkspaceResults.mockResolvedValue(mockAnalyzeSuccess);
      await renderTrigger();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /全局分析/i }));
      });

      // 验证调用参数（click 触发后 microtask 已在 act 内 flush）
      await waitFor(() => {
        expect(mockAnalyzeWorkspaceResults).toHaveBeenCalledWith(
          'batch_123',
          mockWorkspaceResults,
          expect.objectContaining({ modelConfigId: 'default' }),
          { demoMode: false },
        );
      }, { timeout: 1000 });
    });

    it('4. batchId 为 null 时不调用 analyzeWorkspaceResults', async () => {
      setupStoreMock({ batchResult: mockWorkspaceResults, allCompleted: true, batchId: null });
      await renderTrigger();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /全局分析/i }));
      });

      expect(mockAnalyzeWorkspaceResults).not.toHaveBeenCalled();
    });
  });

  describe('Modal 与状态', () => {
    it('5. 分析成功时 Modal 打开并显示报告', async () => {
      vi.useRealTimers(); // 使用 real timers 让 waitFor 正常工作
      setupStoreMock({ batchResult: mockWorkspaceResults, allCompleted: true, batchId: 'batch_123' });
      mockAnalyzeWorkspaceResults.mockResolvedValue(mockAnalyzeSuccess);
      await renderTrigger();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /全局分析/i }));
      });

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
      expect(screen.getByText('全局 Agent 分析报告')).toBeInTheDocument();
    });

    it('6. CONFIG_MISSING 错误时 Modal 显示错误状态', async () => {
      vi.useRealTimers();
      setupStoreMock({ batchResult: mockWorkspaceResults, allCompleted: true, batchId: 'batch_123' });
      mockAnalyzeWorkspaceResults.mockResolvedValue({
        status: 'error',
        code: 'CONFIG_MISSING',
        message: '请先配置 API Key',
        retryable: false,
      });
      await renderTrigger();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /全局分析/i }));
      });

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
      const dialog = screen.getByRole('dialog');
      expect(within(dialog).getByText(/请先配置 API Key/i)).toBeInTheDocument();
    });

    it('7. Modal 关闭后从 DOM 中移除', async () => {
      vi.useRealTimers();
      setupStoreMock({ batchResult: mockWorkspaceResults, allCompleted: true, batchId: 'batch_123' });
      mockAnalyzeWorkspaceResults.mockResolvedValue(mockAnalyzeSuccess);
      await renderTrigger();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /全局分析/i }));
      });
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const closeBtn = screen.getByRole('button', { name: '关闭' });
      await act(async () => {
        fireEvent.click(closeBtn);
      });

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('8. 可重试错误时显示"演示模式"按钮', async () => {
      vi.useRealTimers();
      setupStoreMock({ batchResult: mockWorkspaceResults, allCompleted: true, batchId: 'batch_123' });
      mockAnalyzeWorkspaceResults.mockResolvedValue({
        status: 'error',
        code: 'API_ERROR',
        message: '网络连接失败',
        retryable: true,
      });
      await renderTrigger();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /全局分析/i }));
      });

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: /演示模式/i })).toBeInTheDocument();
    });
  });
});
