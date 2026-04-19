import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

describe('GlobalTerminal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDispatchFn.mockReset();
    mockDispatchFn.mockResolvedValue(mockResult);
  });

  it('渲染输入区与发送按钮', () => {
    render(<GlobalTerminal workspaces={mockWorkspaces} />);
    // textarea 存在
    expect(screen.queryByRole('textbox')).not.toBeNull();
    // 发送按钮存在
    expect(screen.queryByRole('button', { name: /发送/i })).not.toBeNull();
  });

  it('勾选"新建会话"后复选框被选中', () => {
    render(<GlobalTerminal workspaces={mockWorkspaces} />);
    const checkbox = screen.queryByRole('checkbox', { name: /新建会话/i }) as HTMLInputElement;
    expect(checkbox).not.toBeNull();
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
  });

  it('点击发送后调用 dispatchGlobalPromptsWithDefaults', async () => {
    render(<GlobalTerminal workspaces={mockWorkspaces} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '问题1\n问题2' } });
    fireEvent.click(screen.getByRole('button', { name: /发送/i }));

    expect(mockDispatchFn).toHaveBeenCalledTimes(1);
    expect(mockDispatchFn).toHaveBeenCalledWith({
      rawInput: '问题1\n问题2',
      workspaces: mockWorkspaces,
      createNewSession: false,
      executePrompt: expect.any(Function),
    });
  });

  it('createNewSession=true 时传入正确的策略', async () => {
    render(<GlobalTerminal workspaces={mockWorkspaces} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '新问题' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /新建会话/i }));
    fireEvent.click(screen.getByRole('button', { name: /发送/i }));

    expect(mockDispatchFn).toHaveBeenCalledWith(
      expect.objectContaining({ createNewSession: true }),
    );
  });

  it('执行完成后展示结果', async () => {
    render(<GlobalTerminal workspaces={mockWorkspaces} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '问题1\n问题2' } });
    fireEvent.click(screen.getByRole('button', { name: /发送/i }));

    await new Promise(r => setTimeout(r, 100));

    expect(screen.queryByText('Workspace A')).not.toBeNull();
    expect(screen.queryByText('Workspace B')).not.toBeNull();

    // 成功 标签出现（StatusBadge 渲染中文 "成功" 而非英文）
    expect(screen.queryAllByText(/成功/i).length).toBeGreaterThan(0);
  });

  it('空输入时禁用发送按钮', () => {
    render(<GlobalTerminal workspaces={mockWorkspaces} />);
    const button = screen.getByRole('button', { name: /发送/i });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('dispatch 抛出错误时按钮恢复可用（不崩溃）', async () => {
    mockDispatchFn.mockRejectedValue(new Error('Process error'));

    render(<GlobalTerminal workspaces={mockWorkspaces} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '问题' } });
    fireEvent.click(screen.getByRole('button', { name: /发送/i }));

    await new Promise(r => setTimeout(r, 50));

    // 错误信息显示
    expect(screen.queryByText('Process error')).not.toBeNull();
    // 按钮恢复可用
    const button = screen.getByRole('button', { name: /发送/i });
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });
});
