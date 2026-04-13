/**
 * V1.4.1 - Text File Reader Utility
 * Reads text files using FileReader API
 */

import type { PendingAttachment } from '../types/attachment';

/**
 * Read text file content
 */
export function readTextFile(file: File): Promise<{ content: string; preview: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const content = e.target?.result as string;
      // Generate preview (first 200 characters)
      const preview = content.slice(0, 200).trim();
      resolve({ content, preview });
    };

    reader.onerror = () => {
      reject(new Error(`Failed to read file: ${file.name}`));
    };

    reader.readAsText(file);
  });
}

/**
 * Check if MIME type is a text type
 */
export function isTextMimeType(mimeType: string): boolean {
  const textTypes = [
    'text/plain',
    'text/markdown',
    'text/md',
    'application/json',
    'application/ld+json',
    'text/x-log',
    'text/css',
    'text/html',
    'text/javascript',
    'text/typescript',
    'text/xml',
    'text/csv',
  ];
  return textTypes.some((t) => mimeType.includes(t) || mimeType === t);
}

/**
 * Detect MIME type from file name
 */
export function detectMimeType(fileName: string, fallbackMimeType: string): string {
  // If we already have a valid MIME type, use it
  if (fallbackMimeType && !fallbackMimeType.includes('octet')) {
    return fallbackMimeType;
  }

  // Detect from extension
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const mimeMap: Record<string, string> = {
    // Text
    txt: 'text/plain',
    md: 'text/markdown',
    markdown: 'text/markdown',
    json: 'application/json',
    log: 'text/x-log',
    // Code
    js: 'text/javascript',
    ts: 'text/typescript',
    jsx: 'text/javascript',
    tsx: 'text/typescript',
    css: 'text/css',
    html: 'text/html',
    xml: 'text/xml',
    // Data
    csv: 'text/csv',
    yaml: 'text/yaml',
    yml: 'text/yaml',
    toml: 'text/toml',
  };

  return mimeMap[ext] || 'text/plain';
}

/**
 * Generate a unique attachment ID
 */
export function generateAttachmentId(): string {
  return `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Create a pending attachment from a file
 */
export async function createPendingAttachmentFromFile(
  file: File,
  processImage: (file: File) => Promise<{
    imageData: string;
    thumbnailData: string;
    mimeType: string;
    processedSize: number;
  }>
): Promise<PendingAttachment> {
  const id = generateAttachmentId();
  const mimeType = detectMimeType(file.name, file.type);

  // Check if it's an image
  if (mimeType.startsWith('image/')) {
    const processed = await processImage(file);
    return {
      id,
      type: 'image',
      mimeType: processed.mimeType,
      fileName: file.name,
      fileSize: processed.processedSize,
      thumbnailData: processed.thumbnailData,
      imageData: processed.imageData,
      status: 'ready',
      createdAt: Date.now(),
    };
  }

  // It's a text file
  const { content, preview } = await readTextFile(file);
  return {
    id,
    type: 'text',
    mimeType,
    fileName: file.name,
    fileSize: file.size,
    textContent: content,
    textPreview: preview,
    status: 'ready',
    createdAt: Date.now(),
  };
}
