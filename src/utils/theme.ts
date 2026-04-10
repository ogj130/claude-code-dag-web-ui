/**
 * 主题系统
 *
 * 功能：
 * - 暗黑/明亮主题切换
 * - 跟随系统主题（默认）
 * - 6 种预设主题色
 * - 3 档节点密度
 * - 12-18px 字体大小调节
 * - localStorage 持久化
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ThemeMode = 'light' | 'dark' | 'auto';

export type ThemeColor = 'blue' | 'purple' | 'green' | 'orange' | 'red' | 'pink';

export type NodeDensity = 'compact' | 'standard' | 'loose';

export interface ThemeConfig {
  mode: ThemeMode;
  color: ThemeColor;
  density: NodeDensity;
  fontSize: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'cc-web-ui-theme';

const DEFAULT_THEME: ThemeConfig = {
  mode: 'auto',
  color: 'blue',
  density: 'standard',
  fontSize: 14,
};

/** 主题色配置 */
const THEME_COLORS: Record<ThemeColor, { primary: string; primaryDark: string }> = {
  blue: { primary: '#3b82f6', primaryDark: '#60a5fa' },
  purple: { primary: '#a855f7', primaryDark: '#c084fc' },
  green: { primary: '#10b981', primaryDark: '#34d399' },
  orange: { primary: '#f97316', primaryDark: '#fb923c' },
  red: { primary: '#ef4444', primaryDark: '#f87171' },
  pink: { primary: '#ec4899', primaryDark: '#f472b6' },
};

/** 节点密度配置 */
const DENSITY_CONFIG: Record<NodeDensity, { padding: number; spacing: number }> = {
  compact: { padding: 8, spacing: 12 },
  standard: { padding: 12, spacing: 16 },
  loose: { padding: 16, spacing: 24 },
};

// ---------------------------------------------------------------------------
// Theme State
// ---------------------------------------------------------------------------

let currentTheme: ThemeConfig = { ...DEFAULT_THEME };
let listeners: Set<(theme: ThemeConfig) => void> = new Set();

// ---------------------------------------------------------------------------
// Theme Loading & Saving
// ---------------------------------------------------------------------------

/**
 * 从 localStorage 加载主题配置
 */
export function loadTheme(): ThemeConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<ThemeConfig>;
      currentTheme = { ...DEFAULT_THEME, ...parsed };
    }
  } catch (error) {
    console.error('[Theme] Failed to load theme:', error);
  }

  return currentTheme;
}

/**
 * 保存主题配置到 localStorage
 */
function saveTheme(theme: ThemeConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
  } catch (error) {
    console.error('[Theme] Failed to save theme:', error);
  }
}

// ---------------------------------------------------------------------------
// Theme Application
// ---------------------------------------------------------------------------

/**
 * 获取当前实际主题（解析 auto 模式）
 */
function getResolvedTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'auto') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode;
}

/**
 * 应用主题到 DOM
 */
