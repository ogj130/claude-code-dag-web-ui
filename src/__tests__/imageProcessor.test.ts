/**
 * V1.4.0 - Image Processor Tests
 */

import { describe, it, expect } from 'vitest';
import {
  validateImageFile,
  isSupportedImageType,
  type ProcessedImage,
} from '../utils/imageProcessor';
import type { SupportedImageType } from '../types/multimodal';

describe('Image Validation', () => {
  describe('isSupportedImageType', () => {
    it('should accept valid image types', () => {
      expect(isSupportedImageType('image/png')).toBe(true);
      expect(isSupportedImageType('image/jpeg')).toBe(true);
      expect(isSupportedImageType('image/webp')).toBe(true);
    });

    it('should reject invalid image types', () => {
      expect(isSupportedImageType('image/gif')).toBe(false);
      expect(isSupportedImageType('image/svg+xml')).toBe(false);
      expect(isSupportedImageType('application/pdf')).toBe(false);
      expect(isSupportedImageType('text/plain')).toBe(false);
    });
  });

  describe('validateImageFile', () => {
    it('should reject non-image files', () => {
      const file = new File(['hello'], 'test.txt', { type: 'text/plain' });
      const result = validateImageFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Not an image');
    });

    it('should reject unsupported image formats', () => {
      const file = new File([''], 'test.gif', { type: 'image/gif' });
      const result = validateImageFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unsupported format');
    });

    it('should accept valid PNG files under limit', () => {
      const content = new Array(1024).fill(0).join('');
      const file = new File([content], 'test.png', { type: 'image/png' });
      const result = validateImageFile(file);
      expect(result.valid).toBe(true);
    });

    it('should reject files over 10MB', () => {
      // Create a mock file with size > 10MB
      const largeContent = new Uint8Array(11 * 1024 * 1024);
      const file = new File([largeContent], 'test.png', { type: 'image/png' });
      const result = validateImageFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too large');
    });
  });
});

describe('SupportedImageType', () => {
  it('should have correct supported types', () => {
    const types: SupportedImageType[] = ['image/png', 'image/jpeg', 'image/webp'];
    types.forEach(type => {
      expect(isSupportedImageType(type)).toBe(true);
    });
  });
});
