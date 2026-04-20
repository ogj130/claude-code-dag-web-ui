/**
 * WorkspaceCard — TDD 测试
 * 覆盖率标准: 各状态渲染、prompt 截断、onFocus 调用
 *
 * 注意: 本项目 vitest 3.x 使用 Chai 断言，不含 @testing-library/jest-dom，
 * 因此使用 queryByText(...) !== null 代替 toBeInTheDocument()。
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkspaceCard } from '../WorkspaceCard';
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

// 超过 30 字符的 prompt（用于测试截断）
const LONG_PROMPT = '这是一段非常非常非常长的提示文本内容需要被截断显示啊啊啊啊啊啊啊';

// ── 测试套件 ─────────────────────────────────────────────────────────────────

describe('WorkspaceCard', () => {
  it('running 状态（result=null）显示脉冲动画，data-status="running"', () => {
    const workspace = makeWorkspace();
    render(
      <WorkspaceCard
        workspace={workspace}
        result={null}
        isActive={false}
        onFocus={vi.fn()}
      />
    );
    const card = screen.getByTestId('workspace-card');
    expect(card.getAttribute('data-status')).toBe('running');
    // 脉冲动画 span 存在（animation 属性含 pulse-running）
    const dot = card.querySelector('span[style*="pulse-running"]');
    expect(dot).toBeTruthy();
  });

  it('success 状态显示绿色徽章', () => {
    const workspace = makeWorkspace();
    const result = makeResult({ status: 'success' });
    render(
      <WorkspaceCard
        workspace={workspace}
        result={result}
        isActive={false}
        onFocus={vi.fn()}
      />
    );
    const card = screen.getByTestId('workspace-card');
    expect(card.getAttribute('data-status')).toBe('success');
    expect(screen.getByText('成功')).toBeTruthy();
  });

  it('partial 状态显示黄色徽章', () => {
    const workspace = makeWorkspace();
    const result = makeResult({ status: 'partial' });
    render(
      <WorkspaceCard
        workspace={workspace}
        result={result}
        isActive={false}
        onFocus={vi.fn()}
      />
    );
    const card = screen.getByTestId('workspace-card');
    expect(card.getAttribute('data-status')).toBe('partial');
    expect(screen.getByText('部分成功')).toBeTruthy();
  });

  it('failed 状态显示红色徽章', () => {
    const workspace = makeWorkspace();
    const result = makeResult({ status: 'failed', errorMessage: '连接失败' });
    render(
      <WorkspaceCard
        workspace={workspace}
        result={result}
        isActive={false}
        onFocus={vi.fn()}
      />
    );
    const card = screen.getByTestId('workspace-card');
    expect(card.getAttribute('data-status')).toBe('failed');
    expect(screen.getByText('失败')).toBeTruthy();
    expect(screen.getByText('连接失败')).toBeTruthy();
  });

  it('显示 prompt 文本（截断到 30 字符）', () => {
    const workspace = makeWorkspace();
    const result = makeResult({
      promptResults: [{ prompt: LONG_PROMPT, status: 'success' }],
    });
    render(
      <WorkspaceCard
        workspace={workspace}
        result={result}
        isActive={false}
        onFocus={vi.fn()}
      />
    );
    // 截断后前 30 字符 + "…"
    expect(screen.getByText('这是一段非常非常非常长的提示文本内容需要被截断显示啊啊啊啊啊…')).toBeTruthy();
    // 原始文本不直接出现（被截断）
    expect(screen.queryByText(LONG_PROMPT)).toBeFalsy();
  });

  it('点击 onFocus 被调用', () => {
    const onFocus = vi.fn();
    const workspace = makeWorkspace();
    render(
      <WorkspaceCard
        workspace={workspace}
        result={null}
        isActive={false}
        onFocus={onFocus}
      />
    );
    fireEvent.click(screen.getByTestId('workspace-card'));
    expect(onFocus).toHaveBeenCalledTimes(1);
  });
});
