/**
 * WorkingMemoryStore — V3 工作记忆状态管理
 *
 * 基于 V1.4.0 的 CompactionStore 扩展：
 * - 保留所有上下文压缩功能（向后兼容）
 * - 新增条目级 CRUD（§ 分隔符管理）
 * - 新增 Token 窗口实时监控（80% 阈值自动压缩）
 *
 * 原 useCompactionStore 已改为 re-export 本 store，现有代码无需修改。
 */

import { create } from 'zustand';
import type {
  CompactionReport,
  CompactionSettings,
  ContextUsageState,
  CompressionTriggerStatus,
} from '../types/compaction';
import { DEFAULT_COMPACTION_SETTINGS, getCompressionStatus } from '../types/compaction';

// ── 工作记忆条目 ──────────────────────────────────────────

export interface WorkingMemoryEntry {
  id: string;
  /** 条目类型 */
  type: 'context' | 'instruction' | 'constraint' | 'reference' | 'checkpoint';
  /** 条目内容 */
  content: string;
  /** 优先级（越高越不容易被压缩丢弃） */
  priority: number;
  /** 创建时间 */
  createdAt: number;
  /** 最后访问时间 */
  lastAccessedAt: number;
  /** Token 估算长度 */
  tokenEstimate: number;
}

// ── State 类型 ────────────────────────────────────────────

interface WorkingMemoryState {
  // ── 原 CompactionStore 字段（向后兼容）─────────────────
  reports: CompactionReport[];
  selectedReportId: string | null;
  contextUsage: ContextUsageState;
  settings: CompactionSettings;
  isDrawerOpen: boolean;
  isCompressing: boolean;

  // ── V3 新增：工作记忆条目 ──────────────────────────────
  entries: WorkingMemoryEntry[];

  // ── 原 CompactionStore Actions ─────────────────────────
  addReport: (report: CompactionReport) => void;
  selectReport: (id: string | null) => void;
  clearReports: () => void;
  updateContextUsage: (inputTokens: number) => void;
  resetContextUsage: () => void;
  updateSettings: (settings: Partial<CompactionSettings>) => void;
  resetSettings: () => void;
  setDrawerOpen: (open: boolean) => void;
  setCompressing: (compressing: boolean) => void;
  getCompressionStatus: () => CompressionTriggerStatus;
  getTotalSavings: () => number;

  // ── V3 新增：工作记忆 Actions ──────────────────────────
  addEntry: (entry: Omit<WorkingMemoryEntry, 'id' | 'createdAt' | 'lastAccessedAt'>) => void;
  updateEntry: (id: string, updates: Partial<Pick<WorkingMemoryEntry, 'content' | 'priority'>>) => void;
  removeEntry: (id: string) => void;
  touchEntry: (id: string) => void;
  clearEntries: () => void;
  getEntriesByType: (type: WorkingMemoryEntry['type']) => WorkingMemoryEntry[];
  getTotalTokens: () => number;
  /** 序列化为 § 分隔的字符串（发送给 Claude 前组装上下文） */
  serialize: () => string;
  /** 从 § 分隔的字符串反序列化 */
  deserialize: (text: string) => void;
  /** 80% 阈值检查：返回需要压缩的条目列表 */
  getOverflowEntries: () => WorkingMemoryEntry[];
}

// ── 初始状态 ──────────────────────────────────────────────

const initialContextUsage: ContextUsageState = {
  totalInputTokens: 0,
  estimatedWindow: 128000,
  usagePct: 0,
  lastUpdated: Date.now(),
};

// ── 简单 UUID 生成 ────────────────────────────────────────

