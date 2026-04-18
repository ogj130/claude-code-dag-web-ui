/**
 * TokenPricing — 渲染覆盖测试
 * 覆盖率标准: 组件 mount 成功，无崩溃
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TokenPricing } from '@/components/TokenPricing';

// ── Mock ────────────────────────────────────────────────────────────────────────

vi.mock('@/utils/tokenStats', () => ({
  getModelPricing: vi.fn().mockReturnValue([
    {
      modelId: 'claude-3-5-sonnet',
      displayName: 'Claude 3.5 Sonnet',
      inputPrice: 3.0,
      outputPrice: 15.0,
      isDefault: true,
    },
    {
      modelId: 'claude-3-opus',
      displayName: 'Claude 3 Opus',
      inputPrice: 15.0,
      outputPrice: 75.0,
      isDefault: false,
    },
  ]),
  saveModelPricing: vi.fn(),
  resetModelPricing: vi.fn(),
  DEFAULT_MODEL_PRICING: [
    {
      modelId: 'claude-3-5-sonnet',
      displayName: 'Claude 3.5 Sonnet',
      inputPrice: 3.0,
      outputPrice: 15.0,
      isDefault: true,
    },
  ],
}));

// ── 测试套件 ──────────────────────────────────────────────────────────────────

describe('TokenPricing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 清除 confirm 调用
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('渲染说明文字', () => {
    render(<TokenPricing />);
    expect(screen.getByText(/Token 定价信息/)).toBeInTheDocument();
  });

  it('渲染模型定价卡片', async () => {
    render(<TokenPricing />);
    await waitFor(() => {
      expect(screen.getByText('Claude 3.5 Sonnet')).toBeInTheDocument();
    });
  });

  it('渲染多个模型定价卡片', async () => {
    render(<TokenPricing />);
    await waitFor(() => {
      expect(screen.getByText('Claude 3.5 Sonnet')).toBeInTheDocument();
      expect(screen.getByText('Claude 3 Opus')).toBeInTheDocument();
    });
  });

  it('渲染添加模型按钮', async () => {
    render(<TokenPricing />);
    await waitFor(() => {
      expect(screen.getByText('+ 添加模型')).toBeInTheDocument();
    });
  });

  it('渲染重置按钮', async () => {
    render(<TokenPricing />);
    await waitFor(() => {
      expect(screen.getByText('重置为默认')).toBeInTheDocument();
    });
  });

  it('点击编辑按钮进入编辑模式', async () => {
    render(<TokenPricing />);
    await waitFor(() => {
      expect(screen.getByText('Claude 3.5 Sonnet')).toBeInTheDocument();
    });
    const editBtn = screen.getAllByText('编辑')[0];
    fireEvent.click(editBtn);
    await waitFor(() => {
      expect(screen.getByText('取消')).toBeInTheDocument();
      expect(screen.getByText('保存')).toBeInTheDocument();
    });
  });

  it('点击取消退出编辑模式', async () => {
    render(<TokenPricing />);
    await waitFor(() => {
      expect(screen.getByText('Claude 3.5 Sonnet')).toBeInTheDocument();
    });
    const editBtn = screen.getAllByText('编辑')[0];
    fireEvent.click(editBtn);
    await waitFor(() => {
      expect(screen.getByText('取消')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('取消'));
    await waitFor(() => {
      expect(screen.queryByText('取消')).not.toBeInTheDocument();
    });
  });
});
