/**
 * LZ-String compression utilities for automatic text content compression.
 *
 * Compression strategy:
 * - Text content exceeding 1KB is automatically compressed before storage
 * - Compressed content is prefixed with COMPRESSED_MARKER to enable auto-detection on read
 * - Uses LZ-String encodeBase64 for efficient browser storage
 */

import LZString from 'lz-string';
import { COMPRESSED_MARKER, isFieldCompressed } from '@/types/storage';

/** Marker prefix used to identify compressed content in storage */
const COMPRESSED_PREFIX = COMPRESSED_MARKER;

/** Threshold in bytes above which content is compressed */
export const COMPRESSION_THRESHOLD = 1024; // 1 KB

/**
 * Check if a string is already in compressed format.
 */
export function isCompressed(value: string): boolean {
  return isFieldCompressed(value);
}

/**
 * Compress a string using LZ-String.
 * Returns the original string if compression would not reduce size.
 */
export function compress(input: string): string {
  if (!input || input.length === 0) return input;

  const originalSize = new Blob([input]).size;
  if (originalSize < COMPRESSION_THRESHOLD) return input;

  const compressed = LZString.compressToBase64(input);

  // Only store compressed version if it actually saves space
  if (compressed.length >= input.length) return input;

  return `${COMPRESSED_PREFIX}${compressed}`;
}

/**
 * Decompress a string that may have been compressed.
 * Returns the original string if it was not compressed.
 */
export function decompress(value: string): string {
  if (!isCompressed(value)) return value;

  const compressed = value.slice(COMPRESSED_PREFIX.length);
  const decompressed = LZString.decompressFromBase64(compressed);

  return decompressed ?? value;
}

/**
 * Compress a JavaScript value (object or primitive) to a JSON string,
 * then optionally compress if above threshold.
 * Returns a string suitable for IndexedDB storage.
 */
export function compressValue<T>(value: T): string {
  const json = JSON.stringify(value);
  return compress(json);
}

/**
 * Decompress a stored string back to a JavaScript value.
 * Handles both compressed and uncompressed content.
 */
export function decompressValue<T>(stored: string): T {
  const json = decompress(stored);
  return JSON.parse(json) as T;
}

/**
 * Get the byte size of a string.
 */
export function byteSize(str: string): number {
  return new Blob([str]).size;
}

/**
 * Format byte size to human readable string.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Check if content should be compressed based on byte size threshold.
 */
export function shouldCompress(content: string): boolean {
  return byteSize(content) >= COMPRESSION_THRESHOLD;
}
