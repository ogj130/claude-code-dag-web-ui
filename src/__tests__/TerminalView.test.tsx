/**
 * TerminalView — double-send regression test
 *
 * Regression test for the bug where pressing Enter triggered BOTH:
 *   1. handleInputKeyDown (React input keydown) → handleSendWithAttachments → onInput
 *   2. term.onData (xterm Enter capture) → onInput with stale closure inputValue
 *
 * Because setInputValue('') is NOT synchronous, term.onData's closure still saw the
 * old non-empty inputValue, causing a second sendInput → second user_input_sent →
 * two live "实时处理中" cards rendered simultaneously.
 *
 * Fix: term.onData Enter handler removed (input box handles Enter exclusively).
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import React from 'react';

// Shared tracker for onInput calls across tests
const onInputCalls: string[] = [];
function trackOnInput(input: string) {
  onInputCalls.push(input);
  return true;
}

// ── Test-only Terminal mock factory ──────────────────────────────
let _termOnDataCallback: ((data: string) => void) | null = null;

function makeTerminalMock() {
  const instance = {
    onData: (handler: (data: string) => void) => {
      _termOnDataCallback = handler;
      return {} as unknown as void;
    },
    onSelectionChange: vi.fn(),
    loadAddon: vi.fn(),
    write: vi.fn(),
    writeln: vi.fn(),
    clear: vi.fn(),
    open: vi.fn(),
    dispose: vi.fn(),
    options: {},
  };
  return instance;
}

function makeFitAddonMock() {
  return { fit: vi.fn(), loadAddon: vi.fn() };
}

// ── Module-level mocks (run once) ────────────────────────────
vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn(makeTerminalMock),
}));

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn(makeFitAddonMock),
}));

vi.mock('@/stores/useTaskStore', () => {
  const mockState = {
    terminalLines: [] as string[],
    streamEndPending: false,
    isStarting: false,
    isRunning: false,
    error: null as string | null,
    tokenUsage: { input: 0, output: 0 },
    pendingInputsCount: 0,
    markdownCards: [] as unknown[],
    processCollapsed: false,
    collapsedCardIds: new Set(),
    currentCard: null,
    previousCard: null,
    summaryChunks: [] as string[],
    toolCalls: [] as unknown[],
  };
  const mockFn = vi.fn((selector?: (s: typeof mockState) => unknown) =>
    selector ? selector(mockState) : mockState
  ) as unknown as typeof import('@/stores/useTaskStore').useTaskStore & { getState: () => typeof mockState };
  mockFn.getState = () => mockState;
  return { useTaskStore: mockFn };
});

vi.mock('@/hooks/useRAGContext', () => ({
  useRAGContext: vi.fn(() => ({
    getPromptContext: vi.fn().mockReturnValue(''),
    items: [],
  })),
}));

vi.mock('@/hooks/useHistoryRecall', () => ({
  useHistoryRecall: vi.fn(() => ({
    state: {
      isIndexing: false,
      showSimilarHint: false,
      showErrorHint: false,
      rankedResults: [],
      welcomeSuggestions: [],
    },
    onInputChange: vi.fn(),
    onToolError: vi.fn(),
    dismissSimilarHint: vi.fn(),
    dismissErrorHint: vi.fn(),
  })),
}));

vi.mock('@/hooks/useFileUpload', () => ({
  useFileUpload: vi.fn(() => ({
    handleFileSelect: vi.fn(),
    handleRemoveAttachment: vi.fn(),
    handleClearAll: vi.fn(),
    getReadyAttachments: vi.fn().mockReturnValue([]),
  })),
}));

vi.mock('@/stores/useAttachmentStore', () => ({
  useAttachmentStore: vi.fn(() => ({ setPreviewExpanded: vi.fn() })),
  usePendingAttachments: vi.fn(() => []),
}));

vi.mock('@/components/ToolView/LiveCard', () => ({
  LiveCard: ({ card }: { card: { query?: string } }) =>
    React.createElement('div', { 'data-testid': 'live-card' },
      React.createElement('span', null, card.query ?? '')
    ),
}));

vi.mock('@/components/ToolView/MarkdownCard', () => ({
  MarkdownCard: () => React.createElement('div', { 'data-testid': 'markdown-card' }),
}));

vi.mock('@/components/ToolView/ToolCards', () => ({
  ToolCards: () => React.createElement('div', { 'data-testid': 'tool-cards' }),
}));

// Stub ResizeObserver (jsdom doesn't have it) before TerminalView tries to use it
const originalDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
beforeAll(() => {
  // @ts-ignore
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    value: 240,
  });
});
afterAll(() => {
  if (originalDescriptor) {
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', originalDescriptor);
  }
  delete (global as Record<string, unknown>).ResizeObserver;
});

import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { TerminalView } from '@/components/ToolView/TerminalView';
import * as xtermModule from '@xterm/xterm';

describe('TerminalView double-send regression', () => {
  beforeEach(() => {
    onInputCalls.length = 0;
    _termOnDataCallback = null;
    // Re-mock Terminal to get a fresh _termOnDataCallback reference per test
    vi.mocked(xtermModule.Terminal).mockImplementation(makeTerminalMock as () => Record<string, unknown>);
  });

  it('FIXED: term.onData Enter no longer calls onInput (handler removed)', () => {
    render(React.createElement(TerminalView, {
      theme: 'dark',
      onInput: trackOnInput,
    }));

    // After the fix: term.onData Enter handler was removed
    // so calling _termOnDataCallback with '\r' should NOT trigger onInput
    expect(_termOnDataCallback).not.toBeNull();
    _termOnDataCallback!('\r');

    // Key assertion: Enter in xterm does NOT call onInput anymore
    expect(onInputCalls).toHaveLength(0);
  });

  it('input box Enter keydown still calls onInput exactly once', async () => {
    render(React.createElement(TerminalView, {
      theme: 'dark',
      onInput: trackOnInput,
    }));

    const input = screen.getByRole('textbox');

    // Wait for RAF loop (tryOpen) to complete before interacting
    await act(async () => {
      await new Promise(r => setTimeout(r, 100));
    });

    // Update input value
    await act(async () => {
      fireEvent.change(input, { target: { value: '你好啊' } });
    });

    // Verify the input has the new value
    expect((input as HTMLInputElement).value).toBe('你好啊');

    // Press Enter in the input box (handleInputKeyDown path)
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13 });
    });

    // Normal path: input box handles Enter → sends JSON payload to onInput
    expect(onInputCalls).toHaveLength(1);
    expect(onInputCalls[0]).toBe('{"query":"你好啊"}');
  });

  it('no double-send even if xterm Enter fires after input box Enter (closure stale bug)', async () => {
    render(React.createElement(TerminalView, {
      theme: 'dark',
      onInput: trackOnInput,
    }));

    const input = screen.getByRole('textbox');

    // Wait for RAF loop (tryOpen) to complete before interacting
    await act(async () => {
      await new Promise(r => setTimeout(r, 100));
    });

    // Type in input and press Enter
    await act(async () => {
      fireEvent.change(input, { target: { value: '你好啊' } });
    });

    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13 });
    });

    // After the fix: term.onData no longer calls onInput at all
    // So even if it fires, onInput is NOT called from xterm
    expect(_termOnDataCallback).not.toBeNull();
    await act(async () => {
      _termOnDataCallback!('\r'); // This USED TO call onInput with stale "你好啊" — no more!
    });

    // Still exactly 1 call (from input box only, payload is JSON-wrapped)
    expect(onInputCalls).toHaveLength(1);
    expect(onInputCalls[0]).toBe('{"query":"你好啊"}');
  });
});
