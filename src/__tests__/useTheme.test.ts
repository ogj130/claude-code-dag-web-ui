/**
 * useTheme — 渲染覆盖测试
 * 覆盖率标准: 行 95%
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from '@/hooks/useTheme';

// ── Mock window.matchMedia ─────────────────────────────────────────────────────

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

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

// ── 测试套件 ──────────────────────────────────────────────────────────────────

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.removeItem('cc-theme-config');
    vi.clearAllMocks();
  });

  it('应该有 theme 属性', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBeDefined();
  });

  it('应该有 mode 属性', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.mode).toBeDefined();
  });

  it('应该有 setMode 函数', () => {
    const { result } = renderHook(() => useTheme());
    expect(typeof result.current.setMode).toBe('function');
  });

  it('应该有 toggleTheme 函数（通过 setMode 实现）', () => {
    const { result } = renderHook(() => useTheme());
    expect(typeof result.current.setMode).toBe('function');
  });

  it('应该有 setAccent 函数', () => {
    const { result } = renderHook(() => useTheme());
    expect(typeof result.current.setAccent).toBe('function');
  });

  it('应该有 setDensity 函数', () => {
    const { result } = renderHook(() => useTheme());
    expect(typeof result.current.setDensity).toBe('function');
  });

  it('应该有 setFontSize 函数', () => {
    const { result } = renderHook(() => useTheme());
    expect(typeof result.current.setFontSize).toBe('function');
  });

  it('初始 accent 为 blue', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.accent).toBe('blue');
  });

  it('初始 density 为 standard', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.density).toBe('standard');
  });

  it('初始 fontSize 为 14', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.fontSize).toBe(14);
  });

  it('setMode 更新 mode 状态', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.mode).toBe('system');
    act(() => { result.current.setMode('dark'); });
    expect(result.current.mode).toBe('dark');
  });

  it('setAccent 更新 accent 状态', () => {
    const { result } = renderHook(() => useTheme());
    act(() => { result.current.setAccent('purple'); });
    expect(result.current.accent).toBe('purple');
  });

  it('setDensity 更新 density 状态', () => {
    const { result } = renderHook(() => useTheme());
    act(() => { result.current.setDensity('compact'); });
    expect(result.current.density).toBe('compact');
  });

  it('setFontSize 更新 fontSize 状态', () => {
    const { result } = renderHook(() => useTheme());
    act(() => { result.current.setFontSize(16); });
    expect(result.current.fontSize).toBe(16);
  });

  it('theme 跟随 mode=system 检测系统主题', () => {
    const { result } = renderHook(() => useTheme());
    // 初始 mode=system，theme 由系统决定（dark 或 light）
    expect(['dark', 'light']).toContain(result.current.theme);
  });

  it('theme 跟随 mode=dark', () => {
    const { result } = renderHook(() => useTheme());
    act(() => { result.current.setMode('dark'); });
    expect(result.current.theme).toBe('dark');
  });

  it('theme 跟随 mode=light', () => {
    const { result } = renderHook(() => useTheme());
    act(() => { result.current.setMode('light'); });
    expect(result.current.theme).toBe('light');
  });
});
