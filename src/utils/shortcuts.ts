/**
 * 全局快捷键系统
 *
 * 支持的快捷键：
 * - Cmd/Ctrl+K: 全局搜索
 * - Cmd/Ctrl+Shift+C: 折叠全部节点
 * - Cmd/Ctrl+Shift+E: 展开全部节点
 * - Cmd/Ctrl+T: 主题切换
 * - Cmd/Ctrl+H: 历史面板切换
 * - Esc: 关闭弹窗/取消选择
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ShortcutKey =
  | 'global-search'
  | 'collapse-all'
  | 'expand-all'
  | 'toggle-theme'
  | 'toggle-history'
  | 'escape';

export interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  description: string;
  handler: () => void;
}

export type ShortcutHandler = () => void;

// ---------------------------------------------------------------------------
// Shortcut Registry
// ---------------------------------------------------------------------------

const shortcuts = new Map<ShortcutKey, ShortcutConfig>();
const handlers = new Map<ShortcutKey, ShortcutHandler>();

/**
 * 注册快捷键
 */
export function registerShortcut(
  id: ShortcutKey,
  config: Omit<ShortcutConfig, 'handler'>,
  handler: ShortcutHandler
): void {
  shortcuts.set(id, { ...config, handler });
  handlers.set(id, handler);
}

/**
 * 注销快捷键
 */
export function unregisterShortcut(id: ShortcutKey): void {
  shortcuts.delete(id);
  handlers.delete(id);
}

/**
 * 获取所有已注册的快捷键
 */
export function getAllShortcuts(): Array<{ id: ShortcutKey; config: ShortcutConfig }> {
  return Array.from(shortcuts.entries()).map(([id, config]) => ({ id, config }));
}

// ---------------------------------------------------------------------------
// Keyboard Event Handler
// ---------------------------------------------------------------------------

/**
 * 检查快捷键是否匹配
 */
function matchesShortcut(event: KeyboardEvent, config: ShortcutConfig): boolean {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  // 检查修饰键
  const ctrlKey = isMac ? event.metaKey : event.ctrlKey;
  const metaKey = isMac ? event.metaKey : event.ctrlKey;

  if (config.ctrl && !ctrlKey) return false;
  if (config.meta && !metaKey) return false;
  if (config.shift && !event.shiftKey) return false;
  if (config.alt && !event.altKey) return false;

  // 检查按键
  return event.key.toLowerCase() === config.key.toLowerCase();
}

/**
 * 全局键盘事件处理器
 */
function handleKeyDown(event: KeyboardEvent): void {
  // 检查是否在输入框中
  const target = event.target as HTMLElement;
  const isInput = target.tagName === 'INPUT' ||
                  target.tagName === 'TEXTAREA' ||
                  target.isContentEditable;

  // 遍历所有快捷键
  for (const [id, config] of shortcuts) {
    if (matchesShortcut(event, config)) {
      // Escape 键总是允许
      if (id === 'escape') {
        event.preventDefault();
        config.handler();
        return;
      }

      // 在输入框中时，只允许 Escape 和全局搜索
      if (isInput && id !== 'global-search') {
        continue;
      }

      event.preventDefault();
      config.handler();
      return;
    }
  }
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

let isInitialized = false;

/**
 * 初始化快捷键系统
 */
export function initShortcuts(): () => void {
  if (isInitialized) {
    console.warn('[Shortcuts] Already initialized');
    return () => {};
  }

  document.addEventListener('keydown', handleKeyDown);
  isInitialized = true;

  console.info('[Shortcuts] Keyboard shortcuts initialized');

  // 返回清理函数
  return () => {
    document.removeEventListener('keydown', handleKeyDown);
    isInitialized = false;
  };
}

// ---------------------------------------------------------------------------
// Conflict Detection
// ---------------------------------------------------------------------------

/**
 * 检测快捷键冲突
 * 返回可能与浏览器快捷键冲突的列表
 */
export function detectConflicts(): Array<{
  id: ShortcutKey;
  config: ShortcutConfig;
  conflictsWith: string;
}> {
  const conflicts: Array<{
    id: ShortcutKey;
    config: ShortcutConfig;
    conflictsWith: string;
  }> = [];

  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  for (const [id, config] of shortcuts) {
    // Cmd/Ctrl+K 与浏览器地址栏冲突
    if (config.key === 'k' && (config.ctrl || config.meta)) {
      conflicts.push({
        id,
        config,
        conflictsWith: isMac ? 'Safari 地址栏搜索' : '浏览器地址栏',
      });
    }

    // Cmd/Ctrl+H 与浏览器历史记录冲突
    if (config.key === 'h' && (config.ctrl || config.meta)) {
      conflicts.push({
        id,
        config,
        conflictsWith: '浏览器历史记录',
      });
    }

    // Cmd/Ctrl+T 与新标签页冲突
    if (config.key === 't' && (config.ctrl || config.meta)) {
      conflicts.push({
        id,
        config,
        conflictsWith: '浏览器新标签页',
      });
    }
  }

  return conflicts;
}

/**
 * 格式化快捷键显示
 */
export function formatShortcut(config: ShortcutConfig): string {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const parts: string[] = [];

  if (config.ctrl || config.meta) {
    parts.push(isMac ? '⌘' : 'Ctrl');
  }
  if (config.shift) {
    parts.push(isMac ? '⇧' : 'Shift');
  }
  if (config.alt) {
    parts.push(isMac ? '⌥' : 'Alt');
  }

  parts.push(config.key.toUpperCase());

  return parts.join(isMac ? '' : '+');
}
