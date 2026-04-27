import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { DockPanel } from '@/components/GlobalDock/DockPanel';

describe('DockPanel', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <DockPanel isOpen={false} title="测试" onClose={vi.fn()}>
        <div>content</div>
      </DockPanel>
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders title and children when open', () => {
    render(
      <DockPanel isOpen={true} title="核心智能" onClose={vi.fn()}>
        <div data-testid="child">面板内容</div>
      </DockPanel>
    );
    expect(screen.getByText('核心智能')).toBeDefined();
    expect(screen.getByTestId('child')).toBeDefined();
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(
      <DockPanel isOpen={true} title="测试" onClose={onClose}>
        <div>content</div>
      </DockPanel>
    );
    fireEvent.click(screen.getByLabelText('关闭面板'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('has dialog role and aria-label', () => {
    render(
      <DockPanel isOpen={true} title="系统工具" onClose={vi.fn()}>
        <div>content</div>
      </DockPanel>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeDefined();
    expect(dialog.getAttribute('aria-label')).toBe('系统工具');
  });

  it('is not aria-modal (allows background interaction)', () => {
    render(
      <DockPanel isOpen={true} title="测试" onClose={vi.fn()}>
        <div>content</div>
      </DockPanel>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('false');
  });
});
