import { useState } from 'react';
import type { ModelConfig } from '@/types/models';
import { useWorkspaceModelConfig } from '@/hooks/useWorkspaceModelConfig';
import { ModelSwitcherModal } from './ModelSwitcherModal';
import { useSessionStore } from '@/stores/useSessionStore';
import { useWebSocket } from '@/hooks/useWebSocket';

export function ModelSwitcher({ onSwitch }: { onSwitch?: (config: ModelConfig) => void }) {
  const [isOpen, setIsOpen] = useState(false);

  // 获取当前活跃 session 的信息
  const activeSession = useSessionStore(state =>
    state.sessions.find(s => s.id === state.activeSessionId)
  );
  const { config: currentConfig } = useWorkspaceModelConfig(activeSession?.projectPath ?? null);
  const currentModel = currentConfig?.model ?? '默认模型';

  // 用于触发 WebSocket 断开
  const activeSessionId = useSessionStore(state => state.activeSessionId);
  const { disconnect } = useWebSocket(activeSessionId);

  const handleSwitch = (config: ModelConfig) => {
    // 更新会话模型
    useSessionStore.getState().updateSession(activeSessionId, { model: config.model });
    // 断开现有连接，下次发送会自动用新模型重连
    disconnect();
    onSwitch?.(config);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 14px',
          border: '1px solid var(--border)',
          borderRadius: 6,
          backgroundColor: 'var(--bg-secondary)',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--text-primary)',
          transition: 'all 150ms ease',
        }}
      >
        {/* AI Icon */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
          <circle cx="8.5" cy="14.5" r="1.5"/>
          <circle cx="15.5" cy="14.5" r="1.5"/>
          <path d="M9 18h6"/>
        </svg>
        <span>{currentModel}</span>
        {/* Dropdown Arrow */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{ opacity: 0.6 }}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      <ModelSwitcherModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSwitch={handleSwitch}
        currentModel={currentModel}
      />
    </>
  );
}
