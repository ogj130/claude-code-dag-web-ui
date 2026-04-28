/**
 * useModeStore — V3 双模式状态管理
 *
 * 管理 Guided/Expert 模式切换，持久化到 localStorage。
 * V3 首次启动默认 Expert 模式（与 V2 兼容）。
 */

import { create } from 'zustand';
import type { AppMode } from '../components/v3/ModeSwitcher';

interface ModeState {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  toggleMode: () => void;
  isGuided: () => boolean;
  isExpert: () => boolean;
}

function loadSavedMode(): AppMode {
  try {
    const saved = localStorage.getItem('cc-web-ui-mode');
    if (saved === 'guided' || saved === 'expert') return saved;
  } catch {
    // localStorage 不可用
  }
  return 'expert'; // 默认专家模式（V2 兼容）
}

export const useModeStore = create<ModeState>((set, get) => ({
  mode: loadSavedMode(),

  setMode: (mode: AppMode) => {
    localStorage.setItem('cc-web-ui-mode', mode);
    set({ mode });
  },

  toggleMode: () => {
    const next = get().mode === 'guided' ? 'expert' : 'guided';
    localStorage.setItem('cc-web-ui-mode', next);
    set({ mode: next });
  },

  isGuided: () => get().mode === 'guided',
  isExpert: () => get().mode === 'expert',
}));
