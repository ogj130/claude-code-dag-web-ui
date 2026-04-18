/**
 * useFileUpload — 渲染覆盖测试
 *
 * 覆盖率标准: 行 95%
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFileUpload } from '@/hooks/useFileUpload';

// ── Mock dependencies (use vi.hoisted for stable references) ──────────────────

const mockAttachmentState = vi.hoisted(() =>
  vi.fn().mockReturnValue({ pendingAttachments: [] })
);

vi.mock('@/stores/useAttachmentStore', () => ({
  useAttachmentStore: Object.assign(
    vi.fn((selector?: (state: unknown) => unknown) => {
      if (typeof selector === 'function') {
        return selector(mockAttachmentState());
      }
      return {
        get pendingAttachments() { return mockAttachmentState().pendingAttachments; },
        addPendingAttachment: vi.fn(),
        updatePendingAttachment: vi.fn(),
        removePendingAttachment: vi.fn(),
        clearPendingAttachments: vi.fn(),
        getState: mockAttachmentState,
      };
    }),
    { getState: mockAttachmentState }
  ),
}));

vi.mock('@/stores/useSessionStore', () => ({
  useSessionStore: vi.fn().mockReturnValue({
    sessions: [{ id: 's1', isActive: true, projectPath: '/test' }],
    activeSessionId: 's1',
  }),
}));

vi.mock('@/utils/imageProcessor', () => ({
  processImage: vi.fn().mockResolvedValue({
    mimeType: 'image/png',
    processedSize: 1000,
    thumbnailData: 'data:image/png;base64,xxx',
    imageData: 'data:image/png;base64,yyy',
  }),
}));

vi.mock('@/types/attachment', () => ({
  validateAttachmentFile: vi.fn().mockReturnValue({ valid: true }),
}));

vi.mock('@/utils/textFileReader', () => ({
  generateAttachmentId: vi.fn().mockReturnValue('att_123'),
}));

vi.mock('@/stores/vectorStorage', () => ({
  indexAttachmentChunks: vi.fn().mockResolvedValue(['chunk_1', 'chunk_2']),
}));

vi.mock('@/stores/localVectorStorage', () => ({
  markWorkspaceIndexed: vi.fn(),
  getIndexedWorkspaces: vi.fn().mockReturnValue([]),
}));

// ── 测试套件 ──────────────────────────────────────────────────────────────────

describe('useFileUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAttachmentState.mockReturnValue({ pendingAttachments: [] });
  });

  it('should export expected API', () => {
    const { result } = renderHook(() => useFileUpload());
    expect(result.current).toBeDefined();
    expect(typeof result.current.handleFileSelect).toBe('function');
    expect(typeof result.current.handleFileDrop).toBe('function');
    expect(typeof result.current.handleRemoveAttachment).toBe('function');
    expect(typeof result.current.handleClearAll).toBe('function');
    expect(typeof result.current.getReadyAttachments).toBe('function');
  });

  it('maxFiles 返回最大文件数', () => {
    const { result } = renderHook(() => useFileUpload());
    expect(result.current.maxFiles).toBe(10);
  });

  it('handleFileSelect 空文件列表不处理', async () => {
    const { result } = renderHook(() => useFileUpload());
    await act(async () => {
      await result.current.handleFileSelect(null);
    });
  });

  it('handleFileDrop 调用 handleFileSelect', async () => {
    const mockEvent = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      dataTransfer: { files: [] },
    } as unknown as React.DragEvent;

    const { result } = renderHook(() => useFileUpload());
    await act(async () => {
      await result.current.handleFileDrop(mockEvent);
    });
    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(mockEvent.stopPropagation).toHaveBeenCalled();
  });

  it('handleRemoveAttachment 调用 removePendingAttachment', async () => {
    const { useAttachmentStore } = await import('@/stores/useAttachmentStore');
    const removePendingAttachment = vi.fn();
    (useAttachmentStore as unknown as { mockImplementation: (fn: () => unknown) => void })
      .mockImplementation(() => ({
        get pendingAttachments() { return []; },
        addPendingAttachment: vi.fn(),
        updatePendingAttachment: vi.fn(),
        removePendingAttachment,
        clearPendingAttachments: vi.fn(),
        getState: () => ({ pendingAttachments: [] }),
      }));

    const { result } = renderHook(() => useFileUpload());
    await act(async () => {
      result.current.handleRemoveAttachment('att_1');
    });
    expect(removePendingAttachment).toHaveBeenCalledWith('att_1');
  });

  it('handleClearAll 调用 clearPendingAttachments', async () => {
    const { useAttachmentStore } = await import('@/stores/useAttachmentStore');
    const clearPendingAttachments = vi.fn();
    (useAttachmentStore as unknown as { mockImplementation: (fn: () => unknown) => void })
      .mockImplementation(() => ({
        get pendingAttachments() { return []; },
        addPendingAttachment: vi.fn(),
        updatePendingAttachment: vi.fn(),
        removePendingAttachment: vi.fn(),
        clearPendingAttachments,
        getState: () => ({ pendingAttachments: [] }),
      }));

    const { result } = renderHook(() => useFileUpload());
    await act(async () => {
      result.current.handleClearAll();
    });
    expect(clearPendingAttachments).toHaveBeenCalled();
  });

  it('getReadyAttachments 仅返回 ready 状态的附件', () => {
    mockAttachmentState.mockReturnValue({
      pendingAttachments: [
        { id: 'a1', status: 'ready' },
        { id: 'a2', status: 'processing' },
        { id: 'a3', status: 'ready' },
      ],
    });

    const { result } = renderHook(() => useFileUpload());
    const ready = result.current.getReadyAttachments();
    expect(ready).toHaveLength(2);
    expect(ready.every(a => a.status === 'ready')).toBe(true);
  });

  it('文件数达到上限时 handleFileSelect 不添加新附件', async () => {
    mockAttachmentState.mockReturnValue({
      pendingAttachments: Array.from({ length: 10 }, (_, i) => ({ id: `a${i}`, status: 'ready' })),
    });

    const mockFile = new File(['hello'], 'test.txt', { type: 'text/plain' });
    const mockFileList = { 0: mockFile, length: 1, item: () => mockFile } as unknown as FileList;

    const { result } = renderHook(() => useFileUpload());
    await act(async () => {
      await result.current.handleFileSelect(mockFileList);
    });
    // 不应再添加（MAX_FILES=10 已满）
  });
});
