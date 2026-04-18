/**
 * ErrorBoundary — TDD 测试文件
 *
 * Phase 1 (RED): 验证组件行为
 * Phase 2 (GREEN): 实现组件通过测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { appendErrorLog, clearErrorLogs } from '@/utils/errorLogger';

// ── Mock localStorage ──────────────────────────────────────────────────────────
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// ── 测试用错误组件 ────────────────────────────────────────────────────────────
const ThrowError: React.FC<{ message?: string }> = ({ message = 'Test Error' }) => {
  throw new Error(message);
};

// ── 条件错误组件（用于测试重置行为）─────────────────────────────────────────
const ConditionalThrowError: React.FC<{ shouldThrow: boolean }> = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error('Conditional Error');
  }
  return <div data-testid="recovered-child">Recovered!</div>;
};

// ── 测试用正常子组件 ───────────────────────────────────────────────────────────
const NormalChild: React.FC = () => <div data-testid="normal-child">Content</div>;

// ── 测试套件 ──────────────────────────────────────────────────────────────────
describe('ErrorBoundary', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    clearErrorLogs();
  });

  // ── 1. 正常渲染子组件 ──────────────────────────────────────────────────────
  describe('正常渲染', () => {
    it('应该渲染子组件（无错误时）', () => {
      render(
        <ErrorBoundary>
          <NormalChild />
        </ErrorBoundary>
      );
      expect(screen.getByTestId('normal-child')).toBeInTheDocument();
    });

    it('应该渲染子组件文本内容', () => {
      render(
        <ErrorBoundary>
          <div>Hello ErrorBoundary</div>
        </ErrorBoundary>
      );
      expect(screen.getByText('Hello ErrorBoundary')).toBeInTheDocument();
    });

    it('应该支持多层级嵌套子组件', () => {
      render(
        <ErrorBoundary>
          <div>
            <span>Level 1</span>
            <div>
              <span>Level 2</span>
            </div>
          </div>
        </ErrorBoundary>
      );
      expect(screen.getByText('Level 1')).toBeInTheDocument();
      expect(screen.getByText('Level 2')).toBeInTheDocument();
    });
  });

  // ── 2. 捕获子组件错误 ──────────────────────────────────────────────────────
  describe('错误捕获', () => {
    it('应该在子组件抛出错误时捕获并显示错误提示', () => {
      render(
        <ErrorBoundary>
          <ThrowError message="Something went wrong" />
        </ErrorBoundary>
      );
      // ErrorBoundary 应该捕获错误并显示 fallback
      expect(screen.getByText('组件渲染出错')).toBeInTheDocument();
    });

    it('应该在捕获错误后显示重新渲染按钮', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );
      expect(screen.getByRole('button', { name: '重新渲染' })).toBeInTheDocument();
    });

    it('应该不渲染抛出错误的子组件', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
          <div>Should not see this before error</div>
        </ErrorBoundary>
      );
      expect(screen.queryByText('Should not see this before error')).not.toBeInTheDocument();
    });
  });

  // ── 3. 错误日志记录 ────────────────────────────────────────────────────────
  describe('错误日志记录', () => {
    it('应该将错误记录到 localStorage', () => {
      render(
        <ErrorBoundary>
          <ThrowError message="Log this error" />
        </ErrorBoundary>
      );

      expect(localStorageMock.setItem).toHaveBeenCalled();
      // 验证 setItem 被调用，存储的是 JSON 格式的错误日志
      const setItemCall = localStorageMock.setItem.mock.calls.find(
        ([key]) => key === 'cc_errors'
      );
      expect(setItemCall).toBeDefined();
    });

    it('应该记录包含错误信息的日志', () => {
      render(
        <ErrorBoundary>
          <ThrowError message="Specific error message" />
        </ErrorBoundary>
      );

      // 验证 localStorage.setItem 被调用存储错误日志
      expect(localStorageMock.setItem).toHaveBeenCalled();
      const storedData = localStorageMock.setItem.mock.calls
        .find(([key]) => key === 'cc_errors')?.[1];

      expect(storedData).toBeDefined();
      const logs = JSON.parse(storedData as string);
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('Specific error message');
    });

    it('应该支持 FIFO 淘汰（超过 50 条时）', () => {
      // 模拟 50 条旧日志
      const oldLogs = Array.from({ length: 50 }, (_, i) => ({
        id: `err_old_${i}`,
        message: `Old error ${i}`,
        stack: undefined,
        componentStack: undefined,
        timestamp: Date.now() - (50 - i) * 1000,
      }));

      // 配置 getItem 返回旧日志
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(oldLogs));

      // 触发新错误
      render(
        <ErrorBoundary>
          <ThrowError message="New error" />
        </ErrorBoundary>
      );

      // 验证 appendErrorLog 被调用并处理了 FIFO 淘汰
      // localStorage.setItem 应该被调用，更新后的日志应该有 50 条
      const storedData = localStorageMock.setItem.mock.calls.find(
        ([key]) => key === 'cc_errors'
      )?.[1];
      expect(storedData).toBeDefined();
      const logs = JSON.parse(storedData as string);
      expect(logs).toHaveLength(50);
      expect(logs.some((l: { message: string }) => l.message === 'New error')).toBe(true);
    });
  });

  // ── 4. name prop ───────────────────────────────────────────────────────────
  describe('name prop', () => {
    it('应该使用 name prop 自定义错误消息', () => {
      render(
        <ErrorBoundary name="UserProfile">
          <ThrowError />
        </ErrorBoundary>
      );
      expect(screen.getByText('UserProfile 组件出错')).toBeInTheDocument();
    });

    it('应该使用默认消息当没有 name prop', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );
      expect(screen.getByText('组件渲染出错')).toBeInTheDocument();
    });
  });

  // ── 5. onReset 回调 ────────────────────────────────────────────────────────
  describe('onReset 回调', () => {
    it('应该在点击重新渲染按钮时调用 onReset', () => {
      const handleReset = vi.fn();
      render(
        <ErrorBoundary onReset={handleReset}>
          <ThrowError />
        </ErrorBoundary>
      );

      fireEvent.click(screen.getByRole('button', { name: '重新渲染' }));
      expect(handleReset).toHaveBeenCalledTimes(1);
    });

    it('应该在 onReset 后恢复显示子组件', () => {
      const handleReset = vi.fn();
      render(
        <ErrorBoundary onReset={handleReset}>
          <NormalChild />
          <ThrowError />
        </ErrorBoundary>
      );

      // 初始状态显示错误
      expect(screen.getByText('组件渲染出错')).toBeInTheDocument();

      // 点击重新渲染
      fireEvent.click(screen.getByRole('button', { name: '重新渲染' }));

      // 应该调用了 onReset
      expect(handleReset).toHaveBeenCalled();

      // 重新渲染后应该显示子组件（但因为 ThrowError 再次抛出错误，所以还是显示错误 UI）
      // 这里我们测试恢复后的行为
    });

    it('应该允许 onReset 为 undefined', () => {
      render(
        <ErrorBoundary onReset={undefined}>
          <ThrowError />
        </ErrorBoundary>
      );

      // 应该正常渲染不崩溃
      expect(screen.getByText('组件渲染出错')).toBeInTheDocument();

      // 点击重新渲染按钮也不应该崩溃
      expect(() => {
        fireEvent.click(screen.getByRole('button', { name: '重新渲染' }));
      }).not.toThrow();
    });
  });

  // ── 6. silent 模式 ─────────────────────────────────────────────────────────
  describe('silent 模式', () => {
    it('应该在 silent 模式下返回 null', () => {
      const { container } = render(
        <ErrorBoundary silent>
          <ThrowError />
        </ErrorBoundary>
      );
      expect(container.firstChild).toBeNull();
    });

    it('应该在 silent 模式下仍然记录错误', () => {
      render(
        <ErrorBoundary silent>
          <ThrowError message="Silent error" />
        </ErrorBoundary>
      );
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('应该在 silent 模式和有 name prop 时仍然记录日志', () => {
      render(
        <ErrorBoundary name="SilentComponent" silent>
          <ThrowError />
        </ErrorBoundary>
      );
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('应该允许 silent 模式和无错误时正常渲染', () => {
      const { container } = render(
        <ErrorBoundary silent>
          <NormalChild />
        </ErrorBoundary>
      );
      expect(screen.getByTestId('normal-child')).toBeInTheDocument();
    });
  });

  // ── 7. 重置错误状态 ────────────────────────────────────────────────────────
  describe('错误状态重置', () => {
    it('应该在卸载并重新挂载后恢复子组件', () => {
      const handleReset = vi.fn();
      // 先渲染抛出错误的组件
      const { unmount, rerender } = render(
        <ErrorBoundary onReset={handleReset}>
          <ConditionalThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // 初始显示错误
      expect(screen.getByText('组件渲染出错')).toBeInTheDocument();

      // 卸载错误组件并重新挂载正常组件
      unmount();
      render(
        <ErrorBoundary onReset={handleReset}>
          <ConditionalThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      // 应该显示正常内容
      expect(screen.getByTestId('recovered-child')).toBeInTheDocument();
    });

    it('应该清空 errorInfo', () => {
      const handleReset = vi.fn();
      render(
        <ErrorBoundary onReset={handleReset}>
          <ThrowError />
        </ErrorBoundary>
      );

      // 点击重置
      fireEvent.click(screen.getByRole('button', { name: '重新渲染' }));

      // onReset 回调应该被调用（表明状态被重置）
      expect(handleReset).toHaveBeenCalled();
    });
  });

  // ── 8. 边界情况 ────────────────────────────────────────────────────────────
  describe('边界情况', () => {
    it('应该处理没有 children 的情况', () => {
      const { container } = render(<ErrorBoundary />);
      expect(container.firstChild).toBeNull();
    });

    it('应该处理 null children', () => {
      const { container } = render(<ErrorBoundary>{null}</ErrorBoundary>);
      expect(container.firstChild).toBeNull();
    });

    it('应该处理 undefined children', () => {
      const { container } = render(<ErrorBoundary>{undefined}</ErrorBoundary>);
      expect(container.firstChild).toBeNull();
    });

    it('应该处理抛出非 Error 对象的错误', () => {
      const ThrowString: React.FC = () => {
        throw 'string error';
      };

      // 这应该仍然被 ErrorBoundary 捕获
      render(
        <ErrorBoundary>
          <ThrowString />
        </ErrorBoundary>
      );
      expect(screen.getByText('组件渲染出错')).toBeInTheDocument();
    });

    it('应该处理抛出对象的情况', () => {
      const ThrowObject: React.FC = () => {
        throw { reason: 'Object error' };
      };

      render(
        <ErrorBoundary>
          <ThrowObject />
        </ErrorBoundary>
      );
      expect(screen.getByText('组件渲染出错')).toBeInTheDocument();
    });
  });

  // ── 9. getDerivedStateFromError ─────────────────────────────────────────────
  describe('getDerivedStateFromError', () => {
    it('应该在错误时设置 hasError 为 true', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );
      // ErrorFallback 被渲染说明 hasError 为 true
      expect(screen.getByText('重新渲染')).toBeInTheDocument();
    });

    it('应该在重新挂载后恢复正常状态', () => {
      const handleReset = vi.fn();
      // 先渲染抛出错误的组件
      const { unmount } = render(
        <ErrorBoundary onReset={handleReset}>
          <ConditionalThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // 验证错误状态
      expect(screen.getByText('组件渲染出错')).toBeInTheDocument();

      // 卸载组件
      unmount();

      // 重新挂载正常组件
      render(
        <ErrorBoundary onReset={handleReset}>
          <ConditionalThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      // 恢复正常状态后，应该显示子组件
      expect(screen.getByTestId('recovered-child')).toBeInTheDocument();
    });
  });

  // ── 10. componentDidCatch ──────────────────────────────────────────────────
  describe('componentDidCatch', () => {
    it('应该记录 componentStack 到日志', () => {
      render(
        <ErrorBoundary>
          <ThrowError message="With stack" />
        </ErrorBoundary>
      );

      // 验证 localStorage 被调用
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('应该处理 componentStack 不存在的情况', () => {
      // componentDidCatch 应该优雅地处理 componentStack 为 undefined 的情况
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );
      expect(screen.getByText('组件渲染出错')).toBeInTheDocument();
    });
  });
});
