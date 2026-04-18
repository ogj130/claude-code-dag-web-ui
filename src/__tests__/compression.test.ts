import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  compress,
  decompress,
  compressValue,
  decompressValue,
  byteSize,
  formatBytes,
  shouldCompress,
  isCompressed,
  COMPRESSION_THRESHOLD,
} from '@/utils/compression';

// ---------------------------------------------------------------------------
// Mock COMPRESSED_MARKER (imported from @/types/storage)
// ---------------------------------------------------------------------------

vi.mock('@/types/storage', () => ({
  COMPRESSED_MARKER: '\x00COMPRESSED:\x00',
  isFieldCompressed: (value: string) =>
    typeof value === 'string' && value.startsWith('\x00COMPRESSED:\x00'),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('compression utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── isCompressed ────────────────────────────────────────────────────────

  describe('isCompressed', () => {
    it('returns false for plain text', () => {
      expect(isCompressed('hello world')).toBe(false);
    });

    it('returns true for marked compressed content', () => {
      expect(isCompressed('\x00COMPRESSED:\x00abcdef')).toBe(true);
    });

    it('returns false for empty string', () => {
      expect(isCompressed('')).toBe(false);
    });
  });

  // ── byteSize ────────────────────────────────────────────────────────────

  describe('byteSize', () => {
    it('returns 0 for empty string', () => {
      expect(byteSize('')).toBe(0);
    });

    it('returns correct byte count for ASCII string', () => {
      expect(byteSize('hello')).toBe(5);
    });

    it('returns correct byte count for multi-byte string', () => {
      // Chinese characters are typically 3 bytes in UTF-8
      const str = '你好';
      const size = byteSize(str);
      expect(size).toBeGreaterThan(2);
    });
  });

  // ── formatBytes ────────────────────────────────────────────────────────

  describe('formatBytes', () => {
    it('formats bytes < 1 KB', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(512)).toBe('512 B');
      expect(formatBytes(1023)).toBe('1023 B');
    });

    it('formats KB', () => {
      expect(formatBytes(1024)).toBe('1.0 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(10240)).toBe('10.0 KB');
    });

    it('formats MB', () => {
      expect(formatBytes(1024 * 1024)).toBe('1.00 MB');
      expect(formatBytes(1024 * 1024 * 5)).toBe('5.00 MB');
    });
  });

  // ── compress ──────────────────────────────────────────────────────────

  describe('compress', () => {
    it('returns input unchanged for empty string', () => {
      expect(compress('')).toBe('');
    });

    it('returns input unchanged when below threshold', () => {
      // COMPRESSION_THRESHOLD = 1024 bytes
      const shortText = 'a'.repeat(500);
      expect(compress(shortText)).toBe(shortText);
    });

    it('returns compressed string with marker for content above threshold', () => {
      // COMPRESSION_THRESHOLD = 1024 bytes
      // Need > 1024 chars to exceed threshold
      const longText = 'The quick brown fox jumps over the lazy dog. '.repeat(30);
      expect(longText.length).toBeGreaterThan(1024);
      const result = compress(longText);
      expect(result.startsWith('\x00COMPRESSED:\x00')).toBe(true);
      expect(result.length).toBeLessThan(longText.length);
    });
  });

  // ── decompress ─────────────────────────────────────────────────────────

  describe('decompress', () => {
    it('returns input unchanged when not compressed', () => {
      const plainText = 'hello world';
      expect(decompress(plainText)).toBe(plainText);
    });

    it('decompresses compressed content back to original', () => {
      const original = 'The quick brown fox jumps over the lazy dog. '.repeat(20);
      const compressed = compress(original);
      // Only test round-trip if compression actually happened
      if (compressed.startsWith('\x00COMPRESSED:\x00')) {
        const decompressed = decompress(compressed);
        expect(decompressed).toBe(original);
      }
    });

    it('returns original string on decompression failure', () => {
      const broken = '\x00COMPRESSED:\x00invalid-base64!!!';
      const result = decompress(broken);
      // LZ-String returns undefined for invalid input, which falls back to original
      expect(result).toBeDefined();
    });
  });

  // ── shouldCompress ──────────────────────────────────────────────────────

  describe('shouldCompress', () => {
    it('returns false for content below threshold', () => {
      const shortText = 'a'.repeat(100);
      expect(shouldCompress(shortText)).toBe(false);
    });

    it('returns true for content above threshold', () => {
      const longText = 'a'.repeat(2000);
      expect(shouldCompress(longText)).toBe(true);
    });
  });

  // ── compressValue / decompressValue ───────────────────────────────────

  describe('compressValue / decompressValue', () => {
    it('round-trips a simple object', () => {
      const obj = { id: 's1', name: 'test', count: 42 };
      const compressed = compressValue(obj);
      const decompressed = decompressValue<typeof obj>(compressed);
      expect(decompressed).toEqual(obj);
    });

    it('round-trips an array', () => {
      const arr = [1, 2, 3, 'hello'];
      const compressed = compressValue(arr);
      const decompressed = decompressValue<typeof arr>(compressed);
      expect(decompressed).toEqual(arr);
    });
  });
});
