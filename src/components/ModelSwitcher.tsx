import { useState, useEffect } from 'react';
import type { ModelConfig } from '@/types/models';
import { useSessionStore } from '../stores/useSessionStore';
import { useWorkspaceModelConfig } from '../hooks/useWorkspaceModelConfig';
import { useWebSocket } from '../hooks/useWebSocket';

export function ModelSwitcher({ onSwitch }: { onSwitch?: (config: ModelConfig) => void }) {
  const [configs, setConfigs] = useState<ModelConfig[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState<ModelConfig | null>(null);

  // 获取当前活跃 session 的 projectPath
  const activeSession = useSessionStore(state =>
    state.sessions.find(s => s.id === state.activeSessionId)
  );
  const { config: currentConfig } = useWorkspaceModelConfig(activeSession?.projectPath ?? null);
  const currentModel = currentConfig?.model ?? '默认模型';

  // 用于触发 WebSocket 断开（模型切换后下次发送会自动用新模型重连）
  const activeSessionId = useSessionStore(state => state.activeSessionId);
  const { disconnect } = useWebSocket(activeSessionId);

  useEffect(() => {
    loadConfigs();
  }, []);

  async function loadConfigs() {
    const configs = await window.electron.invoke('model-config:get-all') as ModelConfig[];
    setConfigs(configs);
  }

  function handleSelect(config: ModelConfig) {
    if (config.model === currentModel) {
      setIsOpen(false);
      return;
    }

    // 显示确认对话框
    setShowConfirm(config);
    setIsOpen(false);
  }

  function confirmSwitch() {
    if (showConfirm) {
      // 更新会话模型
      useSessionStore.getState().updateSession(activeSessionId, { model: showConfirm.model });
      // 断开现有连接，下次发送会自动用新模型重连
      disconnect();
      onSwitch?.(showConfirm);
      setShowConfirm(null);
    }
  }

  return (
    <>
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            border: '1px solid var(--border-color)',
            borderRadius: 6,
            backgroundColor: 'var(--bg-secondary)',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          <span style={{ fontWeight: 500 }}>{currentModel}</span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s',
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {isOpen && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 4,
              minWidth: 200,
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              zIndex: 1000,
              overflow: 'hidden',
            }}
          >
            <div style={{
              padding: '8px 12px',
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-secondary)',
              borderBottom: '1px solid var(--border-color)',
            }}>
              切换模型
            </div>
            {configs.map(config => (
              <button
                key={config.id}
                onClick={() => handleSelect(config)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  width: '100%',
                  padding: '10px 12px',
                  border: 'none',
                  backgroundColor: config.model === currentModel ? 'var(--bg-secondary)' : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontWeight: 500, fontSize: 13 }}>{config.name}</span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {config.model} · {config.provider}
                </span>
              </button>
            ))}
            <button
              onClick={() => setIsOpen(false)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: 'none',
                borderTop: '1px solid var(--border-color)',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                fontSize: 13,
              }}
            >
              取消
            </button>
          </div>
        )}
      </div>

      {/* 确认对话框 */}
      {showConfirm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
          }}
          onClick={() => setShowConfirm(null)}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-primary)',
              padding: 24,
              borderRadius: 12,
              maxWidth: 400,
              margin: 16,
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>切换模型</h3>
            <p style={{ color: 'var(--text-secondary)' }}>
              切换模型将重启当前会话，当前对话上下文将丢失。
            </p>
            <p style={{ marginTop: 12 }}>
              确定切换到 <strong>{showConfirm.name}</strong> ({showConfirm.model})？
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setShowConfirm(null)}>取消</button>
              <button
                onClick={confirmSwitch}
                style={{ backgroundColor: 'var(--accent)', color: 'white' }}
              >
                确认切换
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