function generateId(): string {
  return crypto.randomUUID?.() ?? `wm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Token 估算（粗略：1 token ≈ 4 字符英文 / 1.5 字符中文）─

function estimateTokens(text: string): number {
  const cjkChars = (text.match(/[\u4e00-\u9fff\u3040-\u30ff]/g) ?? []).length;
  const otherChars = text.length - cjkChars;
  return Math.ceil(cjkChars / 1.5 + otherChars / 4);
}

// ── Store ─────────────────────────────────────────────────

export const useWorkingMemoryStore = create<WorkingMemoryState>((set, get) => ({
  // ── 原 CompactionStore 状态 ────────────────────────────
  reports: [],
  selectedReportId: null,
  contextUsage: initialContextUsage,
  settings: DEFAULT_COMPACTION_SETTINGS,
  isDrawerOpen: false,
  isCompressing: false,

  // ── V3 新增状态 ────────────────────────────────────────
  entries: [],

  // ── 原 CompactionStore Actions（完整保留）───────────────
  addReport: (report) => {
    set((state) => ({
      reports: [report, ...state.reports].slice(0, 100),
    }));
  },

  selectReport: (id) => set({ selectedReportId: id }),

  clearReports: () => set({ reports: [], selectedReportId: null }),

  updateContextUsage: (inputTokens) => {
    set((state) => {
      const totalInputTokens = state.contextUsage.totalInputTokens + inputTokens;
      const usagePct = (totalInputTokens / state.contextUsage.estimatedWindow) * 100;
      return {
        contextUsage: {
          totalInputTokens,
          estimatedWindow: state.contextUsage.estimatedWindow,
          usagePct: Math.min(usagePct, 100),
          lastUpdated: Date.now(),
        },
      };
    });
  },

  resetContextUsage: () => set({ contextUsage: initialContextUsage }),

  updateSettings: (updates) => {
    set((state) => ({
      settings: { ...state.settings, ...updates },
    }));
  },

  resetSettings: () => set({ settings: DEFAULT_COMPACTION_SETTINGS }),

  setDrawerOpen: (open) => set({ isDrawerOpen: open }),

  setCompressing: (compressing) => set({ isCompressing: compressing }),

  getCompressionStatus: () => {
    const { usagePct } = get().contextUsage;
    return getCompressionStatus(usagePct);
  },

  getTotalSavings: () => {
    const { reports } = get();
    if (reports.length === 0) return 0;
    const totalBefore = reports.reduce((sum, r) => sum + r.beforeTokens, 0);
    const totalAfter = reports.reduce((sum, r) => sum + r.afterTokens, 0);
    if (totalBefore === 0) return 0;
    return ((totalBefore - totalAfter) / totalBefore) * 100;
  },

  // ── V3 新增 Actions ────────────────────────────────────

  addEntry: (partial) => {
    const id = generateId();
    const now = Date.now();
    const entry: WorkingMemoryEntry = {
      ...partial,
      id,
      createdAt: now,
      lastAccessedAt: now,
      tokenEstimate: estimateTokens(partial.content),
    };
    set((state) => ({ entries: [...state.entries, entry] }));
  },

  updateEntry: (id, updates) => {
    set((state) => ({
      entries: state.entries.map((e) =>
        e.id === id
          ? {
              ...e,
              ...updates,
              tokenEstimate: updates.content ? estimateTokens(updates.content) : e.tokenEstimate,
              lastAccessedAt: Date.now(),
            }
          : e
      ),
    }));
  },

  removeEntry: (id) => {
    set((state) => ({ entries: state.entries.filter((e) => e.id !== id) }));
  },

  touchEntry: (id) => {
    set((state) => ({
      entries: state.entries.map((e) =>
        e.id === id ? { ...e, lastAccessedAt: Date.now() } : e
      ),
    }));
  },

  clearEntries: () => set({ entries: [] }),

  getEntriesByType: (type) => get().entries.filter((e) => e.type === type),

  getTotalTokens: () => get().entries.reduce((sum, e) => sum + e.tokenEstimate, 0),

  serialize: () => {
    const { entries } = get();
    if (entries.length === 0) return '';
    return entries
      .sort((a, b) => b.priority - a.priority)
      .map((e) => `[${e.type}|p${e.priority}] ${e.content}`)
      .join('\n§\n');
  },

  deserialize: (text) => {
    if (!text.trim()) {
      set({ entries: [] });
      return;
    }
    const parts = text.split(/\n§\n/);
    const entries: WorkingMemoryEntry[] = parts.map((part) => {
      const match = part.match(/^\[(\w+)\|p(\d+)\]\s*(.*)$/s);
      const type = (match?.[1] ?? 'context') as WorkingMemoryEntry['type'];
      const priority = Number(match?.[2] ?? 1);
      const content = match?.[3] ?? part;
      const now = Date.now();
      return {
        id: generateId(),
        type,
        content,
        priority,
        createdAt: now,
        lastAccessedAt: now,
        tokenEstimate: estimateTokens(content),
      };
    });
    set({ entries });
  },

  getOverflowEntries: () => {
    const { entries, contextUsage } = get();
    if (contextUsage.usagePct < 80) return [];
    // 优先级最低 + 最久未访问的条目优先被压缩
    return [...entries]
      .sort((a, b) => a.priority - b.priority || a.lastAccessedAt - b.lastAccessedAt)
      .slice(0, Math.ceil(entries.length * 0.3));
  },
}));

// ── 向后兼容：旧 selector hooks ───────────────────────────

export const useCompressionStatus = () => useWorkingMemoryStore((s) => s.getCompressionStatus());
export const useCompactionReports = () => useWorkingMemoryStore((s) => s.reports);
export const useCompactionSettings = () => useWorkingMemoryStore((s) => s.settings);
export const useIsDrawerOpen = () => useWorkingMemoryStore((s) => s.isDrawerOpen);

// ── V3 新增 selector hooks ────────────────────────────────

export const useWorkingMemoryEntries = () => useWorkingMemoryStore((s) => s.entries);
export const useWorkingMemoryTokens = () => useWorkingMemoryStore((s) => s.getTotalTokens());
