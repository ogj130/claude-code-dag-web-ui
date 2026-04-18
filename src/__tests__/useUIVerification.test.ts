import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { useUIVerification } from '@/hooks/useUIVerification';

// Mock imageProcessor
vi.mock('@/utils/imageProcessor', () => ({
  analyzeImageLayout: vi.fn().mockResolvedValue({
    aspectRatio: 1.33,
    dominantColors: ['#1e1e2e'],
    gridDistribution: [1, 1, 1],
  }),
  calculateImageSimilarity: vi.fn().mockResolvedValue(85),
}));

// Mock useMultimodalStore
// Must return a Zustand-like store with getState() method
vi.mock('@/stores/useMultimodalStore', () => {
  const mockUpdateImageNode = vi.fn();
  const mockCodeBlockNodes = new Map();

  const store = {
    addCodeBlockNode: vi.fn(),
    updateCodeBlockNode: vi.fn(),
    addVerificationNode: vi.fn(),
    updateVerificationNode: vi.fn(),
    imageNodes: new Map(),
    codeBlockNodes: mockCodeBlockNodes,
    updateImageNode: mockUpdateImageNode,
    getState: () => ({
      codeBlockNodes: mockCodeBlockNodes,
      updateImageNode: mockUpdateImageNode,
    }),
  };

  return {
    useMultimodalStore: vi.fn(() => store),
  };
});

describe('useUIVerification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns hook API surface', () => {
    const { result } = renderHook(() =>
      useUIVerification({ sessionId: 'test-session' })
    );
    expect(result.current).toHaveProperty('generateCode');
    expect(result.current).toHaveProperty('captureAndCompare');
    expect(result.current).toHaveProperty('runFullVerification');
    expect(result.current).toHaveProperty('isVerifying');
    expect(result.current).toHaveProperty('progress');
    expect(result.current).toHaveProperty('status');
  });

  it('initializes with pending status', () => {
    const { result } = renderHook(() =>
      useUIVerification({ sessionId: 'test-session' })
    );
    expect(result.current.status).toBe('pending');
    expect(result.current.isVerifying).toBe(false);
  });

  it('generateCode returns null when image node not found', async () => {
    const { result } = renderHook(() =>
      useUIVerification({ sessionId: 'test-session' })
    );
    const node = await act(async () => {
      return result.current.generateCode('non-existent-id');
    });
    expect(node).toBeNull();
  });

  it('onError callback is called when image node not found', async () => {
    const onError = vi.fn();
    const { result } = renderHook(() =>
      useUIVerification({ sessionId: 'test-session', onError })
    );

    await act(async () => {
      await result.current.generateCode('non-existent-id');
    });

    expect(onError).toHaveBeenCalledWith('Image node not found');
  });

  it('progress starts at 0', () => {
    const { result } = renderHook(() =>
      useUIVerification({ sessionId: 'test-session' })
    );
    expect(result.current.progress).toBe(0);
  });
});
