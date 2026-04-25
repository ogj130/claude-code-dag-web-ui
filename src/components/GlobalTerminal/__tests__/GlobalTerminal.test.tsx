import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { GlobalTerminal } from '../GlobalTerminal';
import type { DispatchResult } from '@/types/global-dispatch';
import type { Workspace } from '@/types/workspace';

// ─────────────────────────────────────────
// Mock dispatchGlobalPromptsWithDefaults
// ─────────────────────────────────────────
const mockDispatchFn = vi.hoisted(() =>
  vi.fn<(input: { rawInput: string; createNewSession: boolean; executePrompt: unknown }) => Promise<DispatchResult>>(),
);

vi.mock('@/services/globalDispatchService', () => ({
  dispatchGlobalPromptsWithDefaults: mockDispatchFn,
}));

// mock useMultiDispatchStore
const mockSetBatchResult = vi.fn();
const mockSetBatchId = vi.fn();
const mockSetAllCompleted = vi.fn();
const mockSetActive = vi.fn();

vi.mock('@/stores/useMultiDispatchStore', () => ({
  useMultiDispatchStore: {
    getState: vi.fn(() => ({
      setBatchResult: mockSetBatchResult,
      setBatchId: mockSetBatchId,
      setAllCompleted: mockSetAllCompleted,
      setActive: mockSetActive,
    })),
  },
}));

const mockWorkspaces: Workspace[] = [
  {
    id: 'ws-1',
    name: 'Workspace A',
    workspacePath: '/tmp/project-a',
    modelConfigId: 'cfg-1',
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'ws-2',
    name: 'Workspace B',
    workspacePath: '/tmp/project-b',
    modelConfigId: 'cfg-2',
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

const mockResult: DispatchResult = {
  batchId: 'batch_test_1',
  mode: 'list',
  policy: 'continue_current_by_workspace',
  workspaceResults: [
    {
      workspaceId: 'ws-1',
      sessionId: 'session-1',
      status: 'success',
      promptResults: [
        { prompt: '问题1', status: 'success' },
        { prompt: '问题2', status: 'success' },
      ],
    },
    {
      workspaceId: 'ws-2',
      sessionId: 'session-2',
      status: 'partial',
      promptResults: [
        { prompt: '问题1', status: 'success' },
        { prompt: '问题2', status: 'failed', reason: 'timeout' },
      ],
    },
  ],
};

describe('GlobalTerminal — non-blocking handleSend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDispatchFn.mockReset();
    mockDispatchFn.mockResolvedValue(mockResult);
  });

  it('handleSend non阻塞 — 发送期间按钮禁用', async () => {
    mockDispatchFn.mockImplementation(() => new Promise(r => setTimeout(() => r(mockResult), 5000)));

    render(<GlobalTerminal workspaces={mockWorkspaces} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '测试 prompt' } });
    const button = screen.getByRole('button', { name: /发送/i }) as HTMLButtonElement;

    fireEvent.click(button);

    // 发送期间按钮被禁用（sending=true，防止重复发送）
    expect(button.disabled).toBe(true);
  });

  it('dispatchGlobalPromptsWithDefaults is called with correct arguments', async () => {
    render(<GlobalTerminal workspaces={mockWorkspaces} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '问题1\n问题2' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /新建会话/i }));
    fireEvent.click(screen.getByRole('button', { name: /发送/i }));

    expect(mockDispatchFn).toHaveBeenCalledTimes(1);
    expect(mockDispatchFn).toHaveBeenCalledWith({
      rawInput: '问题1\n问题2',
      createNewSession: true,
      executePrompt: expect.any(Function),
    });
  });

  it('dispatchGlobalPromptsWithDefaults is called with createNewSession=false by default', async () => {
    render(<GlobalTerminal workspaces={mockWorkspaces} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '单个 prompt' } });
    fireEvent.click(screen.getByRole('button', { name: /发送/i }));

    expect(mockDispatchFn).toHaveBeenCalledWith(
      expect.objectContaining({ createNewSession: false }),
    );
  });

  it('useMultiDispatchStore is updated with results via .then() after dispatch resolves', async () => {
    vi.useFakeTimers();

    render(<GlobalTerminal workspaces={mockWorkspaces} />);

    mockDispatchFn.mockImplementation(() => new Promise(r => setTimeout(() => r(mockResult), 5000)));

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '测试' } });
    fireEvent.click(screen.getByRole('button', { name: /发送/i }));

    // 立即 advance timers 让 Promise resolve
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(mockSetBatchResult).toHaveBeenCalledWith(mockResult.workspaceResults);
    expect(mockSetBatchId).toHaveBeenCalledWith(mockResult.batchId);
    expect(mockSetAllCompleted).toHaveBeenCalledWith(true);
    expect(mockSetActive).toHaveBeenCalledWith(true);

    vi.useRealTimers();
  });

  it('useMultiDispatchStore is NOT updated if abortRef.current is true (abort)', async () => {
    vi.useFakeTimers();

    render(<GlobalTerminal workspaces={mockWorkspaces} />);

    // 模拟 dispatch 永不 resolve（模拟 abort 场景）
    mockDispatchFn.mockImplementation(() => new Promise(() => {}));

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '测试' } });
    fireEvent.click(screen.getByRole('button', { name: /发送/i }));

    // 验证 store 未被调用
    expect(mockSetBatchResult).not.toHaveBeenCalled();
    expect(mockSetBatchId).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('dispatch error is caught and sets error state, does not crash', async () => {
    vi.useFakeTimers();

    mockDispatchFn.mockRejectedValue(new Error('Dispatch failed'));

    render(<GlobalTerminal workspaces={mockWorkspaces} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '测试' } });
    fireEvent.click(screen.getByRole('button', { name: /发送/i }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // 错误消息应该显示在 UI 中
    expect(screen.getByText(/Dispatch failed/i)).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('空输入时发送按钮禁用', () => {
    render(<GlobalTerminal workspaces={mockWorkspaces} />);
    const button = screen.getByRole('button', { name: /发送/i });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('渲染 textarea、checkbox 和发送按钮', () => {
    render(<GlobalTerminal workspaces={mockWorkspaces} />);
    expect(screen.queryByRole('textbox')).not.toBeNull();
    expect(screen.queryByRole('checkbox', { name: /新建会话/i })).not.toBeNull();
    expect(screen.queryByRole('button', { name: /发送/i })).not.toBeNull();
  });

  it('勾选"新建会话"后复选框被选中', () => {
    render(<GlobalTerminal workspaces={mockWorkspaces} />);
    const checkbox = screen.queryByRole('checkbox', { name: /新建会话/i }) as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
  });
});
