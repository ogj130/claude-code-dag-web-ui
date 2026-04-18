/**
 * useWorkspaceModelConfig — 渲染覆盖测试
 *
 * 覆盖率标准: 行 95%
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

// ── Mock electron IPC ─────────────────────────────────────────────────────────
const mockInvoke = vi.fn();

vi.stubGlobal('electron', {
  invoke: mockInvoke,
});

// ── Import actual hook (no self-mock) ────────────────────────────────────────
import { useWorkspaceModelConfig } from '@/hooks/useWorkspaceModelConfig';

// ── 测试套件 ──────────────────────────────────────────────────────────────────

describe('useWorkspaceModelConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('workspacePath 为 null 时 preset 和 config 为 null', async () => {
    const { result } = renderHook(() => useWorkspaceModelConfig(null));
    await waitFor(() => {
      expect(result.current.preset).toBeNull();
      expect(result.current.config).toBeNull();
    });
  });

  it('加载预设和配置', async () => {
    const mockPreset = { id: 'preset_1', configId: 'cfg_1', isEnabled: true };
    const mockConfig = { id: 'cfg_1', name: 'test', model: 'gpt-4' };

    mockInvoke
      .mockResolvedValueOnce(mockPreset)   // workspace-preset:get-by-path
      .mockResolvedValueOnce([mockConfig]); // model-config:get-all

    const { result } = renderHook(() => useWorkspaceModelConfig('/test/path'));
    await waitFor(() => {
      expect(result.current.preset).toEqual(mockPreset);
      expect(result.current.config).toEqual(mockConfig);
    });
  });

  it('预设未启用时 preset 和 config 为 null', async () => {
    mockInvoke.mockResolvedValueOnce({ isEnabled: false });

    const { result } = renderHook(() => useWorkspaceModelConfig('/test/path'));
    await waitFor(() => {
      expect(result.current.preset).toBeNull();
      expect(result.current.config).toBeNull();
    });
  });

  it('预设不存在时 preset 和 config 为 null', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useWorkspaceModelConfig('/test/path'));
    await waitFor(() => {
      expect(result.current.preset).toBeNull();
      expect(result.current.config).toBeNull();
    });
  });

  it('configId 为空时 preset 和 config 为 null', async () => {
    mockInvoke.mockResolvedValueOnce({ id: 'preset_1', configId: '', isEnabled: true });

    const { result } = renderHook(() => useWorkspaceModelConfig('/test/path'));
    await waitFor(() => {
      expect(result.current.preset).toBeNull();
      expect(result.current.config).toBeNull();
    });
  });

  it('配置列表中找不到对应配置时 config 为 null', async () => {
    mockInvoke
      .mockResolvedValueOnce({ id: 'preset_1', configId: 'cfg_missing', isEnabled: true })
      .mockResolvedValueOnce([{ id: 'cfg_other', name: 'other' }]);

    const { result } = renderHook(() => useWorkspaceModelConfig('/test/path'));
    await waitFor(() => {
      expect(result.current.preset).not.toBeNull();
      expect(result.current.config).toBeNull();
    });
  });

  it('isLoading 完成后变为 false', async () => {
    mockInvoke
      .mockResolvedValueOnce({ id: 'preset_1', configId: 'cfg_1', isEnabled: true })
      .mockResolvedValueOnce([{ id: 'cfg_1', name: 'test', model: 'gpt-4' }]);

    const { result } = renderHook(() => useWorkspaceModelConfig('/test/path'));
    // 初始为 false（effect 在下次 tick 才运行）
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('reload 函数重新加载配置', async () => {
    const mockPreset = { id: 'preset_1', configId: 'cfg_1', isEnabled: true };
    const mockConfig = { id: 'cfg_1', name: 'test', model: 'gpt-4' };

    mockInvoke
      .mockResolvedValueOnce(mockPreset)
      .mockResolvedValueOnce([mockConfig])
      .mockResolvedValueOnce({ ...mockPreset, id: 'preset_updated' })
      .mockResolvedValueOnce([{ ...mockConfig, name: 'updated' }]);

    const { result } = renderHook(() => useWorkspaceModelConfig('/test/path'));

    await waitFor(() => {
      expect(result.current.preset?.id).toBe('preset_1');
    });

    await result.current.reload();

    await waitFor(() => {
      expect(result.current.preset?.id).toBe('preset_updated');
    });
  });

  it('IPC 异常时 preset 和 config 为 null', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('IPC error'));

    const { result } = renderHook(() => useWorkspaceModelConfig('/test/path'));
    await waitFor(() => {
      expect(result.current.preset).toBeNull();
      expect(result.current.config).toBeNull();
    });
  });
});
