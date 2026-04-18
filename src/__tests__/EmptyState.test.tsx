import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { EmptyState } from '@/components/EmptyState';

vi.mock('@/components/Icons', () => ({
  InboxIcon: vi.fn(({ size }: { size: number }) => <span data-testid="inbox-icon" style={{ fontSize: size }} />),
}));

describe('EmptyState', () => {
  it('renders no-session type without crashing', () => {
    const { container } = render(<EmptyState type="no-session" />);
    expect(container).toBeTruthy();
    expect(container.querySelector('.empty-state')).toBeTruthy();
  });

  it('renders no-history type without crashing', () => {
    const { container } = render(<EmptyState type="no-history" />);
    expect(container).toBeTruthy();
    expect(container.querySelector('.empty-state')).toBeTruthy();
  });

  it('shows action button when onAction is provided (no-session)', () => {
    const onAction = vi.fn();
    const { container } = render(<EmptyState type="no-session" onAction={onAction} />);
    const btn = container.querySelector('.empty-state__action');
    expect(btn).toBeTruthy();
  });

  it('hides action button when onAction is not provided (no-session)', () => {
    const { container } = render(<EmptyState type="no-session" />);
    const btn = container.querySelector('.empty-state__action');
    expect(btn).toBeNull();
  });

  it('hides action button for no-history type regardless of onAction', () => {
    const onAction = vi.fn();
    const { container } = render(<EmptyState type="no-history" onAction={onAction} />);
    const btn = container.querySelector('.empty-state__action');
    expect(btn).toBeNull();
  });

  it('calls onAction when button is clicked', () => {
    const onAction = vi.fn();
    const { container } = render(<EmptyState type="no-session" onAction={onAction} />);
    const btn = container.querySelector('.empty-state__action') as HTMLButtonElement;
    btn.click();
    expect(onAction).toHaveBeenCalled();
  });

  it('displays title text', () => {
    const { container } = render(<EmptyState type="no-session" />);
    expect(container.querySelector('.empty-state__title')?.textContent).toBe('暂无会话');
  });

  it('displays subtitle text', () => {
    const { container } = render(<EmptyState type="no-session" />);
    expect(container.querySelector('.empty-state__subtitle')?.textContent).toBe('点击下方按钮开始新会话');
  });

  it('renders icon', () => {
    const { container } = render(<EmptyState type="no-session" />);
    expect(container.querySelector('[data-testid="inbox-icon"]')).toBeTruthy();
  });
});
