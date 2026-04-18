/**
 * SearchModal — 渲染覆盖测试
 * 覆盖率标准: 组件 mount 成功，无崩溃
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { SearchModal } from '@/components/SearchModal';

// ── Mock ────────────────────────────────────────────────────────────────────────

vi.mock('@/styles/search-modal.css', () => ({}));

vi.mock('@/hooks/useSearch', () => ({
  useSearch: () => ({
    query: '',
    setQuery: vi.fn(),
    results: [],
    isLoading: false,
    isIndexReady: true,
    filters: { dateRange: {}, tags: [], toolTypes: [] },
    availableTags: [],
    availableToolTypes: [],
    history: [],
    selectedIndex: -1,
    submitSearch: vi.fn(),
    moveSelection: vi.fn(),
    updateFilters: vi.fn(),
    clearFilters: vi.fn(),
    removeHistoryItem: vi.fn(),
    clearHistory: vi.fn(),
    highlightQuery: (text: string) => text,
  }),
}));

// ── 测试套件 ──────────────────────────────────────────────────────────────────

describe('SearchModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('isOpen=false 时不渲染任何内容', () => {
    const { container } = render(
      <SearchModal isOpen={false} onClose={vi.fn()} onSelect={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('isOpen=true 时渲染搜索框', () => {
    render(
      <SearchModal isOpen={true} onClose={vi.fn()} onSelect={vi.fn()} />
    );
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('isOpen=true 时渲染筛选按钮', () => {
    render(
      <SearchModal isOpen={true} onClose={vi.fn()} onSelect={vi.fn()} />
    );
    expect(screen.getByRole('button', { name: /筛选/ })).toBeInTheDocument();
  });

  it('isOpen=true 时渲染快捷键提示', () => {
    render(
      <SearchModal isOpen={true} onClose={vi.fn()} onSelect={vi.fn()} />
    );
    expect(screen.getByText('↑↓')).toBeInTheDocument();
    expect(screen.getByText('Enter')).toBeInTheDocument();
    expect(screen.getByText('Esc')).toBeInTheDocument();
  });

  it('ESC 键触发 onClose', () => {
    const onClose = vi.fn();
    render(<SearchModal isOpen={true} onClose={onClose} onSelect={vi.fn()} />);
    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('点击 overlay 触发 onClose', () => {
    const onClose = vi.fn();
    const { container } = render(
      <SearchModal isOpen={true} onClose={onClose} onSelect={vi.fn()} />
    );
    const overlay = container.querySelector('.search-modal__overlay');
    if (overlay) {
      fireEvent.click(overlay as Element);
    }
    expect(onClose).toHaveBeenCalled();
  });

  it('筛选按钮展开/收起', () => {
    render(<SearchModal isOpen={true} onClose={vi.fn()} onSelect={vi.fn()} />);
    const filterBtn = screen.getByRole('button', { name: /筛选/ });
    fireEvent.click(filterBtn);
    expect(screen.getByText('日期范围')).toBeInTheDocument();
  });
});
