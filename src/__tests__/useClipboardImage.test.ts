import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// Mock dependencies before importing the hook
vi.mock('@/utils/imageProcessor', () => ({
  processImage: vi.fn().mockResolvedValue({
    imageData: 'data:image/png;base64,mock',
    mimeType: 'image/png',
    processedSize: 1024,
    thumbnailData: 'data:image/png;base64,thumb',
  }),
}));

const mockAddImageNode = vi.fn();
vi.mock('@/stores/useMultimodalStore', () => ({
  useMultimodalStore: {
    getState: () => ({ addImageNode: mockAddImageNode }),
  },
}));

import { useClipboardImage, useClipboardHasImage } from '@/hooks/useClipboardImage';

describe('useClipboardImage', () => {
  beforeEach(() => {
    mockAddImageNode.mockClear();
  });

  it('should export expected API', () => {
    const { result } = renderHook(() => useClipboardImage({
      sessionId: 'session_1',
    }));
    expect(result.current).toBeDefined();
    expect(typeof result.current.createNodeFromClipboard).toBe('function');
    expect(typeof result.current.showPasteToast).toBe('function');
  });

  it('should create node from clipboard blob', async () => {
    const { result } = renderHook(() => useClipboardImage({
      sessionId: 'session_1',
      showToast: false,
    }));

    const blob = new Blob(['test'], { type: 'image/png' });
    const node = await result.current.createNodeFromClipboard(blob, 'test.png');

    expect(node).not.toBeNull();
    expect(node?.type).toBe('image');
    expect(node?.sessionId).toBe('session_1');
  });

  it('should return null on process error', async () => {
    const { processImage } = await import('@/utils/imageProcessor');
    (processImage as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('process failed'));

    const { result } = renderHook(() => useClipboardImage({
      sessionId: 'session_1',
      showToast: false,
    }));

    const blob = new Blob(['test'], { type: 'image/png' });
    const node = await result.current.createNodeFromClipboard(blob, 'fail.png');
    expect(node).toBeNull();
  });

  it('should call onPaste callback', async () => {
    const onPaste = vi.fn();
    const { result } = renderHook(() => useClipboardImage({
      sessionId: 'session_1',
      showToast: false,
      onPaste,
    }));

    const blob = new Blob(['test'], { type: 'image/png' });
    await result.current.createNodeFromClipboard(blob, 'callback_test.png');
    expect(onPaste).toHaveBeenCalled();
  });

  it('should call addImageNode on store', async () => {
    const { result } = renderHook(() => useClipboardImage({
      sessionId: 'session_1',
      showToast: false,
    }));

    const blob = new Blob(['test'], { type: 'image/png' });
    await result.current.createNodeFromClipboard(blob, 'store_test.png');
    expect(mockAddImageNode).toHaveBeenCalled();
  });

  it('should return true from useClipboardHasImage', () => {
    const { result } = renderHook(() => useClipboardHasImage());
    expect(result.current).toBe(true);
  });
});
