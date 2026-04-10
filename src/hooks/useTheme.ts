import { useState, useEffect, useCallback } from 'react';

// ── 类型定义 ───────────────────────────────────────────────────────
export type ThemeMode = 'dark' | 'light' | 'system';
export type AccentColor = 'blue' | 'purple' | 'green' | 'orange' | 'red' | 'pink';
export type Density = 'compact' | 'standard' | 'loose';
export type FontSize = 12 | 13 | 14 | 15 | 16 | 17 | 18;

export interface ThemeConfig {
  mode: ThemeMode;
  accent: AccentColor;
  density: Density;
  fontSize: FontSize;
}

interface UseThemeReturn {
  /** 当前实际生效的主题（resolved） */
  theme: 'dark' | 'light';
  /** 用户选择的模式（可能为 'system'） */
  mode: ThemeMode;
  accent: AccentColor;
  density: Density;
  fontSize: FontSize;
  setMode: (m: ThemeMode) => void;
  setAccent: (a: AccentColor) => void;
  setDensity: (d: Density) => void;
  setFontSize: (s: FontSize) => void;
}

// ── 常量 ───────────────────────────────────────────────────────────
const STORAGE_KEY = 'cc-theme-config';

const DEFAULT_CONFIG: ThemeConfig = {
  mode: 'system',
  accent: 'blue',
  density: 'standard',
  fontSize: 14,
};

// ── 工具函数 ───────────────────────────────────────────────────────
function detectSystemTheme(): 'dark' | 'light' {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'dark';
}

function loadConfig(): ThemeConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ThemeConfig>;
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch {
    // ignore parse errors
  }
  return DEFAULT_CONFIG;
}

function saveConfig(config: ThemeConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // ignore storage errors
  }
}

/** 将配置应用到 DOM data 属性和 class */
function applyToDOM(config: ThemeConfig): void {
  const root = document.documentElement;

  // 解析实际主题
  const resolved = config.mode === 'system' ? detectSystemTheme() : config.mode;
  root.setAttribute('data-theme', resolved);

  // ReactFlow dark mode 检测 .dark class，同时维护 data-theme 的兼容
  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  // 主题色
  root.setAttribute('data-accent', config.accent);

  // 密度
  root.setAttribute('data-density', config.density);

  // 字体大小
  root.setAttribute('data-font-size', String(config.fontSize));
}

// ── Hook ────────────────────────────────────────────────────────────
export function useTheme(): UseThemeReturn {
  const [config, setConfig] = useState<ThemeConfig>(() => loadConfig());

  // 计算实际生效的主题
  const resolvedTheme: 'dark' | 'light' =
    config.mode === 'system' ? detectSystemTheme() : config.mode;

  // 首次挂载 & 配置变更时应用到 DOM
  useEffect(() => {
    applyToDOM(config);
    saveConfig(config);
  }, [config]);

  // 监听系统主题变化（仅 mode=system 时有意义）
  useEffect(() => {
    if (config.mode !== 'system') return;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      const resolved = e.matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', resolved);
      if (resolved === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [config.mode]);

  const setMode = useCallback((m: ThemeMode) => {
    setConfig(prev => ({ ...prev, mode: m }));
  }, []);

  const setAccent = useCallback((a: AccentColor) => {
    setConfig(prev => ({ ...prev, accent: a }));
  }, []);

  const setDensity = useCallback((d: Density) => {
    setConfig(prev => ({ ...prev, density: d }));
  }, []);

  const setFontSize = useCallback((s: FontSize) => {
    setConfig(prev => ({ ...prev, fontSize: s }));
  }, []);

  return {
    theme: resolvedTheme,
    mode: config.mode,
    accent: config.accent,
    density: config.density,
    fontSize: config.fontSize,
    setMode,
    setAccent,
    setDensity,
    setFontSize,
  };
}
