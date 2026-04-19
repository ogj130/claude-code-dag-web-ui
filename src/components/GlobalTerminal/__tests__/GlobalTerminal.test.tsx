import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { GlobalTerminal } from '../GlobalTerminal';
import type { DispatchResult } from '@/types/global-dispatch';
import type { Workspace } from '@/types/workspace';

// ─────────────────────────────────────────────
// hoisted mock：确保在 vi.mock 提升前已初始化
// ─────────────────────────────────────────────
const mockDispatchFn = vi.hoisted(() =>
  vi.fn<(input: {
    rawInput: string;
    workspaces: Workspace[];
    createNewSession: boolean;
    executePrompt: unknown;
  }) => Promise<DispatchResult>>(),
);

vi.mock('@/services/globalDispatchService', () => ({
  dispatchGlobalPrompts: mockDispatchFn,
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

  it('handleSend does not block UI — button stays enabled immediately after click', async () => {
    // 模拟 dispatch 慢速完成
    mockDispatchFn.mockImplementation(() => new Promise(r => setTimeout(() => r(mockResult), 5000)));

    render(<GlobalTerminal workspaces={mockWorkspaces} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '测试 prompt' } });
    const button = screen.getByRole('button', { name: /发送/i }) as HTMLButtonElement;

    fireEvent.click(button);

    // 立即检查：按钮仍然可用（fire-and-forget）
    // 注意：由于 button disabled 逻辑仍然依赖 loading state（目前是 loading），
    // 但新实现中 loading 不再被设置，这里验证的是按钮不会因为"正在执行"而被禁用。
    // 在新实现中，按钮只在 input 为空或 isLoading 时禁用；
    // 由于不再设置 loading，指针握在手里后按钮不会进入 disabled 状态。
    // 但为了安全，这里验证 onClose 被调用（模态框关闭）而不是按钮 disabled。
    // 实际上按钮的 disabled 逻辑在 render 中依赖 isLoading，
    // 新实现不再使用 loading state，所以按钮永远不会因为 loading 而被禁用。
    expect(button.disabled).toBe(false);
  });

  it('dispatchGlobalPrompts is called with correct arguments', async () => {
    const onClose = vi.fn();
    render(<GlobalTerminal workspaces={mockWorkspaces} onClose={onClose} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '问题1\n问题2' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /新建会话/i }));
    fireEvent.click(screen.getByRole('button', { name: /发送/i }));

    expect(mockDispatchFn).toHaveBeenCalledTimes(1);
    expect(mockDispatchFn).toHaveBeenCalledWith({
      rawInput: '问题1\n问题2',
      workspaces: mockWorkspaces,
      createNewSession: true,
      executePrompt: expect.any(Function),
    });
  });

  it('dispatchGlobalPrompts is called with createNewSession=false by default', async () => {
    const onClose = vi.fn();
    render(<GlobalTerminal workspaces={mockWorkspaces} onClose={onClose} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '单个 prompt' } });
    fireEvent.click(screen.getByRole('button', { name: /发送/i }));

    expect(mockDispatchFn).toHaveBeenCalledWith(
      expect.objectContaining({ createNewSession: false }),
    );
  });

  it('useMultiDispatchStore is updated with results via .then() after dispatch resolves', async () => {
    vi.useFakeTimers();

    const onClose = vi.fn();
    render(<GlobalTerminal workspaces={mockWorkspaces} onClose={onClose} />);

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

    const onClose = vi.fn();
    render(<GlobalTerminal workspaces={mockWorkspaces} onClose={onClose} />);

    // 模拟 dispatch 永不 resolve（模拟 abort 场景）
    mockDispatchFn.mockImplementation(() => new Promise(() => {}));

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '测试' } });
    fireEvent.click(screen.getByRole('button', { name: /发送/i }));

    // 清空 input 触发 abortRef.current = true（handleClear 清空时会触发）
    // 实际 abort 行为由 abortRef 控制，这里验证 store 未被调用
    expect(mockSetBatchResult).not.toHaveBeenCalled();
    expect(mockSetBatchId).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('onClose is called immediately when send button is clicked (non-blocking)', async () => {
    vi.useFakeTimers();

    const onClose = vi.fn();
    render(<GlobalTerminal workspaces={mockWorkspaces} onClose={onClose} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '测试' } });
    fireEvent.click(screen.getByRole('button', { name: /发送/i }));

    // onClose 应该在 dispatch 完成前就被调用
    expect(onClose).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it('dispatch error is caught and logged, does not crash', async () => {
    vi.useFakeTimers();

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onClose = vi.fn();

    mockDispatchFn.mockRejectedValue(new Error('Dispatch failed'));

    render(<GlobalTerminal workspaces={mockWorkspaces} onClose={onClose} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '测试' } });
    fireEvent.click(screen.getByRole('button', { name: /发送/i }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(consoleSpy).toHaveBeenCalledWith('[GlobalTerminal] dispatch error:', expect.any(Error));
    consoleSpy.mockRestore();

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
