/**
 * V1.4.0 - AttachmentButton Component
 * File attachment button for multimodal image input
 *
 * Opens a file picker for images (PNG, JPG, WebP)
 * and creates MultimodalNode in the store
 */

import React, { useRef, useCallback } from 'react';
import { processImage, validateImageFile } from '../../utils/imageProcessor';
import { useMultimodalStore } from '../../stores/useMultimodalStore';
import type { MultimodalNode } from '../../types/multimodal';

interface AttachmentButtonProps {
  /** Session ID for associating nodes */
  sessionId: string;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Callback when image is attached */
  onAttach?: (node: MultimodalNode) => void;
}

export function AttachmentButton({ sessionId, disabled, onAttach }: AttachmentButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addImageNode = useMultimodalStore((s) => s.addImageNode);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      // Reset input so same file can be selected again
      e.target.value = '';

      for (const file of Array.from(files).slice(0, 5)) {
        // Limit to 5 files at once
        const validation = validateImageFile(file);
        if (!validation.valid) {
          console.warn('[AttachmentButton] Invalid file:', validation.error);
          continue;
        }

        try {
          const nodeId = `img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

          // Process image (resize, compress, thumbnail)
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

          addImageNode(node);
          onAttach?.(node);
        } catch (error) {
          console.error('[AttachmentButton] Failed to process image:', error);
        }
      }
    },
    [sessionId, addImageNode, onAttach]
  );

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <>
      <button
        onClick={handleClick}
        disabled={disabled}
        title="Attach image (PNG, JPG, WebP)"
        style={{
          background: 'transparent',
          color: disabled ? 'var(--text-dim)' : 'var(--text-muted)',
          border: '1px solid var(--border)',
          padding: '6px 10px',
          borderRadius: 6,
          fontSize: 12,
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          opacity: disabled ? 0.5 : 1,
        }}
        onMouseEnter={(e) => {
          if (!disabled) {
            e.currentTarget.style.background = 'var(--bg-hover, rgba(255,255,255,0.05))';
            e.currentTarget.style.color = 'var(--accent, #6366f1)';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = disabled ? 'var(--text-dim)' : 'var(--text-muted)';
        }}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
        </svg>
        附件
      </button>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
    </>
  );
}
