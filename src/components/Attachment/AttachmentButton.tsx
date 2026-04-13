/**
 * V1.4.1 - AttachmentButton Component
 * File attachment button for multimodal input
 *
 * Placed in the input area near the text input field
 */

import React, { useRef } from 'react';

interface AttachmentButtonProps {
  /** Callback when files are selected */
  onFilesSelected: (files: FileList | null) => void;
  /** Whether the button is disabled */
  disabled?: boolean;
}

export function AttachmentButton({ onFilesSelected, disabled }: AttachmentButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilesSelected(e.target.files);
    e.target.value = ''; // Reset to allow selecting same file again
  };

  return (
    <>
      <button
        onClick={handleClick}
        disabled={disabled}
        className="attachment-input-btn"
        title="添加附件 (Ctrl+U)"
        aria-label="添加附件"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
        </svg>
      </button>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,.txt,.md,.markdown,.json,.log"
        multiple
        style={{ display: 'none' }}
        onChange={handleChange}
      />

      <style>{`
        .attachment-input-btn {
          width: 32px;
          height: 32px;
          border-radius: 6px;
          border: none;
          background: transparent;
          color: var(--text-muted, #6b6b7e);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
          flex-shrink: 0;
        }

        .attachment-input-btn:hover:not(:disabled) {
          color: var(--attachment-primary, #6366F1);
          background: rgba(99, 102, 241, 0.1);
        }

        .attachment-input-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </>
  );
}
