/**
 * useUserProfileStore — V3 用户画像状态管理
 *
 * 管理用户画像维度、置信度、手动覆盖。
 * 通过 IPC 调用主进程 SQLite 存储。
 */

import { create } from 'zustand';

export interface ProfileDimension {
  key: string;
  label: string;
  value: string;
  confidence: number;
  isManual: boolean;
  source?: string;
  updatedAt?: number;
}

interface UserProfileState {
  dimensions: ProfileDimension[];
  workspaceId: string | null;
  isLoading: boolean;

  // Actions
  loadProfile: (workspaceId: string) => Promise<void>;
  updateDimension: (key: string, value: string, isManual?: boolean) => Promise<void>;
  getDimension: (key: string) => ProfileDimension | undefined;
  exportProfile: () => string;
  resetProfile: () => void;
}

const DEFAULT_DIMENSIONS: ProfileDimension[] = [
  { key: 'language', label: '偏好语言', value: '', confidence: 0, isManual: false },
  { key: 'framework', label: '常用框架', value: '', confidence: 0, isManual: false },
  { key: 'pattern', label: '设计模式', value: '', confidence: 0, isManual: false },
  { key: 'naming', label: '命名风格', value: '', confidence: 0, isManual: false },
  { key: 'debugging', label: '调试习惯', value: '', confidence: 0, isManual: false },
  { key: 'skill_level', label: '技能水平', value: '', confidence: 0, isManual: false },
  { key: 'verbosity', label: '注释风格', value: '', confidence: 0, isManual: false },
  { key: 'testing', label: '测试偏好', value: '', confidence: 0, isManual: false },
];

const isElectron = () => typeof window !== 'undefined' && window.electron?.invoke;

export const useUserProfileStore = create<UserProfileState>((set, get) => ({
  dimensions: DEFAULT_DIMENSIONS,
  workspaceId: null,
  isLoading: false,

  loadProfile: async (workspaceId: string) => {
    set({ isLoading: true, workspaceId });
    try {
      if (isElectron()) {
        const result = await window.electron.invoke('sqlite:profile:get', { workspaceId }) as { userPeer?: Array<{ dimension: string; value: string; confidence: number; is_manual: number }> } | null;
        if (result?.userPeer) {
          const dims = DEFAULT_DIMENSIONS.map((d) => {
            const peer = result.userPeer!.find((p) => p.dimension === d.key);
            return peer
              ? { ...d, value: peer.value, confidence: peer.confidence, isManual: !!peer.is_manual }
              : d;
          });
          set({ dimensions: dims });
        }
      }
    } catch (err) {
      console.error('[UserProfile] Failed to load:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  updateDimension: async (key: string, value: string, isManual = false) => {
    const { workspaceId, dimensions } = get();
    const confidence = isManual ? 1.0 : dimensions.find((d) => d.key === key)?.confidence ?? 0;

    // 乐观更新
    set({
      dimensions: dimensions.map((d) =>
        d.key === key ? { ...d, value, isManual, confidence, updatedAt: Date.now() } : d
      ),
    });

    // 持久化到 SQLite
    if (workspaceId && isElectron()) {
      try {
        await window.electron.invoke('sqlite:profile:update', {
          workspaceId,
          dimension: key,
          value,
          confidence,
          isManual,
        });
      } catch (err) {
        console.error('[UserProfile] Failed to save:', err);
      }
    }
  },

  getDimension: (key: string) => get().dimensions.find((d) => d.key === key),

  exportProfile: () => {
    const { dimensions, workspaceId } = get();
    return JSON.stringify({ workspaceId, dimensions, exportedAt: new Date().toISOString() }, null, 2);
  },

  resetProfile: () => set({ dimensions: DEFAULT_DIMENSIONS }),
}));
