/**
 * ToolCards — 渲染覆盖测试
 * 覆盖率标准: 组件 mount 成功，无崩溃
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ToolCards } from '@/components/ToolView/ToolCards';
import { useTaskStore } from '@/stores/useTaskStore';

// ── Mock ────────────────────────────────────────────────────────────────────────

vi.mock('@/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode; name?: string }) => (
    <>{children}</>
  ),
}));

vi.mock('@/components/Icons', () => ({
  ToolIcon: ({ tool, size }: { tool: string; size: number }) => (
    <span data-testid="tool-icon" data-tool={tool}>{tool}</span>
  ),
  ChevronRightIcon: ({ size }: { size: number }) => (
    <span data-testid="chevron-icon" style={{ width: size, height: size }} />
  ),
  InboxIcon: ({ size }: { size: number }) => (
    <span data-testid="inbox-icon" style={{ width: size, height: size }} />
  ),
}));

// ── 辅助: 构造工具调用数据 ──────────────────────────────────────────────────────

function makeToolCall(overrides: Partial<Parameters<typeof useTaskStore.getState>['toolCalls'][0]> = {}) {
  return {
    id: `tool-${Math.random().toString(36).slice(2)}`,
    tool: 'Read',
    status: 'completed' as const,
    args: { file: '/src/foo.ts' },
    result: 'file content here',
    startTime: Date.now() - 1000,
    endTime: Date.now(),
    parentId: '',
    ...overrides,
  };
}

// ── 测试套件 ──────────────────────────────────────────────────────────────────

describe('ToolCards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 重置 store
    useTaskStore.setState({ toolCalls: [] });
  });

  it('应该渲染空状态（无工具调用）', () => {
    render(<ToolCards />);
    expect(screen.getByText('暂无工具调用记录')).toBeInTheDocument();
  });

  it('应该渲染一个工具卡片', () => {
    useTaskStore.setState({
      toolCalls: [makeToolCall({ tool: 'Read', status: 'completed' })],
    });
    render(<ToolCards />);
    expect(screen.getByText('READ')).toBeInTheDocument();
  });

  it('应该渲染多个工具卡片', () => {
    useTaskStore.setState({
      toolCalls: [
        makeToolCall({ tool: 'Read', status: 'completed' }),
        makeToolCall({ tool: 'Bash', status: 'running' }),
        makeToolCall({ tool: 'Grep', status: 'error' }),
      ],
    });
    render(<ToolCards />);
    expect(screen.getByText('READ')).toBeInTheDocument();
    expect(screen.getByText('BASH')).toBeInTheDocument();
    expect(screen.getByText('GREP')).toBeInTheDocument();
  });

  it('应该按 queryId 过滤', () => {
    const id = 'query-1';
    useTaskStore.setState({
      toolCalls: [
        makeToolCall({ tool: 'Read', parentId: id }),
        makeToolCall({ tool: 'Bash', parentId: 'query-2' }),
      ],
    });
    const { unmount } = render(<ToolCards queryId={id} />);
    expect(screen.getByText('READ')).toBeInTheDocument();
    expect(screen.queryByText('BASH')).not.toBeInTheDocument();
    unmount();
  });

  it('应该显示运行中状态徽章', () => {
    useTaskStore.setState({
      toolCalls: [makeToolCall({ tool: 'Read', status: 'running' })],
    });
    render(<ToolCards />);
    expect(screen.getByText('运行中')).toBeInTheDocument();
  });

  it('应该显示完成状态徽章', () => {
    useTaskStore.setState({
      toolCalls: [makeToolCall({ tool: 'Read', status: 'completed' })],
    });
    render(<ToolCards />);
    expect(screen.getByText('完成')).toBeInTheDocument();
  });

  it('应该显示失败状态徽章', () => {
    useTaskStore.setState({
      toolCalls: [makeToolCall({ tool: 'Read', status: 'error' })],
    });
    render(<ToolCards />);
    expect(screen.getByText('失败')).toBeInTheDocument();
  });
});
