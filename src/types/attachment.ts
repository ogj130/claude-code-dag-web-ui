/**
 * V1.4.1 - Attachment Types
 * Types for pending attachments and sent attachments
 */

/**
 * Attachment type enum
 */
export type AttachmentType = 'image' | 'text';

/**
 * Supported image MIME types
 */
export const IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
] as const;

/**
 * Supported text MIME types
 */
export const TEXT_MIME_TYPES = [
  'text/plain',
  'text/markdown',
  'application/json',
  'text/x-log',
] as const;

/**
 * All supported MIME types
 */
export const SUPPORTED_MIME_TYPES = [
  ...IMAGE_MIME_TYPES,
  ...TEXT_MIME_TYPES,
] as const;

export type SupportedMimeType = typeof SUPPORTED_MIME_TYPES[number];

/**
 * Get file extension from MIME type
 */
export function getExtensionFromMimeType(mimeType: string): string {
  const map: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'text/plain': '.txt',
    'text/markdown': '.md',
    'application/json': '.json',
    'text/x-log': '.log',
  };
  return map[mimeType] || '';
}

/**
 * Get MIME type from file extension
 */
export function getMimeTypeFromExtension(ext: string): string | null {
  const map: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.json': 'application/json',
    '.log': 'text/x-log',
  };
  return map[ext.toLowerCase()] || null;
}

/**
 * Detect attachment type from MIME type
 */
export function getAttachmentType(mimeType: string): AttachmentType {
  if (IMAGE_MIME_TYPES.includes(mimeType as typeof IMAGE_MIME_TYPES[number])) {
    return 'image';
  }
  return 'text';
}

/**
 * Pending attachment (not yet sent)
 */
export interface PendingAttachment {
  id: string;
  type: AttachmentType;
  mimeType: string;
  fileName: string;
  fileSize: number;

  // Image specific
  thumbnailData?: string;
  imageData?: string; // Base64 full image

  // Text specific
  textContent?: string;
  textPreview?: string; // First 200 chars

  // V1.4.1: Raw binary data for doc/xlsx/pptx parsing (base64 encoded ArrayBuffer)
  rawData?: string;

  // Metadata (optional for stored/deserialized attachments)
  status?: 'pending' | 'processing' | 'ready' | 'error';
  error?: string;
  createdAt?: number;
}

/**
 * Sent attachment (included in a query)
 */
export interface SentAttachment {
  id: string;
  queryId: string;
  type: AttachmentType;
  mimeType: string;
  fileName: string;
  fileSize: number;

  // Image specific
  thumbnailData?: string;
  imageData?: string;

  // Text specific
  textContent?: string;
  textPreview?: string;

  // Display
  position: { x: number; y: number };
}

/**
 * Attachment preview mode
 */
export type AttachmentPreviewMode = 'thumbnail' | 'list' | 'expanded';

/**
 * Attachment validation result
 */
export interface AttachmentValidation {
  valid: boolean;
  error?: string;
  suggestedMimeType?: string;
}

/**
 * Validate attachment file
 */
export function validateAttachmentFile(file: File): AttachmentValidation {
  // Check size (10MB max)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `文件大小超过限制 (最大 10MB，当前 ${(file.size / 1024 / 1024).toFixed(1)}MB)`,
    };
  }

  // Check type
  const mimeType = file.type || getMimeTypeFromExtension(file.name.split('.').pop() || '') || 'text/plain';
  if (!SUPPORTED_MIME_TYPES.includes(mimeType as SupportedMimeType)) {
    return {
      valid: false,
      error: `不支持的文件类型: ${mimeType}`,
      suggestedMimeType: mimeType,
    };
  }

  return { valid: true };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Get icon emoji for file type
 */
export function getFileIcon(type: AttachmentType, mimeType: string): string {
  if (type === 'image') return '🖼';
  if (mimeType === 'text/markdown') return '📄';
  if (mimeType === 'application/json') return '📋';
  return '📜';
}

/**
 * Get color for file type badge
 */
export function getFileTypeColor(type: AttachmentType): string {
  if (type === 'image') return '#EC4899';
  return '#8B5CF6';
}
