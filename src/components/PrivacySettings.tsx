/**
 * 隐私设置面板
 * 包含隐私模式开关、清除历史、数据导出等功能
 */
import { useState, useCallback } from 'react';
import { useConfirm } from '../hooks/useConfirm';
import { db } from '../lib/db';
import {
  exportToJSON,
  exportToMarkdown,
  downloadFile,
} from '../utils/export';
import { hasEncryptionKey } from '../utils/encryption';

interface PrivacySettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

type ExportFormat = 'json' | 'markdown';

export function PrivacySettings({ isOpen, onClose }: PrivacySettingsProps) {
  const [privacyMode, setPrivacyMode] = useState(() => {
    return localStorage.getItem('cc_privacy_mode') === 'true';
  });
  const [isExporting, setIsExporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const { confirm, DialogComponent } = useConfirm();

  // 隐私模式开关
  const handlePrivacyModeToggle = useCallback(() => {
    const newValue = !privacyMode;
    setPrivacyMode(newValue);
    localStorage.setItem('cc_privacy_mode', String(newValue));
  }, [privacyMode]);

  // 清除所有历史记录
  const handleClearAllHistory = useCallback(async () => {
    let cleared = false;
    await confirm({
      title: '清除所有历史记录',
      message: (
        <div>
          <p>确定要清除所有历史记录吗？</p>
          <p style={{ marginTop: 8, color: 'var(--error)', fontSize: 12 }}>
            此操作不可撤销，所有会话和问答数据将被永久删除。
          </p>
        </div>
      ),
      buttons: [
        { label: '取消', variant: 'ghost', onClick: () => { /* 取消 */ } },
        { label: '清除', variant: 'danger', onClick: () => { cleared = true; } },
      ],
    });

    if (cleared) {
      setIsClearing(true);
      try {
        await db.transaction('rw', [db.sessions, db.queries], async () => {
          await db.sessions.clear();
          await db.queries.clear();
        });
        // 同时清除 localStorage 中的隐私模式
        localStorage.removeItem('cc_privacy_mode');
        setPrivacyMode(false);
      } catch (error) {
        console.error('[Privacy] 清除历史记录失败:', error);
      } finally {
        setIsClearing(false);
      }
    }
  }, [confirm]);

  // 导出数据
  const handleExport = useCallback(async (format: ExportFormat) => {
    setIsExporting(true);
    try {
      // 获取所有数据
      const sessions = await db.sessions.toArray();
      const queries = await db.queries.toArray();

      // 按会话分组查询
      const queriesMap = new Map<string, typeof queries>();
      for (const query of queries) {
        const existing = queriesMap.get(query.sessionId) || [];
        existing.push(query);
        queriesMap.set(query.sessionId, existing);
      }

      // 按时间排序
      for (const [sessionId, qs] of queriesMap) {
        queriesMap.set(sessionId, qs.sort((a, b) => a.timestamp - b.timestamp));
      }

      const result =
        format === 'json'
          ? await exportToJSON(sessions, queriesMap)
          : await exportToMarkdown(sessions, queriesMap);

      if (result.success) {
        downloadFile(result);
      } else {
        console.error('[Export] 导出失败:', result.error);
      }
    } catch (error) {
      console.error('[Export] 导出失败:', error);
    } finally {
      setIsExporting(false);
    }
  }, []);

  if (!isOpen) return null;

  return (
    <>
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
          padding: '20px',
          width: 400,
          maxWidth: '90vw',
          maxHeight: '75vh',
          overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 隐私模式 */}
        <div
          style={{
            padding: '16px',
            background: 'var(--bg-input)',
            borderRadius: 8,
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>
                隐私模式
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                开启后不创建新的历史记录
              </div>
            </div>
            <button
              onClick={handlePrivacyModeToggle}
              style={{
                width: 44,
                height: 24,
                borderRadius: 12,
                border: 'none',
                cursor: 'pointer',
                background: privacyMode ? 'var(--accent)' : 'var(--border)',
                position: 'relative',
                transition: 'background 0.2s',
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: 'white',
                  position: 'absolute',
                  top: 2,
                  left: privacyMode ? 22 : 2,
                  transition: 'left 0.2s',
                }}
              />
            </button>
          </div>
        </div>

        {/* 数据加密状态 */}
        <div
          style={{
            padding: '16px',
            background: 'var(--bg-input)',
            borderRadius: 8,
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>
            数据加密
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: hasEncryptionKey() ? 'var(--success)' : 'var(--text-muted)',
                }}
              />
              {hasEncryptionKey() ? 'AES-256 加密已启用' : '加密未启用'}
            </div>
          </div>
        </div>

        {/* 数据导出 */}
        <div
          style={{
            padding: '16px',
            background: 'var(--bg-input)',
            borderRadius: 8,
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>
            数据导出
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => handleExport('json')}
              disabled={isExporting}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                fontSize: 12,
                cursor: isExporting ? 'not-allowed' : 'pointer',
                opacity: isExporting ? 0.6 : 1,
              }}
            >
              JSON
            </button>
            <button
              onClick={() => handleExport('markdown')}
              disabled={isExporting}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                fontSize: 12,
                cursor: isExporting ? 'not-allowed' : 'pointer',
                opacity: isExporting ? 0.6 : 1,
              }}
            >
              Markdown
            </button>
          </div>
        </div>

        {/* 清除历史 */}
        <div
          style={{
            padding: '16px',
            background: 'var(--bg-input)',
            borderRadius: 8,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>
            危险操作
          </div>
          <button
            onClick={handleClearAllHistory}
            disabled={isClearing}
            style={{
              width: '100%',
              padding: '10px 16px',
              borderRadius: 6,
              border: '1px solid var(--error)',
              background: 'transparent',
              color: 'var(--error)',
              fontSize: 13,
              fontWeight: 500,
              cursor: isClearing ? 'not-allowed' : 'pointer',
              opacity: isClearing ? 0.6 : 1,
              transition: 'all 0.2s',
            }}
          >
            {isClearing ? '清除中...' : '清除所有历史记录'}
          </button>
        </div>
      </div>
      {DialogComponent}
    </>
  );
}