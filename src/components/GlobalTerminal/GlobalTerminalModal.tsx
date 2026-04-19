/**
 * GlobalTerminalModal — 全局终端 Modal
 *
 * 提供多工作区统一入口，支持：
 * - 多工作区并行 prompt dispatch
 * - 会话策略切换（新建 / 复用）
 * - 执行结果实时展示
 */

import { useState, useEffect } from 'react';
import { GlobalTerminal } from './GlobalTerminal';
import { preloadModelConfigs } from '@/services/globalDispatchExecutor';
import type { Workspace } from '@/types/workspace';

export interface GlobalTerminalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GlobalTerminalModal({ isOpen, onClose }: GlobalTerminalModalProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(false);

  // 每次打开时重新加载工作区列表和模型配置缓存
  useEffect(() => {
    if (!isOpen) return;

    const load = async () => {
      setLoading(true);
      try {
        await preloadModelConfigs();
        // 统一通过 Electron IPC 获取启用的 preset 列表
        let list: any[] = [];
        if (window.electron?.invoke) {
          list = await window.electron.invoke('workspace-preset:get-enabled') as any[];
        } else {
          // Dev 模式下降级到直接导入
          const { getEnabledPresets } = await import('@/stores/workspacePresetStorage');
          list = await getEnabledPresets();
        }
        // 将 preset 数据映射为 Workspace 类型供 GlobalTerminal 使用
        setWorkspaces(list.map((p: any) => ({
          id: p.id,
          name: p.name,
          workspacePath: p.workspacePath,
          modelConfigId: p.configId,
          enabled: p.isEnabled,
          createdAt: p.createdAt || Date.now(),
          updatedAt: p.updatedAt || Date.now(),
        })));
      } catch (err) {
        console.error('[GlobalTerminalModal] Failed to load workspaces:', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [isOpen]);

  // Esc 关闭
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          width: 'min(800px, 95vw)',
          maxHeight: '85vh',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>
            全局终端
            <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>
              {loading ? '加载中…' : `${workspaces.length} 个工作区`}
            </span>
          </span>
          <button
            onClick={onClose}
            aria-label="关闭"
            onMouseEnter={e => {
              e.currentTarget.style.color = 'var(--text-primary)';
              e.currentTarget.style.background = 'var(--bg-input)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'var(--text-muted)';
              e.currentTarget.style.background = 'none';
            }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: 18, lineHeight: 1,
              padding: '4px 8px', borderRadius: 4,
              transition: 'color 0.2s, background 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {!loading && workspaces.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              暂无可用工作区，请先在工作区设置中添加并启用工作区。
            </div>
          ) : (
            <>
              <GlobalTerminal workspaces={workspaces} onClose={onClose} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
