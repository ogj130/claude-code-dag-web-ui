import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { GlobalDock } from '@/components/GlobalDock/GlobalDock';
import { useDockStore } from '@/stores/useDockStore';

describe('GlobalDock', () => {
  beforeEach(() => {
    useDockStore.setState({ activeItemId: null, isPanelOpen: false, hoveredItemId: null });
  });

  it('renders dock container with toolbar role', () => {
    render(<GlobalDock />);
    expect(screen.getByRole('toolbar', { name: '功能坞' })).toBeDefined();
  });

  it('renders all 7 group items as buttons', () => {
    render(<GlobalDock />);
    expect(screen.getByRole('button', { name: '核心智能' })).toBeDefined();
    expect(screen.getByRole('button', { name: '记忆系统' })).toBeDefined();
    expect(screen.getByRole('button', { name: '编排系统' })).toBeDefined();
    expect(screen.getByRole('button', { name: '学习系统' })).toBeDefined();
    expect(screen.getByRole('button', { name: '开发工具' })).toBeDefined();
    expect(screen.getByRole('button', { name: '安全审计' })).toBeDefined();
    expect(screen.getByRole('button', { name: '系统工具' })).toBeDefined();
  });

  it('renders group separators between groups', () => {
    render(<GlobalDock />);
    const separators = screen.getAllByRole('separator');
    // 7 groups => 6 separators
    expect(separators.length).toBe(6);
  });

  it('active item has aria-pressed=true', () => {
    useDockStore.setState({ activeItemId: 'core', isPanelOpen: true });
    render(<GlobalDock />);
    const btn = screen.getByRole('button', { name: '核心智能' });
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });
});
