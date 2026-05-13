/**
 * GlobalWorkspaceHome — TDD 测试
 */

import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GlobalWorkspaceHome } from '../components/ToolView/GlobalWorkspaceHome';

describe('GlobalWorkspaceHome', () => {
  it('渲染分析按钮', () => {
    render(
      <GlobalWorkspaceHome
        onAnalyze={vi.fn()}
      />
    );
    expect(screen.getByText('开始全局分析')).toBeInTheDocument();
  });

  it('不渲染全局终端输出当 showGlobalTerminalOutput=false', () => {
    render(
      <GlobalWorkspaceHome showGlobalTerminalOutput={false} />
    );
    expect(screen.queryByText('全局终端输出')).not.toBeInTheDocument();
  });

  it('渲染全局终端输出当 showGlobalTerminalOutput=true', () => {
    render(
      <GlobalWorkspaceHome showGlobalTerminalOutput={true} />
    );
    expect(screen.getByText('全局终端输出')).toBeInTheDocument();
  });

  it('分析中显示 loading 文案', () => {
    render(
      <GlobalWorkspaceHome analysisStatus="loading" onAnalyze={vi.fn()} />
    );
    expect(screen.getByText('分析中...')).toBeInTheDocument();
  });

  it('范围变更时显示 stale 提示', () => {
    render(
      <GlobalWorkspaceHome
        hasAnalysisResult={true}
        analysisScopeSnapshot={['ws-a']}
        selectedAnalysisWorkspaceIds={['ws-b']}
      />
    );
    expect(screen.getByText('结果已过期，请重新分析')).toBeInTheDocument();
  });
});
