/**
 * GlobalSummaryPanel — TDD 测试
 *
 * 5 个核心行为测试：
 * 1. isExpanded=false 时不渲染
 * 2. isExpanded=true 时渲染面板，显示"全局分发汇总"和 workspace 数量
 * 3. 点击 [收起] 调用 onCollapse
 * 4. 全部完成后显示 [查看全局分析] 按钮
 * 5. 部分执行中时（batchResult=null 或部分 workspace 无结果）不显示 [查看全局分析]
 */

import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { GlobalSummaryPanel } from '../GlobalSummaryPanel';
import type { Workspace } from '@/types/workspace';
import type { DispatchWorkspaceResult } from '@/types/global-dispatch';

// ── 辅助构造 ─────────────────────────────────────────────────────────────────

function makeWorkspace(overrides: Partial<Workspace> = {}): Workspace {
  return {
    id: 'ws-1',
    name: '测试工作区',
    workspacePath: '/test/path',
    enabled: true,
    modelConfigId: 'cfg-1',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

function makeResult(overrides: Partial<DispatchWorkspaceResult> = {}): DispatchWorkspaceResult {
  return {
    workspaceId: 'ws-1',
    status: 'success',
    promptResults: [],
    ...overrides,
  };
}

// ── 测试套件 ─────────────────────────────────────────────────────────────────

describe('GlobalSummaryPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. isExpanded=false 时不渲染
  it('isExpanded=false 时不渲染任何内容', () => {
    const workspaces: Workspace[] = [makeWorkspace()];
    render(
      <GlobalSummaryPanel
        isExpanded={false}
        workspaces={workspaces}
        batchResult={null}
        activeWorkspaceId={null}
        onCollapse={vi.fn()}
        onAnalyze={vi.fn()}
      />
    );
    expect(screen.queryByText('全局分发汇总')).not.toBeInTheDocument();
  });

  // 2. isExpanded=true 时渲染面板，显示"全局分发汇总"和 workspace 数量
  it('isExpanded=true 时渲染面板，显示标题和 workspace 数量', () => {
    const workspaces: Workspace[] = [
      makeWorkspace({ id: 'ws-1', name: '工作区 A' }),
      makeWorkspace({ id: 'ws-2', name: '工作区 B' }),
      makeWorkspace({ id: 'ws-3', name: '工作区 C' }),
    ];
    render(
      <GlobalSummaryPanel
        isExpanded={true}
        workspaces={workspaces}
        batchResult={null}
        activeWorkspaceId={null}
        onCollapse={vi.fn()}
        onAnalyze={vi.fn()}
      />
    );
    expect(screen.getByText('全局分发汇总')).toBeInTheDocument();
    // workspace 数量显示在标题后
    expect(screen.getByText('(3)')).toBeInTheDocument();
  });

  // 3. 点击 [收起] 调用 onCollapse
  it('点击 [收起] 调用 onCollapse', () => {
    const workspaces: Workspace[] = [makeWorkspace()];
    const onCollapse = vi.fn();
    render(
      <GlobalSummaryPanel
        isExpanded={true}
        workspaces={workspaces}
        batchResult={null}
        activeWorkspaceId={null}
        onCollapse={onCollapse}
        onAnalyze={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('收起'));
    expect(onCollapse).toHaveBeenCalledTimes(1);
  });

  // 4. 全部完成后显示 [查看全局分析] 按钮
  it('全部完成后显示 [查看全局分析] 按钮', () => {
    const workspaces: Workspace[] = [
      makeWorkspace({ id: 'ws-1', name: 'A' }),
      makeWorkspace({ id: 'ws-2', name: 'B' }),
    ];
    const batchResult: DispatchWorkspaceResult[] = [
      makeResult({ workspaceId: 'ws-1', status: 'success' }),
      makeResult({ workspaceId: 'ws-2', status: 'success' }),
    ];
    render(
      <GlobalSummaryPanel
        isExpanded={true}
        workspaces={workspaces}
        batchResult={batchResult}
        activeWorkspaceId={null}
        onCollapse={vi.fn()}
        onAnalyze={vi.fn()}
      />
    );
    expect(screen.getByText('查看全局分析')).toBeInTheDocument();
  });

  // 5a. batchResult=null 时不显示 [查看全局分析]
  it('batchResult=null 时不显示 [查看全局分析] 按钮', () => {
    const workspaces: Workspace[] = [makeWorkspace()];
    render(
      <GlobalSummaryPanel
        isExpanded={true}
        workspaces={workspaces}
        batchResult={null}
        activeWorkspaceId={null}
        onCollapse={vi.fn()}
        onAnalyze={vi.fn()}
      />
    );
    expect(screen.queryByText('查看全局分析')).not.toBeInTheDocument();
  });

  // 5b. 部分 workspace 执行中（结果数量不足）不显示 [查看全局分析]
  it('batchResult 数量不足时不显示 [查看全局分析] 按钮', () => {
    const workspaces: Workspace[] = [
      makeWorkspace({ id: 'ws-1' }),
      makeWorkspace({ id: 'ws-2' }),
    ];
    // 只有 1 个结果，但有 2 个 workspace
    const batchResult: DispatchWorkspaceResult[] = [
      makeResult({ workspaceId: 'ws-1', status: 'success' }),
    ];
    render(
      <GlobalSummaryPanel
        isExpanded={true}
        workspaces={workspaces}
        batchResult={batchResult}
        activeWorkspaceId={null}
        onCollapse={vi.fn()}
        onAnalyze={vi.fn()}
      />
    );
    expect(screen.queryByText('查看全局分析')).not.toBeInTheDocument();
  });

  // 5c. 全部 workspace 有结果，但部分为 idle 状态时不显示 [查看全局分析]
  it('batchResult 结果全部存在但有 idle 状态时不显示 [查看全局分析] 按钮', () => {
    const workspaces: Workspace[] = [makeWorkspace({ id: 'ws-1' })];
    // idle 状态视为"还在等待"
    const batchResult: DispatchWorkspaceResult[] = [
      makeResult({ workspaceId: 'ws-1', status: 'idle' as any }),
    ];
    render(
      <GlobalSummaryPanel
        isExpanded={true}
        workspaces={workspaces}
        batchResult={batchResult}
        activeWorkspaceId={null}
        onCollapse={vi.fn()}
        onAnalyze={vi.fn()}
      />
    );
    expect(screen.queryByText('查看全局分析')).not.toBeInTheDocument();
  });
});
