/**
 * V1.4.0 - useImageDrop Hook
 * Drag & drop image upload for DAG canvas
 *
 * Supports:
 * - Drop images directly onto DAG canvas
 * - Visual feedback during drag (overlay)
 * - Multiple file drop
 * - Creates MultimodalNode for each dropped image
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { processImage, validateImageFile } from '../utils/imageProcessor';
import { useMultimodalStore } from '../stores/useMultimodalStore';
import type { MultimodalNode } from '../types/multimodal';

export interface UseImageDropOptions {
  /** Session ID for associating nodes */
  sessionId: string;
  /** CSS selector or element for drop zone */
  dropZoneRef: React.RefObject<HTMLElement>;
  /** Whether drag is enabled */
  enabled?: boolean;
  /** Maximum number of files per drop */
  maxFiles?: number;
  /** Callback when files are dropped */
  onDrop?: (nodes: MultimodalNode[]) => void;
}

/**
 * Hook for drag & drop image upload
 *
 * Usage:
 * ```tsx
 * const dropZoneRef = useRef<HTMLDivElement>(null);
 * const { isDragging, processDroppedFiles } = useImageDrop({
 *   sessionId,
 *   dropZoneRef,
 *   onDrop: (nodes) => console.log('Dropped:', nodes),
 * });
 * ```
 */
export function useImageDrop(options: UseImageDropOptions) {
  const {
    sessionId,
    dropZoneRef,
    enabled = true,
    maxFiles = 5,
    onDrop,
  } = options;

  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragCountRef = useRef(0);
  const dropZoneRefCurrent = useRef<HTMLElement | null>(null);

  // Sync ref
  useEffect(() => {
    dropZoneRefCurrent.current = dropZoneRef.current;
  });

  // Create multimodal node from file
  const createNodeFromFile = useCallback(
    async (file: File): Promise<MultimodalNode | null> => {
      try {
        // Validate
        const validation = validateImageFile(file);
        if (!validation.valid) {
          setError(validation.error || 'Invalid file');
          return null;
        }

        const nodeId = `img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

        // Process image
        const processed = await processImage(file);

        const node: MultimodalNode = {
          id: nodeId,
          type: 'image',
          imageData: processed.imageData,
          mimeType: processed.mimeType,
          fileName: file.name,
          fileSize: processed.processedSize,
          thumbnailData: processed.thumbnailData,
          status: 'pending',
          createdAt: Date.now(),
          sessionId,
        };

        // Add to store
        useMultimodalStore.getState().addImageNode(node);

        return node;
      } catch (err) {
        console.error('[useImageDrop] Failed to process dropped file:', err);
        setError('Failed to process image');
        return null;
      }
    },
    [sessionId]
  );

  // Process dropped files
  const processDroppedFiles = useCallback(
    async (files: FileList | File[]): Promise<MultimodalNode[]> => {
      setError(null);
      const fileArray = Array.from(files).slice(0, maxFiles);
      const nodes: MultimodalNode[] = [];

      for (const file of fileArray) {
        const node = await createNodeFromFile(file);
        if (node) {
          nodes.push(node);
        }
      }

      if (nodes.length > 0) {
        onDrop?.(nodes);
      }

      return nodes;
    },
    [createNodeFromFile, maxFiles, onDrop]
  );

  // Drag enter handler
  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    dragCountRef.current++;
    if (dragCountRef.current === 1) {
      setIsDragging(true);
    }
  }, []);

  // Drag leave handler
  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    dragCountRef.current--;
    if (dragCountRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  // Drag over handler (required for drop to work)
  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  // Drop handler
  const handleDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      dragCountRef.current = 0;
      setIsDragging(false);

      if (!enabled) return;

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      await processDroppedFiles(files);
    },
    [enabled, processDroppedFiles]
  );

  // Attach listeners to drop zone
  useEffect(() => {
    const zone = dropZoneRefCurrent.current;
    if (!zone || !enabled) return;

    zone.addEventListener('dragenter', handleDragEnter as unknown as EventListener);
    zone.addEventListener('dragleave', handleDragLeave as unknown as EventListener);
    zone.addEventListener('dragover', handleDragOver as unknown as EventListener);
    zone.addEventListener('drop', handleDrop as unknown as EventListener);

    return () => {
      zone.removeEventListener('dragenter', handleDragEnter as unknown as EventListener);
      zone.removeEventListener('dragleave', handleDragLeave as unknown as EventListener);
      zone.removeEventListener('dragover', handleDragOver as unknown as EventListener);
      zone.removeEventListener('drop', handleDrop as unknown as EventListener);
    };
  }, [enabled, handleDragEnter, handleDragLeave, handleDragOver, handleDrop]);

  // Clear error after 5 seconds
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(timer);
  }, [error]);

  return {
    isDragging,
    error,
    processDroppedFiles,
  };
}

/**
 * Drop overlay component for visual feedback
 */
export function DropOverlay({ message = 'Drop images here' }: { message?: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(99, 102, 241, 0.15)',
        border: '2px dashed rgba(99, 102, 241, 0.6)',
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          background: 'rgba(30, 27, 75, 0.95)',
          border: '1px solid rgba(99, 102, 241, 0.5)',
          borderRadius: 12,
          padding: '24px 40px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 8 }}>🖼️</div>
        <div
          style={{
            color: '#e2e2ef',
            fontSize: 14,
            fontWeight: 500,
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          }}
        >
          {message}
        </div>
        <div
          style={{
            color: '#8b8b9e',
            fontSize: 12,
            marginTop: 4,
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          }}
        >
          PNG, JPG, WebP • Max 4MB
        </div>
      </div>
    </div>
  );
}
