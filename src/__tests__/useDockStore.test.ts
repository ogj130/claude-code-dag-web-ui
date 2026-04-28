import { describe, it, expect, beforeEach } from 'vitest';
import { useDockStore } from '@/stores/useDockStore';

describe('useDockStore', () => {
  beforeEach(() => {
    useDockStore.setState({
      activeItemId: null,
      activeSubItemId: null,
      isPanelOpen: false,
      containerType: null,
      hoveredItemId: null,
    });
  });

  it('initial state: no active item, panel closed, no hovered item', () => {
    const state = useDockStore.getState();
    expect(state.activeItemId).toBeNull();
    expect(state.activeSubItemId).toBeNull();
    expect(state.isPanelOpen).toBe(false);
    expect(state.containerType).toBeNull();
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

  it('openSubItem sets activeSubItemId and containerType', () => {
    useDockStore.getState().openSubItem('core', 'mode', 'panel');
    const state = useDockStore.getState();
    expect(state.activeItemId).toBe('core');
    expect(state.activeSubItemId).toBe('mode');
    expect(state.containerType).toBe('panel');
    expect(state.isPanelOpen).toBe(true);
  });

  it('openSubItem with drawer type', () => {
    useDockStore.getState().openSubItem('memory', 'memory-browser', 'drawer');
    expect(useDockStore.getState().containerType).toBe('drawer');
  });

  it('openSubItem with modal type', () => {
    useDockStore.getState().openSubItem('orchestration', 'agent-canvas', 'modal');
    expect(useDockStore.getState().containerType).toBe('modal');
  });
});
