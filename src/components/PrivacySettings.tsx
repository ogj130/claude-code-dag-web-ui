/**
 * 隐私设置面板
 * 包含隐私模式开关、加密状态、数据统计、清除历史等功能
 */
import { useState, useEffect } from 'react';
import { isPrivacyModeEnabled, setPrivacyMode } from '@/stores/useSessionStore';
import { clearAllHistory, getHistoryStats } from '@/utils/privacy';
import { hasEncryptionKey } from '@/utils/encryption';

interface PrivacySettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PrivacySettings({ isOpen, onClose }: PrivacySettingsProps) {
  const [stats, setStats] = useState<{
    sessionCount: number;
    queryCount: number;
    toolCallCount: number;
    oldestTimestamp: number;
    newestTimestamp: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      getHistoryStats()
        .then(setStats)
        .catch(err => console.error('[PrivacySettings] Failed to load stats:', err));
    }
  }, [isOpen]);

  const handlePrivacyToggle = () => {
    setPrivacyMode(!isPrivacyModeEnabled());
  };

  const handleClearAll = async () => {
    setLoading(true);
    try {
      await clearAllHistory();
      setStats({
        sessionCount: 0,
        queryCount: 0,
        toolCallCount: 0,
        oldestTimestamp: 0,
        newestTimestamp: 0,
      });
      setShowConfirm(null);
    } catch (e) {
      console.error('[PrivacySettings] Failed to clear history:', e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* 遮罩层 */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(2px)',
        }}
        onClick={onClose}
      />

      {/* 主面板 */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1000,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 20,
          width: 400,
          maxWidth: '90vw',
          maxHeight: '75vh',
          overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        }}
      >
        {/* 标题栏 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            隐私设置
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: 4,
              display: 'flex',
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* 隐私模式开关 */}
          <div
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-card)',
              borderRadius: 10,
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: isPrivacyModeEnabled()
                    ? 'rgba(168,85,247,0.15)'
                    : 'var(--bg-input)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={isPrivacyModeEnabled() ? '#a855f7' : 'var(--text-dim)'}
                  strokeWidth="2"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                  }}
                >
                  隐私模式
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    marginTop: 2,
                  }}
                >
                  {isPrivacyModeEnabled()
                    ? '所有数据将以加密形式存储'
                    : '数据以明文或压缩形式存储'}
                </div>
              </div>
            </div>
            <button
              onClick={handlePrivacyToggle}
              style={{
                width: 44,
                height: 24,
                borderRadius: 12,
                background: isPrivacyModeEnabled() ? 'var(--accent)' : 'var(--bg-input)',
                border: `1px solid ${
                  isPrivacyModeEnabled() ? 'var(--accent)' : 'var(--border)'
                }`,
                position: 'relative',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: '#fff',
                  position: 'absolute',
                  top: 2,
                  left: isPrivacyModeEnabled() ? 22 : 2,
                  transition: 'left 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }}
              />
            </button>
          </div>

          {/* 数据加密状态 */}
          <div
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-card)',
              borderRadius: 10,
              padding: '14px 16px',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text-dim)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 10,
              }}
            >
              数据存储状态
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
              }}
            >
              <div style={{ padding: '8px 0' }}>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {stats?.sessionCount ?? '-'}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  会话数
                </div>
              </div>
              <div style={{ padding: '8px 0' }}>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {stats?.queryCount ?? '-'}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  查询数
                </div>
              </div>
              <div style={{ padding: '8px 0' }}>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: isPrivacyModeEnabled() ? 'var(--accent)' : 'var(--text-muted)',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {isPrivacyModeEnabled() ? '已加密' : '未加密'}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  存储状态
                </div>
              </div>
              <div style={{ padding: '8px 0' }}>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {stats?.toolCallCount ?? '-'}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  工具调用数
                </div>
              </div>
            </div>
          </div>

          {/* 加密密钥状态 */}
          <div
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-card)',
              borderRadius: 10,
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: hasEncryptionKey() ? 'var(--success, #22c55e)' : 'var(--text-muted)',
              }}
            />
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                }}
              >
                AES-256 加密
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                {hasEncryptionKey() ? '密钥已生成并存储' : '首次开启隐私模式时自动生成'}
              </div>
            </div>
          </div>

          {/* 危险操作区域 */}
          <div
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-card)',
              borderRadius: 10,
              padding: '14px 16px',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text-dim)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 10,
              }}
            >
              危险操作
            </div>
            <button
              onClick={() => setShowConfirm('clear')}
              style={{
                width: '100%',
                padding: '8px 14px',
                borderRadius: 8,
                border: '1px solid rgba(248,113,113,0.3)',
                background: 'rgba(248,113,113,0.08)',
                color: '#f87171',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
              </svg>
              清除所有历史记录
            </button>
          </div>

          {/* 确认对话框 */}
          {showConfirm === 'clear' && (
            <div
              style={{
                background: 'var(--bg-card)',
                border: '1px solid rgba(248,113,113,0.4)',
                borderRadius: 10,
                padding: '14px 16px',
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text-primary)',
                  marginBottom: 10,
                }}
              >
                确定要清除所有历史记录吗？此操作不可撤销。
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setShowConfirm(null)}
                  style={{
                    flex: 1,
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-secondary)',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  取消
                </button>
                <button
                  onClick={handleClearAll}
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: 'none',
                    background: '#f87171',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: loading ? 'wait' : 'pointer',
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  {loading ? '清除中...' : '确认清除'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
