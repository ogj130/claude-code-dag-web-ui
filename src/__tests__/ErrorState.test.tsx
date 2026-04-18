import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { ErrorState } from '@/components/ErrorState';

vi.mock('@/components/Icons', () => ({
  XIcon: vi.fn(({ size }: { size: number }) => <span data-testid="x-icon" style={{ fontSize: size }} />),
}));

describe('ErrorState', () => {
  it('renders without crashing', () => {
    const { container } = render(<ErrorState />);
    expect(container).toBeTruthy();
    expect(container.querySelector('.error-state')).toBeTruthy();
  });

  it('displays default error message', () => {
    const { container } = render(<ErrorState />);
    expect(container.querySelector('.error-state__title')?.textContent).toBe('数据加载失败');
  });

  it('displays custom message', () => {
    const { container } = render(<ErrorState message="Network error" />);
    expect(container.querySelector('.error-state__title')?.textContent).toBe('Network error');
  });

  it('shows retry button when onRetry is provided', () => {
    const { container } = render(<ErrorState onRetry={vi.fn()} />);
    expect(container.querySelector('.error-state__action')).toBeTruthy();
  });

  it('hides retry button when onRetry is not provided', () => {
    const { container } = render(<ErrorState />);
    expect(container.querySelector('.error-state__action')).toBeNull();
  });

  it('calls onRetry when retry button is clicked', () => {
    const onRetry = vi.fn();
    const { container } = render(<ErrorState onRetry={onRetry} />);
    const btn = container.querySelector('.error-state__action') as HTMLButtonElement;
    btn.click();
    expect(onRetry).toHaveBeenCalled();
  });

  it('renders icon', () => {
    const { container } = render(<ErrorState />);
    expect(container.querySelector('[data-testid="x-icon"]')).toBeTruthy();
  });
});
