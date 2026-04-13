/**
 * useKeyboardShortcuts — 全局快捷键系统
 *
 * 功能：
 * - 注册全局快捷键（Cmd/Ctrl + key）
 * - 快捷键冲突检测（与浏览器默认快捷键）
 * - 快捷键帮助面板（? 键触发）
 *
 * 快捷键列表：
 * - Cmd/Ctrl+K        全局搜索（Phase 3 已实现，此处仅注册）
 * - Cmd/Ctrl+Shift+C  折叠全部 DAG 节点
 * - Cmd/Ctrl+Shift+E  展开全部 DAG 节点
 * - Cmd/Ctrl+Shift+P  打开上下文压缩抽屉（V1.4.0）
 * - Cmd/Ctrl+T        切换主题
 * - Cmd/Ctrl+H        显示/隐藏历史面板
 * - Esc               关闭弹窗/取消选择
 * - ?                 显示快捷键帮助面板
 */

import { useEffect, useRef, useMemo } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Shortcut {
  key: string;             // 显示用的键名（如 'Cmd+K'）
  combo: string;           // 匹配用的组合键（如 'cmd+k'）
  description: string;     // 描述
  scope: 'global' | 'dag' | 'modal';
  conflictWarning?: string; // 与浏览器默认行为冲突的警告
}

// 已知的浏览器快捷键冲突
const BROWSER_CONFLICTS: Record<string, string> = {
  'cmd+k': 'Chrome 地址栏聚焦（会拦截，但本应用可覆盖）',
  'cmd+t': '浏览器新建标签页（无法覆盖，仅非浏览器环境生效）',
  'cmd+h': 'macOS 隐藏窗口（无法覆盖，仅非浏览器环境生效）',
  'cmd+shift+c': 'Chrome DevTools 元素检查（DevTools 打开时会拦截）',
};

// 快捷键定义（无参数，返回快捷键数组）
export function useShortcutDefinitions(): Shortcut[] {
  const isMac = useMemo(() => typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent), []);
  const mod = isMac ? 'Cmd' : 'Ctrl';

  return useMemo(() => [
    {
      key: `${mod}+K`,
      combo: 'cmd+k',
      description: '全局搜索',
      scope: 'global',
      conflictWarning: BROWSER_CONFLICTS['cmd+k'],
    },
    {
      key: `${mod}+Shift+C`,
      combo: 'cmd+shift+c',
      description: '折叠全部节点',
      scope: 'dag',
      conflictWarning: BROWSER_CONFLICTS['cmd+shift+c'],
    },
    {
      key: `${mod}+Shift+E`,
      combo: 'cmd+shift+e',
      description: '展开全部节点',
      scope: 'dag',
    },
    {
      key: `${mod}+Shift+P`,
      combo: 'cmd+shift+p',
      description: '上下文压缩',
      scope: 'global',
    },
    {
      key: `${mod}+T`,
      combo: 'cmd+t',
      description: '切换主题',
      scope: 'global',
      conflictWarning: BROWSER_CONFLICTS['cmd+t'],
    },
    {
      key: `${mod}+H`,
      combo: 'cmd+h',
      description: '显示/隐藏历史面板',
      scope: 'global',
      conflictWarning: BROWSER_CONFLICTS['cmd+h'],
    },
    {
      key: 'Esc',
      combo: 'esc',
      description: '关闭弹窗/取消选择',
      scope: 'modal',
    },
    {
      key: '?',
      combo: '?',
      description: '显示快捷键帮助',
      scope: 'global',
    },
  ], [mod]);
}

// ---------------------------------------------------------------------------
// Key matching utility
// ---------------------------------------------------------------------------

