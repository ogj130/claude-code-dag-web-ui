import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { DockItem } from '@/components/GlobalDock/DockItem';

const MockIcon = (
  <svg data-testid="mock-icon" width="16" height="16" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" fill="currentColor"/>
  </svg>
);

describe('DockItem', () => {
  it('renders with aria-label', () => {
    render(
      <DockItem
        icon={MockIcon}
        label="测试功能"
        scale={1}
        isHovered={false}
        isActive={false}
        onClick={vi.fn()}
        onMouseEnter={vi.fn()}
        onMouseLeave={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: '测试功能' })).toBeDefined();
  });

  it('aria-pressed is true when active', () => {
    render(
      <DockItem
        icon={MockIcon}
        label="测试"
        scale={1}
        isHovered={false}
        isActive={true}
        onClick={vi.fn()}
        onMouseEnter={vi.fn()}
        onMouseLeave={vi.fn()}
      />
    );
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('aria-pressed is false when not active', () => {
    render(
      <DockItem
        icon={MockIcon}
        label="测试"
        scale={1}
        isHovered={false}
        isActive={false}
        onClick={vi.fn()}
        onMouseEnter={vi.fn()}
        onMouseLeave={vi.fn()}
      />
    );
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('aria-pressed')).toBe('false');
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(
      <DockItem
        icon={MockIcon}
        label="测试"
        scale={1}
        isHovered={false}
        isActive={false}
        onClick={onClick}
        onMouseEnter={vi.fn()}
        onMouseLeave={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('shows tooltip label text when hovered', () => {
    render(
      <DockItem
        icon={MockIcon}
        label="记忆系统"
        scale={1}
        isHovered={true}
        isActive={false}
        onClick={vi.fn()}
        onMouseEnter={vi.fn()}
        onMouseLeave={vi.fn()}
      />
    );
    expect(screen.getByText('记忆系统')).toBeDefined();
  });

  it('applies scale transform via style', () => {
    render(
      <DockItem
        icon={MockIcon}
        label="测试"
        scale={1.3}
        isHovered={false}
        isActive={false}
        onClick={vi.fn()}
        onMouseEnter={vi.fn()}
        onMouseLeave={vi.fn()}
      />
    );
    const btn = screen.getByRole('button');
    expect(btn.style.transform).toBe('scale(1.3)');
  });
});
