import { describe, it, expect, beforeEach } from 'vitest';
import { useDockStore } from '@/stores/useDockStore';

describe('useDockStore', () => {
  beforeEach(() => {
    useDockStore.setState({
      activeItemId: null,
      isPanelOpen: false,
      hoveredItemId: null,
    });
  });

  it('initial state: no active item, panel closed, no hovered item', () => {
    const state = useDockStore.getState();
    expect(state.activeItemId).toBeNull();
    expect(state.isPanelOpen).toBe(false);
    expect(state.hoveredItemId).toBeNull();
  });

  it('openPanel sets activeItemId and opens panel', () => {
    useDockStore.getState().openPanel('core');
    const state = useDockStore.getState();
    expect(state.activeItemId).toBe('core');
    expect(state.isPanelOpen).toBe(true);
  });

  it('openPanel with same id closes panel (toggle)', () => {
    useDockStore.getState().openPanel('core');
    useDockStore.getState().openPanel('core');
    const state = useDockStore.getState();
    expect(state.isPanelOpen).toBe(false);
    expect(state.activeItemId).toBeNull();
  });

  it('openPanel with different id switches panel', () => {
    useDockStore.getState().openPanel('core');
    useDockStore.getState().openPanel('memory');
    const state = useDockStore.getState();
    expect(state.activeItemId).toBe('memory');
    expect(state.isPanelOpen).toBe(true);
  });

  it('closePanel closes panel and clears activeItem', () => {
    useDockStore.getState().openPanel('core');
    useDockStore.getState().closePanel();
    const state = useDockStore.getState();
    expect(state.isPanelOpen).toBe(false);
    expect(state.activeItemId).toBeNull();
  });

  it('setHoveredItem updates hoveredItemId', () => {
    useDockStore.getState().setHoveredItem('system');
    expect(useDockStore.getState().hoveredItemId).toBe('system');
  });

  it('setHoveredItem null clears hover', () => {
    useDockStore.getState().setHoveredItem('core');
    useDockStore.getState().setHoveredItem(null);
    expect(useDockStore.getState().hoveredItemId).toBeNull();
  });
});
