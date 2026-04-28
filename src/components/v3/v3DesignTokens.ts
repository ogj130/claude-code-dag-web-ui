/**
 * V3 Design Tokens — 统一设计系统
 *
 * 所有 V3 组件共享的设计令牌，确保视觉一致性。
 * 映射到 theme.css 中的 CSS 变量，支持主题切换。
 *
 * Design System: Slate Dark + Blue Accent
 * Based on UI/UX Pro Max recommendations
 */

// ── 置信度阈值 (统一标准) ─────────────────────────────────
// 所有进度条/置信度/相似度指标使用同一套阈值

export const CONFIDENCE_THRESHOLDS = {
  high: 0.8,    // ≥ 0.8 → green
  medium: 0.5,  // ≥ 0.5 → yellow
  low: 0,       // < 0.5 → red
} as const;

export function getConfidenceColor(value: number): 'green' | 'yellow' | 'red' {
  if (value >= CONFIDENCE_THRESHOLDS.high) return 'green';
  if (value >= CONFIDENCE_THRESHOLDS.medium) return 'yellow';
  return 'red';
}

// ── 卡片样式 (统一背景系统) ────────────────────────────────
// 所有卡片使用同一套背景/边框/hover 样式

export const card = {
  /** 主卡片容器 */
  base: 'rounded-lg border transition-all duration-200',
  bg: 'bg-[var(--bg-card)]',
  border: 'border-[var(--border-card)]',
  hover: 'hover:border-[var(--border-hover)] hover:bg-[var(--bg-card-hover)]',
  /** 卡片完整 class */
  full: 'rounded-lg border bg-[var(--bg-card)] border-[var(--border-card)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-card-hover)] transition-all duration-200',
  /** 内嵌卡片 (更深一层) */
  inner: 'rounded-md border bg-[var(--bg-panel)] border-[var(--border)] transition-all duration-200',
  /** 代码块 */
  code: 'rounded-md bg-[var(--bg-terminal,#050508)] border border-[var(--border)] font-mono text-xs overflow-x-auto',
  /** 输入框 */
  input: 'rounded-md bg-[var(--bg-input)] border border-[var(--border)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30 outline-none transition-all duration-200',
} as const;

// ── 按钮样式 (统一玻璃态系统) ──────────────────────────────
// 所有按钮使用同一套 glassmorphism 模式

export const button = {
  /** 主要操作按钮 */
  primary: 'rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 cursor-pointer bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30 hover:bg-[var(--accent)]/25 hover:border-[var(--accent)]/50',
  /** 成功操作按钮 */
  success: 'rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 cursor-pointer bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25',
  /** 危险操作按钮 */
  danger: 'rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 cursor-pointer bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25',
  /** 幽灵按钮 (次要) */
  ghost: 'rounded-md px-3 py-1.5 text-sm transition-all duration-200 cursor-pointer bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]',
  /** 图标按钮 */
  icon: 'rounded-md p-1.5 transition-all duration-200 cursor-pointer bg-transparent text-[var(--text-muted)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-secondary)]',
  /** 选中态标签 */
  tabActive: 'bg-[var(--accent)]/15 text-[var(--accent)] border-[var(--accent)]/40',
  /** 未选中标签 */
  tabInactive: 'bg-transparent text-[var(--text-muted)] border-transparent hover:text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]',
} as const;

// ── 文字样式 ───────────────────────────────────────────────

export const text = {
  /** 标题 */
  heading: 'text-[var(--text-primary)] font-semibold',
  /** 正文 */
  body: 'text-[var(--text-secondary)]',
  /** 辅助文字 */
  muted: 'text-[var(--text-muted)]',
  /** 标签 */
  label: 'text-xs text-[var(--text-muted)] uppercase tracking-wider',
} as const;

// ── 进度条样式 ─────────────────────────────────────────────

export const progressBar = {
  track: 'h-2 rounded-full bg-[var(--bg-input)] overflow-hidden',
  fill: 'h-full rounded-full transition-all duration-500 ease-out',
  green: 'bg-emerald-400',
  yellow: 'bg-amber-400',
  red: 'bg-red-400',
} as const;

// ── 状态标签样式 ───────────────────────────────────────────

export const badge = {
  base: 'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
  success: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
  warning: 'bg-amber-500/15 text-amber-400 border border-amber-500/25',
  error: 'bg-red-500/15 text-red-400 border border-red-500/25',
  info: 'bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/25',
  neutral: 'bg-[var(--bg-card-hover)] text-[var(--text-muted)] border border-[var(--border)]',
} as const;

// ── 类型标签颜色映射 ──────────────────────────────────────

export const TYPE_COLORS: Record<string, string> = {
  create: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  fix: 'bg-red-500/15 text-red-400 border-red-500/25',
  refactor: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  deploy: 'bg-[var(--accent)]/15 text-[var(--accent)] border-[var(--accent)]/25',
  query: 'bg-[var(--bg-card-hover)] text-[var(--text-muted)] border-[var(--border)]',
  // 记忆类型
  context: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  instruction: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  constraint: 'bg-red-500/15 text-red-400 border-red-500/25',
  reference: 'bg-purple-500/15 text-purple-400 border-purple-500/25',
  checkpoint: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
} as const;

// ── 严重程度颜色 ──────────────────────────────────────────

export const SEVERITY_COLORS = {
  error: { bg: 'bg-red-500/15', border: 'border-red-500/25', text: 'text-red-400' },
  warning: { bg: 'bg-amber-500/15', border: 'border-amber-500/25', text: 'text-amber-400' },
  fatal: { bg: 'bg-red-600/15', border: 'border-red-600/25', text: 'text-red-500' },
  info: { bg: 'bg-[var(--accent)]/15', border: 'border-[var(--accent)]/25', text: 'text-[var(--accent)]' },
} as const;

// ── 动画令牌 ──────────────────────────────────────────────

export const animation = {
  /** 微交互 (按钮 hover 等) */
  micro: 'transition-all duration-200 ease-out',
  /** 中等过渡 (卡片展开等) */
  medium: 'transition-all duration-300 ease-out',
  /** 慢过渡 (进度条等) */
  slow: 'transition-all duration-500 ease-out',
} as const;

// ── 间距令牌 ──────────────────────────────────────────────

export const spacing = {
  /** 卡片内边距 */
  cardPadding: 'p-4',
  /** 紧凑内边距 */
  compact: 'p-2',
  /** 区域间距 */
  sectionGap: 'space-y-4',
  /** 元素间距 */
  elementGap: 'space-y-2',
} as const;
