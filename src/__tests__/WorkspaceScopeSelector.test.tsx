/**
 * WorkspaceScopeSelector — TDD 测试
 */

import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkspaceScopeSelector } from '../components/ToolView/WorkspaceScopeSelector';

describe('WorkspaceScopeSelector', () => {
  it('渲染标签和已选数量', () => {
    render(
      <WorkspaceScopeSelector
        label="分析范围"
        workspaces={[
          { id: 'a', name: 'A', enabled: true },
          { id: 'b', name: 'B', enabled: true },
        ]}
        selectedIds={['a']}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText(/分析范围/)).toBeInTheDocument();
    expect(screen.getByText(/已选 1\/2/)).toBeInTheDocument();
  });

  it('disabled workspace 可见但不可选', () => {
    const onChange = vi.fn();

    render(
      <WorkspaceScopeSelector
        label="分析范围"
        workspaces={[
          { id: 'a', name: 'A', enabled: true },
          { id: 'b', name: 'B', enabled: false },
        ]}
        selectedIds={['a']}
        onChange={onChange}
      />
    );

    // 展开下拉
    fireEvent.click(screen.getByRole('button', { name: '分析范围' }));
    const checkboxB = screen.getByLabelText('B') as HTMLLabelElement;
    const inputB = checkboxB.querySelector('input');
    expect(inputB).toBeDisabled();
  });

  it('点击全选切换所有 enabled workspace', () => {
    const onChange = vi.fn();

    render(
      <WorkspaceScopeSelector
        label="范围"
        workspaces={[
          { id: 'a', name: 'A', enabled: true },
          { id: 'b', name: 'B', enabled: true },
          { id: 'c', name: 'C', enabled: false },
        ]}
        selectedIds={[]}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '范围' }));
    fireEvent.click(screen.getByText('全选'));

    expect(onChange).toHaveBeenCalledWith(['a', 'b']);
  });
});