function matchShortcut(e: KeyboardEvent): string | null {
  const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent);
  const modifier = isMac ? e.metaKey : e.ctrlKey;

  // Esc
  if (e.key === 'Escape') return 'esc';

  // ? (Shift+/)
  if (e.key === '?' && !modifier && !e.altKey) return '?';

  if (!modifier) return null;

  const hasShift = e.shiftKey;
  const key = e.key.toLowerCase();

  // Cmd/Ctrl + K
  if (key === 'k' && !hasShift) return 'cmd+k';

  // Cmd/Ctrl + Shift + C
  if (key === 'c' && hasShift) return 'cmd+shift+c';

  // Cmd/Ctrl + Shift + E
  if (key === 'e' && hasShift) return 'cmd+shift+e';

  // Cmd/Ctrl + Shift + P (compaction)
  if (key === 'p' && hasShift) return 'cmd+shift+p';

  // Cmd/Ctrl + T
  if (key === 't' && !hasShift) return 'cmd+t';

  // Cmd/Ctrl + H
  if (key === 'h' && !hasShift) return 'cmd+h';

  return null;
}

// ---------------------------------------------------------------------------
// Conflict detection
// ---------------------------------------------------------------------------

export interface ConflictInfo {
  combo: string;
  description: string;
  warning: string;
}

export function detectConflicts(shortcuts: Shortcut[]): ConflictInfo[] {
  return shortcuts
    .filter(s => s.conflictWarning)
    .map(s => ({
      combo: s.key,
      description: s.description,
      warning: s.conflictWarning!,
    }));
}

// ---------------------------------------------------------------------------
// Main Hook
// ---------------------------------------------------------------------------

export interface UseKeyboardShortcutsOptions {
  openSearch: () => void;
  collapseAll: () => void;
  expandAll: () => void;
  openCompaction: () => void;  // V1.4.0
  toggleTheme: () => void;
  toggleHistory: () => void;
  closeModal: () => void;
  showShortcutHelp: () => void;
  /** 是否启用（默认 true） */
  enabled?: boolean;
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions) {
  const {
    openSearch,
    collapseAll,
    expandAll,
    openCompaction,
    toggleTheme,
    toggleHistory,
    closeModal,
    showShortcutHelp,
    enabled = true,
  } = options;

  // 使用 ref 保持回调最新，避免 useEffect 重新绑定
  const actionsRef = useRef({
    openSearch,
    collapseAll,
    expandAll,
    openCompaction,
    toggleTheme,
    toggleHistory,
    closeModal,
    showShortcutHelp,
  });
  actionsRef.current = {
    openSearch,
    collapseAll,
    expandAll,
    openCompaction,
    toggleTheme,
    toggleHistory,
    closeModal,
    showShortcutHelp,
  };

  // 快捷键定义（无依赖，仅在初始化时调用一次）
  const shortcuts = useShortcutDefinitions();
  const conflicts = useMemo(() => detectConflicts(shortcuts), [shortcuts]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 忽略输入框中的按键（除了 Esc）
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (isInput && e.key !== 'Escape') return;

      const combo = matchShortcut(e);
      if (!combo) return;

      const a = actionsRef.current;

      switch (combo) {
        case 'cmd+k':
          e.preventDefault();
          e.stopPropagation();
          a.openSearch();
          break;
        case 'cmd+shift+c':
          e.preventDefault();
          e.stopPropagation();
          a.collapseAll();
          break;
        case 'cmd+shift+e':
          e.preventDefault();
          e.stopPropagation();
          a.expandAll();
          break;
        case 'cmd+shift+p':
          e.preventDefault();
          e.stopPropagation();
          a.openCompaction();
          break;
        case 'cmd+t':
          // 浏览器会拦截 Cmd+T，这里只做非浏览器环境或 Ctrl+T
          e.preventDefault();
          e.stopPropagation();
          a.toggleTheme();
          break;
        case 'cmd+h':
          e.preventDefault();
          e.stopPropagation();
          a.toggleHistory();
          break;
        case 'esc':
          e.preventDefault();
          e.stopPropagation();
          a.closeModal();
          break;
        case '?':
          // 仅在非输入框中生效
          if (isInput) return;
          e.preventDefault();
          a.showShortcutHelp();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true); // capture 阶段
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [enabled]);

  return {
    shortcuts,
    conflicts,
  };
}