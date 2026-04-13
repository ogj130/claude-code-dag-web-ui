/**
 * V1.4.0 - Multimodal Store
 * Zustand store for multimodal input state management
 */

import { create } from 'zustand';
import type {
  MultimodalNode,
  CodeBlockNode,
  VerificationReportNode,
} from '../types/multimodal';

/**
 * Multimodal store state
 */
interface MultimodalState {
  // Image nodes
  imageNodes: Map<string, MultimodalNode>;

  // Code block nodes
  codeBlockNodes: Map<string, CodeBlockNode>;

  // Verification report nodes
  verificationNodes: Map<string, VerificationReportNode>;

  // UI state
  isAnalyzing: boolean;
  isVerifying: boolean;
  verificationProgress: number;

  // Actions - Image nodes
  addImageNode: (node: MultimodalNode) => void;
  updateImageNode: (id: string, updates: Partial<MultimodalNode>) => void;
  removeImageNode: (id: string) => void;

  // Actions - Code block nodes
  addCodeBlockNode: (node: CodeBlockNode) => void;
  updateCodeBlockNode: (id: string, updates: Partial<CodeBlockNode>) => void;
  removeCodeBlockNode: (id: string) => void;

  // Actions - Verification nodes
  addVerificationNode: (node: VerificationReportNode) => void;
  updateVerificationNode: (id: string, updates: Partial<VerificationReportNode>) => void;

  // Actions - UI state
  setAnalyzing: (analyzing: boolean) => void;
  setVerifying: (verifying: boolean) => void;
  setVerificationProgress: (progress: number) => void;

  // Actions - Clear
  clearAll: (sessionId: string) => void;

  // Selectors
  getImageNodesBySession: (sessionId: string) => MultimodalNode[];
  getCodeBlocksByImage: (imageId: string) => CodeBlockNode[];
}

/**
 * Create multimodal store
 */
export const useMultimodalStore = create<MultimodalState>((set, get) => ({
  // Initial state
  imageNodes: new Map(),
  codeBlockNodes: new Map(),
  verificationNodes: new Map(),
  isAnalyzing: false,
  isVerifying: false,
  verificationProgress: 0,

  // Actions - Image nodes
  addImageNode: (node) => {
    set((state) => {
      const newMap = new Map(state.imageNodes);
      newMap.set(node.id, node);
      return { imageNodes: newMap, isAnalyzing: true };
    });
  },

  updateImageNode: (id, updates) => {
    set((state) => {
      const node = state.imageNodes.get(id);
      if (!node) return state;
      const newMap = new Map(state.imageNodes);
      newMap.set(id, { ...node, ...updates });

      // Update analyzing state based on node status
      let isAnalyzing = state.isAnalyzing;
      if (updates.status === 'completed' || updates.status === 'failed' || updates.status === 'timeout') {
        isAnalyzing = Array.from(newMap.values()).some((n) => n.status === 'analyzing');
      }

      return { imageNodes: newMap, isAnalyzing };
    });
  },

  removeImageNode: (id) => {
    set((state) => {
      const newMap = new Map(state.imageNodes);
      newMap.delete(id);
      return { imageNodes: newMap };
    });
  },

  // Actions - Code block nodes
  addCodeBlockNode: (node) => {
    set((state) => {
      const newMap = new Map(state.codeBlockNodes);
      newMap.set(node.id, node);
      return { codeBlockNodes: newMap };
    });
  },

  updateCodeBlockNode: (id, updates) => {
    set((state) => {
      const node = state.codeBlockNodes.get(id);
      if (!node) return state;
      const newMap = new Map(state.codeBlockNodes);
      newMap.set(id, { ...node, ...updates });
      return { codeBlockNodes: newMap };
    });
  },

  removeCodeBlockNode: (id) => {
    set((state) => {
      const newMap = new Map(state.codeBlockNodes);
      newMap.delete(id);
      return { codeBlockNodes: newMap };
    });
  },

  // Actions - Verification nodes
  addVerificationNode: (node) => {
    set((state) => {
      const newMap = new Map(state.verificationNodes);
      newMap.set(node.id, node);
      return { verificationNodes: newMap, isVerifying: true };
    });
  },

  updateVerificationNode: (id, updates) => {
    set((state) => {
      const node = state.verificationNodes.get(id);
      if (!node) return state;
      const newMap = new Map(state.verificationNodes);
      newMap.set(id, { ...node, ...updates });

      // Update verifying state based on node status
      let isVerifying = state.isVerifying;
      if (updates.status === 'completed' || updates.status === 'failed') {
        isVerifying = Array.from(newMap.values()).some((n) => n.status === 'capturing' || n.status === 'comparing');
      }

      return { verificationNodes: newMap, isVerifying };
    });
  },

  // Actions - UI state
  setAnalyzing: (analyzing) => {
    set({ isAnalyzing: analyzing });
  },

  setVerifying: (verifying) => {
    set({ isVerifying: verifying });
  },

  setVerificationProgress: (progress) => {
    set({ verificationProgress: progress });
  },

  // Actions - Clear
  clearAll: (sessionId) => {
    set((state) => {
      const newImageMap = new Map<string, MultimodalNode>();
      const newCodeMap = new Map<string, CodeBlockNode>();
      const newVerifyMap = new Map<string, VerificationReportNode>();

      // Keep only nodes not in this session
      state.imageNodes.forEach((node, id) => {
        if (node.sessionId !== sessionId) newImageMap.set(id, node);
      });
      state.codeBlockNodes.forEach((node, id) => {
        if (node.sessionId !== sessionId) newCodeMap.set(id, node);
      });

      return {
        imageNodes: newImageMap,
        codeBlockNodes: newCodeMap,
        verificationNodes: newVerifyMap,
      };
    });
  },

  // Selectors
  getImageNodesBySession: (sessionId) => {
    const { imageNodes } = get();
    return Array.from(imageNodes.values()).filter((n) => n.sessionId === sessionId);
  },

  getCodeBlocksByImage: (imageId) => {
    const { codeBlockNodes } = get();
    return Array.from(codeBlockNodes.values()).filter((n) => n.sourceImageId === imageId);
  },
}));

/**
 * Selector hooks for specific state slices
 */
export const useImageNodes = () => useMultimodalStore((s) => s.imageNodes);
export const useCodeBlockNodes = () => useMultimodalStore((s) => s.codeBlockNodes);
export const useVerificationNodes = () => useMultimodalStore((s) => s.verificationNodes);
export const useIsAnalyzing = () => useMultimodalStore((s) => s.isAnalyzing);
export const useIsVerifying = () => useMultimodalStore((s) => s.isVerifying);
