/**
 * WorkspaceTagBar — TDD 测试
 *
 * 4 个核心行为测试：
 * 1. 只显示 enabled=true 的工作区
 * 2. 点击 tag 调用 onSwitch
 * 3. running 中的工作区显示加载指示（data-running="true" attribute）
 * 4. 当前选中 tag 高亮（data-active="true" attribute）
 */

import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkspaceTagBar } from '@/components/ToolView/WorkspaceTagBar';
import type { Workspace } from '@/types/workspace';

// ── 辅助 ──────────────────────────────────────────────────────────────────────

function makeWorkspace(overrides: Partial<Workspace> = {}): Workspace {
  return {
    id: 'ws-1',
    name: '工作区 1',
    workspacePath: '/path/to/ws1',
    enabled: true,
    modelConfigId: 'cfg-1',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

// ── 测试套件 ──────────────────────────────────────────────────────────────────

describe('WorkspaceTagBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. 只显示 enabled=true 的工作区
  it('只渲染 enabled=true 的工作区标签', () => {
    const workspaces: Workspace[] = [
      makeWorkspace({ id: 'ws-1', name: '启用中', enabled: true }),
      makeWorkspace({ id: 'ws-2', name: '已禁用', enabled: false }),
      makeWorkspace({ id: 'ws-3', name: '也启用', enabled: true }),
    ];

    render(
      <WorkspaceTagBar
        workspaces={workspaces}
        activeWorkspaceId={null}
        onSwitch={vi.fn()}
      />
    );

    expect(screen.getByText('启用中')).toBeInTheDocument();
    expect(screen.getByText('也启用')).toBeInTheDocument();
    expect(screen.queryByText('已禁用')).not.toBeInTheDocument();
  });

  // 2. 点击 tag 调用 onSwitch
  it('点击标签调用 onSwitch，传入对应 workspaceId', () => {
    const workspaces: Workspace[] = [
      makeWorkspace({ id: 'ws-alpha', name: 'Alpha' }),
      makeWorkspace({ id: 'ws-beta', name: 'Beta' }),
    ];
    const onSwitch = vi.fn();

    render(
      <WorkspaceTagBar
        workspaces={workspaces}
        activeWorkspaceId={null}
        onSwitch={onSwitch}
      />
    );

    fireEvent.click(screen.getByText('Alpha'));
    expect(onSwitch).toHaveBeenCalledTimes(1);
    expect(onSwitch).toHaveBeenCalledWith('ws-alpha');

    fireEvent.click(screen.getByText('Beta'));
    expect(onSwitch).toHaveBeenCalledTimes(2);
    expect(onSwitch).toHaveBeenCalledWith('ws-beta');
  });

  // 3. running 中的工作区显示 data-running="true"
  it('running 中的工作区标签标记 data-running="true"', () => {
    const workspaces: Workspace[] = [
      makeWorkspace({ id: 'ws-running', name: '运行中' }),
      makeWorkspace({ id: 'ws-idle', name: '空闲' }),
    ];
    const runningWorkspaces = new Set<string>(['ws-running']);

    render(
      <WorkspaceTagBar
        workspaces={workspaces}
        activeWorkspaceId={null}
        onSwitch={vi.fn()}
        runningWorkspaces={runningWorkspaces}
      />
    );

    const runningTag = screen.getByText('运行中').closest('button');
    expect(runningTag).toHaveAttribute('data-running', 'true');

    const idleTag = screen.getByText('空闲').closest('button');
    expect(idleTag).toHaveAttribute('data-running', 'false');
  });

  // 4. 当前选中 tag 高亮（data-active="true"）
  it('当前选中标签标记 data-active="true"', () => {
    const workspaces: Workspace[] = [
      makeWorkspace({ id: 'ws-active', name: '当前' }),
      makeWorkspace({ id: 'ws-inactive', name: '其他' }),
    ];

    render(
      <WorkspaceTagBar
        workspaces={workspaces}
        activeWorkspaceId="ws-active"
        onSwitch={vi.fn()}
      />
    );

    const activeTag = screen.getByText('当前').closest('button');
    expect(activeTag).toHaveAttribute('data-active', 'true');

    const inactiveTag = screen.getByText('其他').closest('button');
    expect(inactiveTag).toHaveAttribute('data-active', 'false');
  });
});
