/**
 * V1.4.1 - Attachment Store
 * Zustand store for managing pending attachments
 */

import { create } from 'zustand';
import type { PendingAttachment, SentAttachment } from '../types/attachment';

interface AttachmentState {
  // Pending attachments (not yet sent) - stored as array for stable references
  pendingAttachments: PendingAttachment[];

  // Sent attachments (grouped by queryId)
  sentAttachments: Map<string, SentAttachment[]>;

  // UI state
  isPreviewExpanded: boolean;
  previewMode: 'thumbnail' | 'list' | 'expanded';

  // Actions - Pending
  addPendingAttachment: (attachment: PendingAttachment) => void;
  updatePendingAttachment: (id: string, updates: Partial<PendingAttachment>) => void;
  removePendingAttachment: (id: string) => void;
  clearPendingAttachments: () => void;

  // Actions - Sent
  addSentAttachment: (attachment: SentAttachment) => void;
  clearSentAttachments: (queryId: string) => void;

  // Actions - UI
  setPreviewExpanded: (expanded: boolean) => void;
  setPreviewMode: (mode: 'thumbnail' | 'list' | 'expanded') => void;
}

export const useAttachmentStore = create<AttachmentState>((set) => ({
  // Initial state
  pendingAttachments: [],
  sentAttachments: new Map(),
  isPreviewExpanded: false,
  previewMode: 'thumbnail',

  // Actions - Pending
  addPendingAttachment: (attachment) => {
    set((state) => ({
      pendingAttachments: [...state.pendingAttachments, attachment],
    }));
  },

  updatePendingAttachment: (id, updates) => {
    set((state) => ({
      pendingAttachments: state.pendingAttachments.map((a) =>
        a.id === id ? { ...a, ...updates } : a
      ),
    }));
  },

  removePendingAttachment: (id) => {
    set((state) => ({
      pendingAttachments: state.pendingAttachments.filter((a) => a.id !== id),
    }));
  },

  clearPendingAttachments: () => {
    set({ pendingAttachments: [], isPreviewExpanded: false });
  },

  // Actions - Sent
  addSentAttachment: (attachment) => {
    set((state) => {
      const newMap = new Map(state.sentAttachments);
      const existing = newMap.get(attachment.queryId) || [];
      newMap.set(attachment.queryId, [...existing, attachment]);
      return { sentAttachments: newMap };
    });
  },

  clearSentAttachments: (queryId) => {
    set((state) => {
      const newMap = new Map(state.sentAttachments);
      newMap.delete(queryId);
      return { sentAttachments: newMap };
    });
  },

  // Actions - UI
  setPreviewExpanded: (expanded) => {
    set({ isPreviewExpanded: expanded });
  },

  setPreviewMode: (mode) => {
    set({ previewMode: mode });
  },
}));

// Selector hooks - return stable references
export const usePendingAttachments = () =>
  useAttachmentStore((s) => s.pendingAttachments);

export const usePendingCount = () =>
  useAttachmentStore((s) => s.pendingAttachments.length);

export const useIsPreviewExpanded = () =>
  useAttachmentStore((s) => s.isPreviewExpanded);

export const usePreviewMode = () =>
  useAttachmentStore((s) => s.previewMode);
