import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkspaceTagBar } from '../../src/components/ToolView/WorkspaceTagBar';

describe('WorkspaceTagBar', () => {
  it('renders global tab by default', () => {
    render(<WorkspaceTagBar activeTab="global" onTabChange={() => {}} />);
    expect(screen.getByRole('tab', { name: '全局' })).toBeTruthy();
  });

  it('calls onTabChange when global tab clicked', () => {
    const onTabChange = vi.fn();
    render(<WorkspaceTagBar activeTab="ws-A" onTabChange={onTabChange} />);
    fireEvent.click(screen.getByRole('tab', { name: '全局' }));
    expect(onTabChange).toHaveBeenCalledWith('global');
  });

  it('renders dynamic workspace tabs', () => {
    const tabs = [
      { id: 'ws-A', name: '工作区 A', status: 'running' as const },
      { id: 'ws-B', name: '工作区 B', status: 'completed' as const },
    ];
    render(<WorkspaceTagBar activeTab="global" onTabChange={() => {}} workspaceTabs={tabs} />);
    expect(screen.getByRole('tab', { name: /工作区 A/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /工作区 B/ })).toBeTruthy();
  });

  it('calls onTabChange with workspaceId when workspace tab clicked', () => {
    const onTabChange = vi.fn();
    const tabs = [{ id: 'ws-A', name: 'A', status: 'running' as const }];
    render(<WorkspaceTagBar activeTab="global" onTabChange={onTabChange} workspaceTabs={tabs} />);
    fireEvent.click(screen.getByRole('tab', { name: /A/ }));
    expect(onTabChange).toHaveBeenCalledWith('ws-A');
  });
});