function applyTheme(theme: ThemeConfig): void {
  const root = document.documentElement;
  const resolvedMode = getResolvedTheme(theme.mode);

  // 设置主题模式
  root.setAttribute('data-theme', resolvedMode);

  // 设置主题色
  const colors = THEME_COLORS[theme.color];
  root.style.setProperty('--primary', resolvedMode === 'dark' ? colors.primaryDark : colors.primary);

  // 设置节点密度
  const density = DENSITY_CONFIG[theme.density];
  root.style.setProperty('--node-padding', `${density.padding}px`);
  root.style.setProperty('--node-spacing', `${density.spacing}px`);

  // 设置字体大小
  root.style.setProperty('--font-size-base', `${theme.fontSize}px`);

  console.info('[Theme] Applied theme:', theme);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * 获取当前主题配置
 */
export function getTheme(): ThemeConfig {
  return { ...currentTheme };
}

/**
 * 设置主题模式
 */
export function setThemeMode(mode: ThemeMode): void {
  currentTheme.mode = mode;
  applyTheme(currentTheme);
  saveTheme(currentTheme);
  notifyListeners();
}

/**
 * 切换主题模式（循环：light → dark → auto）
 */
export function toggleThemeMode(): ThemeMode {
  const modes: ThemeMode[] = ['light', 'dark', 'auto'];
  const currentIndex = modes.indexOf(currentTheme.mode);
  const nextMode = modes[(currentIndex + 1) % modes.length];
  setThemeMode(nextMode);
  return nextMode;
}

/**
 * 设置主题色
 */
export function setThemeColor(color: ThemeColor): void {
  currentTheme.color = color;
  applyTheme(currentTheme);
  saveTheme(currentTheme);
  notifyListeners();
}

/**
 * 设置节点密度
 */
export function setNodeDensity(density: NodeDensity): void {
  currentTheme.density = density;
  applyTheme(currentTheme);
  saveTheme(currentTheme);
  notifyListeners();
}

/**
 * 设置字体大小
 */
export function setFontSize(size: number): void {
  // 限制范围 12-18px
  const clampedSize = Math.max(12, Math.min(18, size));
  currentTheme.fontSize = clampedSize;
  applyTheme(currentTheme);
  saveTheme(currentTheme);
  notifyListeners();
}

/**
 * 重置为默认主题
 */
export function resetTheme(): void {
  currentTheme = { ...DEFAULT_THEME };
  applyTheme(currentTheme);
  saveTheme(currentTheme);
  notifyListeners();
}

// ---------------------------------------------------------------------------
// Listeners
// ---------------------------------------------------------------------------

/**
 * 添加主题变更监听器
 */
export function addThemeListener(listener: (theme: ThemeConfig) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * 通知所有监听器
 */
function notifyListeners(): void {
  listeners.forEach(listener => {
    try {
      listener(currentTheme);
    } catch (error) {
      console.error('[Theme] Listener error:', error);
    }
  });
}

// ---------------------------------------------------------------------------
// System Theme Watcher
// ---------------------------------------------------------------------------

let mediaQueryListener: ((e: MediaQueryListEvent) => void) | null = null;

/**
 * 监听系统主题变化
 */
function watchSystemTheme(): void {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  mediaQueryListener = () => {
    // 只在 auto 模式下响应系统主题变化
    if (currentTheme.mode === 'auto') {
      applyTheme(currentTheme);
      notifyListeners();
    }
  };

  // 现代浏览器使用 addEventListener
  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', mediaQueryListener);
  } else {
    // 旧版浏览器使用 addListener
    mediaQuery.addListener(mediaQueryListener);
  }
}

/**
 * 停止监听系统主题
 */
function unwatchSystemTheme(): void {
  if (!mediaQueryListener) return;

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  if (mediaQuery.removeEventListener) {
    mediaQuery.removeEventListener('change', mediaQueryListener);
  } else {
    mediaQuery.removeListener(mediaQueryListener);
  }

  mediaQueryListener = null;
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

let isInitialized = false;

/**
 * 初始化主题系统
 */
export function initTheme(): () => void {
  if (isInitialized) {
    console.warn('[Theme] Already initialized');
    return () => {};
  }

  // 加载主题
  loadTheme();

  // 应用主题
  applyTheme(currentTheme);

  // 监听系统主题变化
  watchSystemTheme();

  isInitialized = true;

  console.info('[Theme] Theme system initialized');

  // 返回清理函数
  return () => {
    unwatchSystemTheme();
    listeners.clear();
    isInitialized = false;
  };
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * 获取所有可用的主题色
 */
export function getAvailableColors(): ThemeColor[] {
  return Object.keys(THEME_COLORS) as ThemeColor[];
}

/**
 * 获取所有可用的节点密度
 */
export function getAvailableDensities(): NodeDensity[] {
  return Object.keys(DENSITY_CONFIG) as NodeDensity[];
}

/**
 * 获取主题色的 CSS 值
 */
export function getThemeColorValue(color: ThemeColor, isDark: boolean): string {
  const colors = THEME_COLORS[color];
  return isDark ? colors.primaryDark : colors.primary;
}
