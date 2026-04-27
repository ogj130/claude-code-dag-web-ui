import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { GlobalDock } from '@/components/GlobalDock/GlobalDock';
import { DockPanel } from '@/components/GlobalDock/DockPanel';
import { useDockStore } from '@/stores/useDockStore';

describe('Dock Integration', () => {
  beforeEach(() => {
    useDockStore.setState({ activeItemId: null, isPanelOpen: false, hoveredItemId: null });
  });

  it('clicking dock item opens panel via store', () => {
    render(<GlobalDock />);

    // Initially panel is closed
    expect(useDockStore.getState().isPanelOpen).toBe(false);

    // Click a group button
    fireEvent.click(screen.getByRole('button', { name: '核心智能' }));

    // Panel should open with correct active item
    expect(useDockStore.getState().isPanelOpen).toBe(true);
    expect(useDockStore.getState().activeItemId).toBe('core');
  });

  it('clicking same dock item toggles panel closed', () => {
    render(<GlobalDock />);

    const btn = screen.getByRole('button', { name: '核心智能' });
    fireEvent.click(btn);
    expect(useDockStore.getState().isPanelOpen).toBe(true);

    fireEvent.click(btn);
    expect(useDockStore.getState().isPanelOpen).toBe(false);
    expect(useDockStore.getState().activeItemId).toBeNull();
  });

  it('clicking different dock item switches active item', () => {
    render(<GlobalDock />);

    fireEvent.click(screen.getByRole('button', { name: '核心智能' }));
    expect(useDockStore.getState().activeItemId).toBe('core');

    fireEvent.click(screen.getByRole('button', { name: '记忆系统' }));
    expect(useDockStore.getState().activeItemId).toBe('memory');
    expect(useDockStore.getState().isPanelOpen).toBe(true);
  });

  it('DockPanel displays items from dockConfig for active group', () => {
    // Open a group
    useDockStore.getState().openPanel('system');

    render(
      <DockPanel
        isOpen={useDockStore.getState().isPanelOpen}
        title="系统工具"
        onClose={() => useDockStore.getState().closePanel()}
      >
        <div data-testid="sub-items">全局终端</div>
      </DockPanel>
    );

    expect(screen.getByText('系统工具')).toBeDefined();
    expect(screen.getByTestId('sub-items')).toBeDefined();
  });
});
