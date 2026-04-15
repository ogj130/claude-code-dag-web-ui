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
import { getEnabledWorkspaces } from '@/stores/workspaceStorage';
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
        const list = await getEnabledWorkspaces();
        setWorkspaces(list);
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
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          width: 'min(800px, 95vw)',
          maxHeight: '85vh',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px',
          borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>
            全局终端
            <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-muted)' }}>
              {loading ? '加载中…' : `${workspaces.length} 个工作区`}
            </span>
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: 18, lineHeight: 1,
              padding: '2px 6px',
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {!loading && workspaces.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
              暂无可用工作区，请先在工作区设置中添加并启用工作区。
            </div>
          ) : (
            <GlobalTerminal workspaces={workspaces} />
          )}
        </div>
      </div>
    </div>
  );
}
