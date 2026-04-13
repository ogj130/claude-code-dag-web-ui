/**
 * V1.4.0 - useClipboardImage Hook
 * Detects and processes image paste events from clipboard
 *
 * Supports:
 * - Cmd/Ctrl+V with image in clipboard
 * - Automatic toast notification on paste
 * - Creation of MultimodalNode in store
 */

import { useEffect, useRef, useCallback } from 'react';
import { processImage } from '../utils/imageProcessor';
import { useMultimodalStore } from '../stores/useMultimodalStore';
import type { MultimodalNode } from '../types/multimodal';

export interface UseClipboardImageOptions {
  /** Session ID for associating nodes */
  sessionId: string;
  /** Whether to show toast on paste */
  showToast?: boolean;
  /** Toast message template */
  toastMessage?: string;
  /** Whether the hook is enabled */
  enabled?: boolean;
  /** Callback when image is pasted */
  onPaste?: (node: MultimodalNode) => void;
}

/**
 * Hook for clipboard image paste detection
 *
 * Usage:
 * ```tsx
 * useClipboardImage({
 *   sessionId: currentSessionId,
 *   showToast: true,
 *   onPaste: (node) => console.log('Image pasted:', node.id),
 * });
 * ```
 */
export function useClipboardImage(options: UseClipboardImageOptions) {
  const {
    sessionId,
    showToast = true,
    toastMessage = '截图已添加到输入',
    enabled = true,
    onPaste,
  } = options;

  const toastContainerRef = useRef<HTMLDivElement | null>(null);
  const lastPasteTime = useRef<number>(0);

  // Create multimodal node from pasted image
  const createNodeFromClipboard = useCallback(
    async (blob: Blob, fileName?: string): Promise<MultimodalNode | null> => {
      try {
        const nodeId = `img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

        // Process image (resize, compress, thumbnail)
        const processed = await processImage(blob);

        const node: MultimodalNode = {
          id: nodeId,
          type: 'image',
          imageData: processed.imageData,
          mimeType: processed.mimeType,
          fileName: fileName || `clipboard_${Date.now()}.png`,
          fileSize: processed.processedSize,
          thumbnailData: processed.thumbnailData,
          status: 'pending',
          createdAt: Date.now(),
          sessionId,
        };

        // Add to store
        useMultimodalStore.getState().addImageNode(node);

        // Trigger callback
        onPaste?.(node);

        return node;
      } catch (error) {
        console.error('[useClipboardImage] Failed to process clipboard image:', error);
        return null;
      }
    },
    [sessionId, onPaste]
  );

  // Show toast notification
  const showPasteToast = useCallback((message: string) => {
    if (!showToast) return;

    // Remove existing toast
    if (toastContainerRef.current) {
      document.body.removeChild(toastContainerRef.current);
    }

    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(30, 27, 75, 0.95);
      border: 1px solid rgba(99, 102, 241, 0.5);
      color: #e2e2ef;
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 13px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      z-index: 10000;
      animation: toastSlideIn 0.2s ease;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
      display: flex;
      align-items: center;
      gap: 8px;
    `;
    toast.innerHTML = `
      <span style="font-size: 16px;">🖼️</span>
      <span>${message}</span>
    `;

    // Add animation keyframes if not exists
    if (!document.getElementById('toast-animations')) {
      const style = document.createElement('style');
      style.id = 'toast-animations';
      style.textContent = `
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateX(-50%) translateY(10px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes toastSlideOut {
          from { opacity: 1; transform: translateX(-50%) translateY(0); }
          to { opacity: 0; transform: translateX(-50%) translateY(10px); }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(toast);
    toastContainerRef.current = toast;

    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.animation = 'toastSlideOut 0.2s ease forwards';
        setTimeout(() => {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
          if (toastContainerRef.current === toast) {
            toastContainerRef.current = null;
          }
        }, 200);
      }
    }, 3000);
  }, [showToast]);

  // Handle paste event
  const handlePaste = useCallback(
    async (event: ClipboardEvent) => {
      // Debounce: ignore paste events within 500ms
      const now = Date.now();
      if (now - lastPasteTime.current < 500) return;
      lastPasteTime.current = now;

      const items = event.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          event.preventDefault();
          event.stopPropagation();

          const blob = item.getAsFile();
          if (!blob) continue;

          const node = await createNodeFromClipboard(
            blob,
            `clipboard_${Date.now()}.png`
          );

          if (node) {
            showPasteToast(toastMessage);
          }

          return;
        }
      }
    },
    [createNodeFromClipboard, showPasteToast, toastMessage]
  );

  // Attach paste listener
  useEffect(() => {
    if (!enabled) return;

    const opts: AddEventListenerOptions = { passive: false };
    document.addEventListener('paste', handlePaste as unknown as EventListener, opts);

    return () => {
      document.removeEventListener('paste', handlePaste as unknown as EventListener, opts);
      // Cleanup toast
      if (toastContainerRef.current) {
        document.body.removeChild(toastContainerRef.current);
        toastContainerRef.current = null;
      }
    };
  }, [enabled, handlePaste]);

  return {
    createNodeFromClipboard,
    showPasteToast,
  };
}

/**
 * Simple hook to check if clipboard has an image
 * Useful for conditional UI (e.g., show paste hint)
 */
export function useClipboardHasImage(): boolean {
  // This can't be reliably detected without a paste event
  // Returns true as a hint to show paste capability
  return true;
}
