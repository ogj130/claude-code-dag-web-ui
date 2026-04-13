/**
 * useUpdateStore — 自动更新状态管理
 * 管理版本信息、检查状态、下载进度
 */
import { create } from 'zustand';

export interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes: string | null;
  downloadUrl: string;
}

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'up-to-date'
  | 'error';

interface UpdateState {
  currentVersion: string;
  updateInfo: UpdateInfo | null;
  status: UpdateStatus;
  progress: number;
  error: string | null;
}

interface UpdateActions {
  init: (currentVersion: string) => void;
  setAvailable: (info: UpdateInfo) => void;
  setChecking: () => void;
  setDownloading: () => void;
  setProgress: (progress: number) => void;
  setReady: () => void;
  setUpToDate: () => void;
  setError: (error: string) => void;
  reset: () => void;
}

export const useUpdateStore = create<UpdateState & UpdateActions>((set) => ({
  currentVersion: '',
  updateInfo: null,
  status: 'idle',
  progress: 0,
  error: null,

  init: (currentVersion) => set({ currentVersion }),

  setAvailable: (info) =>
    set({ updateInfo: info, status: 'available', error: null }),

  setChecking: () => set({ status: 'checking', error: null }),

  setDownloading: () => set({ status: 'downloading', progress: 0, error: null }),

  setProgress: (progress) => set({ progress }),

  setReady: () => set({ status: 'ready' }),

  setUpToDate: () =>
    set({ status: 'up-to-date', updateInfo: null, error: null }),

  setError: (error) => set({ status: 'error', error }),

  reset: () =>
    set({ updateInfo: null, status: 'idle', progress: 0, error: null }),
}));
