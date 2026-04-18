import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import * as React from 'react';
import {
  useKeyboardShortcuts,
  useShortcutDefinitions,
  detectConflicts,
} from '@/hooks/useKeyboardShortcuts';

describe('useKeyboardShortcuts', () => {
  const mockOpenSearch = vi.fn();
  const mockCollapseAll = vi.fn();
  const mockExpandAll = vi.fn();
  const mockOpenCompaction = vi.fn();
  const mockToggleTheme = vi.fn();
  const mockToggleHistory = vi.fn();
  const mockCloseModal = vi.fn();
  const mockShowShortcutHelp = vi.fn();

  const defaultOptions = {
    openSearch: mockOpenSearch,
    collapseAll: mockCollapseAll,
    expandAll: mockExpandAll,
    openCompaction: mockOpenCompaction,
    toggleTheme: mockToggleTheme,
    toggleHistory: mockToggleHistory,
    closeModal: mockCloseModal,
    showShortcutHelp: mockShowShortcutHelp,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock Mac userAgent so matchShortcut works correctly in jsdom
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      configurable: true,
    });
  });

  it('should return shortcuts and conflicts via hook', () => {
    const { result } = renderHook(() => useKeyboardShortcuts(defaultOptions));
    expect(result.current.shortcuts).toBeDefined();
    expect(Array.isArray(result.current.shortcuts)).toBe(true);
    expect(result.current.shortcuts.length).toBeGreaterThan(0);
    expect(result.current.conflicts).toBeDefined();
    expect(Array.isArray(result.current.conflicts)).toBe(true);
  });

  it('should useShortcutDefinitions returns all expected shortcuts', () => {
    const { result } = renderHook(() => useShortcutDefinitions());
    expect(result.current.length).toBeGreaterThan(0);
    // Verify all shortcuts have required properties
    result.current.forEach((s) => {
      expect(typeof s.key).toBe('string');
      expect(typeof s.combo).toBe('string');
      expect(typeof s.description).toBe('string');
      expect(['global', 'dag', 'modal']).toContain(s.scope);
    });
  });

  it('should detectConflicts identifies conflicts correctly', () => {
    const shortcuts = [
      { key: 'Cmd+K', combo: 'cmd+k', description: 'Search', scope: 'global' as const, conflictWarning: 'Chrome conflict' },
      { key: 'Cmd+Shift+E', combo: 'cmd+shift+e', description: 'Expand', scope: 'dag' as const },
    ];
    const conflicts = detectConflicts(shortcuts);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].combo).toBe('Cmd+K');
    expect(conflicts[0].warning).toBe('Chrome conflict');
  });

  it('should not register listeners when disabled', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useKeyboardShortcuts({ ...defaultOptions, enabled: false }));

    expect(addEventListenerSpy).not.toHaveBeenCalled();

    unmount();
    removeEventListenerSpy.mockRestore();
  });

  it('should register keydown listener when enabled', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useKeyboardShortcuts(defaultOptions));

    expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function), true);

    unmount();
    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function), true);

    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it('should call openSearch on Cmd+K', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    renderHook(() => useKeyboardShortcuts(defaultOptions));

    const handler = addEventListenerSpy.mock.calls.find(([evt]) => evt === 'keydown')?.[1] as EventListener;

    // Create a keyboard event with a mock target to avoid null access
    const mockTarget = { tagName: 'BODY', isContentEditable: false };
    const kEvent = {
      key: 'k', metaKey: true, ctrlKey: false, shiftKey: false, altKey: false,
      target: mockTarget,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent;
    (handler as (e: KeyboardEvent) => void)(kEvent);

    expect(mockOpenSearch).toHaveBeenCalled();
    expect(kEvent.preventDefault).toHaveBeenCalled();

    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it('should call collapseAll on Cmd+Shift+C', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    renderHook(() => useKeyboardShortcuts(defaultOptions));

    const handler = addEventListenerSpy.mock.calls.find(([evt]) => evt === 'keydown')?.[1] as EventListener;

    const mockTarget = { tagName: 'BODY', isContentEditable: false };
    const cEvent = {
      key: 'c', metaKey: true, ctrlKey: false, shiftKey: true, altKey: false,
      target: mockTarget,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent;
    (handler as (e: KeyboardEvent) => void)(cEvent);

    expect(mockCollapseAll).toHaveBeenCalled();

    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it('should ignore Cmd+K in input elements', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    renderHook(() => useKeyboardShortcuts(defaultOptions));

    const handler = addEventListenerSpy.mock.calls.find(([evt]) => evt === 'keydown')?.[1] as EventListener;

    const inputTarget = { tagName: 'INPUT', isContentEditable: false };
    const kEvent = {
      key: 'k', metaKey: true, ctrlKey: false, shiftKey: false, altKey: false,
      target: inputTarget,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent;
    (handler as (e: KeyboardEvent) => void)(kEvent);
    expect(mockOpenSearch).not.toHaveBeenCalled();

    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it('should call showShortcutHelp on ? key', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    renderHook(() => useKeyboardShortcuts(defaultOptions));

    const handler = addEventListenerSpy.mock.calls.find(([evt]) => evt === 'keydown')?.[1] as EventListener;

    const mockTarget = { tagName: 'BODY', isContentEditable: false };
    const qEvent = {
      key: '?', metaKey: false, ctrlKey: false, shiftKey: false, altKey: false,
      target: mockTarget,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent;
    (handler as (e: KeyboardEvent) => void)(qEvent);
    expect(mockShowShortcutHelp).toHaveBeenCalled();

    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  // ---------------------------------------------------------------------------
  // Additional shortcut coverage: Cmd+H, Cmd+Shift+E, Cmd+T, Esc, unknown keys
  // ---------------------------------------------------------------------------

  it('should call toggleHistory on Cmd+H', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    renderHook(() => useKeyboardShortcuts(defaultOptions));

    const handler = addEventListenerSpy.mock.calls.find(([evt]) => evt === 'keydown')?.[1] as EventListener;

    const mockTarget = { tagName: 'BODY', isContentEditable: false };
    const hEvent = {
      key: 'h', metaKey: true, ctrlKey: false, shiftKey: false, altKey: false,
      target: mockTarget,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent;
    (handler as (e: KeyboardEvent) => void)(hEvent);

    expect(mockToggleHistory).toHaveBeenCalled();
    expect(hEvent.preventDefault).toHaveBeenCalled();

    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it('should call expandAll on Cmd+Shift+E', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    renderHook(() => useKeyboardShortcuts(defaultOptions));

    const handler = addEventListenerSpy.mock.calls.find(([evt]) => evt === 'keydown')?.[1] as EventListener;

    const mockTarget = { tagName: 'BODY', isContentEditable: false };
    const eEvent = {
      key: 'e', metaKey: true, ctrlKey: false, shiftKey: true, altKey: false,
      target: mockTarget,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent;
    (handler as (e: KeyboardEvent) => void)(eEvent);

    expect(mockExpandAll).toHaveBeenCalled();
    expect(eEvent.preventDefault).toHaveBeenCalled();

    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it('should call openCompaction on Cmd+Shift+P', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    renderHook(() => useKeyboardShortcuts(defaultOptions));

    const handler = addEventListenerSpy.mock.calls.find(([evt]) => evt === 'keydown')?.[1] as EventListener;

    const mockTarget = { tagName: 'BODY', isContentEditable: false };
    const pEvent = {
      key: 'p', metaKey: true, ctrlKey: false, shiftKey: true, altKey: false,
      target: mockTarget,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent;
    (handler as (e: KeyboardEvent) => void)(pEvent);

    expect(mockOpenCompaction).toHaveBeenCalled();
    expect(pEvent.preventDefault).toHaveBeenCalled();

    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it('should call toggleTheme on Cmd+T', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    renderHook(() => useKeyboardShortcuts(defaultOptions));

    const handler = addEventListenerSpy.mock.calls.find(([evt]) => evt === 'keydown')?.[1] as EventListener;

    const mockTarget = { tagName: 'BODY', isContentEditable: false };
    const tEvent = {
      key: 't', metaKey: true, ctrlKey: false, shiftKey: false, altKey: false,
      target: mockTarget,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent;
    (handler as (e: KeyboardEvent) => void)(tEvent);

    expect(mockToggleTheme).toHaveBeenCalled();
    expect(tEvent.preventDefault).toHaveBeenCalled();

    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it('should call closeModal on Escape even inside input', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    renderHook(() => useKeyboardShortcuts(defaultOptions));

    const handler = addEventListenerSpy.mock.calls.find(([evt]) => evt === 'keydown')?.[1] as EventListener;

    // Esc should work even when target is an INPUT (overrides the "ignore in input" rule)
    const inputTarget = { tagName: 'INPUT', isContentEditable: false };
    const escEvent = {
      key: 'Escape', metaKey: false, ctrlKey: false, shiftKey: false, altKey: false,
      target: inputTarget,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent;
    (handler as (e: KeyboardEvent) => void)(escEvent);

    expect(mockCloseModal).toHaveBeenCalled();
    expect(escEvent.preventDefault).toHaveBeenCalled();

    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it('should handle unknown key combos gracefully (no action, no throw)', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    renderHook(() => useKeyboardShortcuts(defaultOptions));

    const handler = addEventListenerSpy.mock.calls.find(([evt]) => evt === 'keydown')?.[1] as EventListener;

    const mockTarget = { tagName: 'BODY', isContentEditable: false };

    // Unsupported combos: Cmd+Shift+U, plain letter without modifier, etc.
    const unsupportedEvents = [
      { key: 'u', metaKey: true, ctrlKey: false, shiftKey: true, altKey: false, target: mockTarget },
      { key: 'x', metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, target: mockTarget },
    ];

    unsupportedEvents.forEach(eventProps => {
      const event = {
        ...eventProps,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as KeyboardEvent;

      expect(() => (handler as (e: KeyboardEvent) => void)(event)).not.toThrow();
      // None of the callbacks should have been called
      expect(mockOpenSearch).not.toHaveBeenCalled();
      expect(mockToggleHistory).not.toHaveBeenCalled();
      expect(mockToggleTheme).not.toHaveBeenCalled();
    });

    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it('should unregister shortcut on cleanup (useEffect return)', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useKeyboardShortcuts(defaultOptions));

    // Capture the registered handler reference
    const registeredHandler = addEventListenerSpy.mock.calls.find(
      ([evt]) => evt === 'keydown',
    )?.[1] as EventListener;

    expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function), true);

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'keydown',
      registeredHandler,
      true,
    );

    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it('should call the latest callback after options change (ref stays current)', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { rerender } = renderHook(
      ({ openSearch }) => useKeyboardShortcuts({ ...defaultOptions, openSearch }),
      { initialProps: { openSearch: mockOpenSearch } },
    );

    const handler = addEventListenerSpy.mock.calls.find(([evt]) => evt === 'keydown')?.[1] as EventListener;
    const mockTarget = { tagName: 'BODY', isContentEditable: false };
    const newOpenSearch = vi.fn();

    rerender({ openSearch: newOpenSearch });

    const newHandler = addEventListenerSpy.mock.calls
      .filter(([evt]) => evt === 'keydown')
      .at(-1)?.[1] as EventListener;

    const kEvent = {
      key: 'k', metaKey: true, ctrlKey: false, shiftKey: false, altKey: false,
      target: mockTarget,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent;
    (newHandler as (e: KeyboardEvent) => void)(kEvent);

    // The NEW callback should be called, not the old one
    expect(newOpenSearch).toHaveBeenCalled();
    expect(mockOpenSearch).not.toHaveBeenCalled();

    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });
});
