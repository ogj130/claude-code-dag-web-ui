/**
 * UnlockNotification — 解锁通知组件
 *
 * 滑入动画 + 自动消失的通知卡片。
 * 在新功能解锁时显示。
 * 所有样式使用内联 style + CSS 变量（本项目未安装 Tailwind CSS）。
 */

import { useState, useEffect, useCallback } from 'react';
import { onUnlock, type UnlockEvent, type UnlockLevel } from '../../services/progressiveUnlock';

// ── 等级样式 ────────────────────────────────────────────────

const LEVEL_STYLES: Record<UnlockLevel, { color: string; bg: string; border: string; icon: string }> = {
  basic: {
    color: '#CBD5E1',
    bg: 'rgba(107, 114, 128, 0.1)',
    border: 'rgba(107, 114, 128, 0.25)',
    icon: '🔓',
  },
  intermediate: {
    color: '#93C5FD',
    bg: 'rgba(59, 130, 246, 0.1)',
    border: 'rgba(59, 130, 246, 0.25)',
    icon: '⭐',
  },
  advanced: {
    color: '#C4B5FD',
    bg: 'rgba(168, 85, 247, 0.1)',
    border: 'rgba(168, 85, 247, 0.25)',
    icon: '🚀',
  },
  expert: {
    color: '#FDE68A',
    bg: 'rgba(251, 191, 36, 0.1)',
    border: 'rgba(251, 191, 36, 0.25)',
    icon: '👑',
  },
};

const LEVEL_LABELS: Record<UnlockLevel, string> = {
  basic: '基础',
  intermediate: '中级',
  advanced: '高级',
  expert: '专家',
};

// ── 通知项 ──────────────────────────────────────────────────

interface NotificationItem {
  id: string;
  event: UnlockEvent;
  isExiting: boolean;
}

function NotificationCard({
  item,
  onDismiss,
}: {
  item: NotificationItem;
  onDismiss: (id: string) => void;
}) {
  const style = LEVEL_STYLES[item.event.level];

  useEffect(() => {
    const exitTimer = setTimeout(() => {
      onDismiss(item.id);
    }, 5000);

    return () => clearTimeout(exitTimer);
  }, [item.id, onDismiss]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        borderRadius: 8,
        border: `1px solid ${style.border}`,
        background: style.bg,
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        transition: 'all 0.3s ease-out',
        opacity: item.isExiting ? 0 : 1,
        transform: item.isExiting ? 'translateX(100%)' : 'translateX(0)',
      }}
    >
      <span style={{ fontSize: 18 }}>{style.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: style.color }}>
          功能解锁！
        </div>
        <div style={{
          fontSize: 12,
          color: '#94A3B8',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          <span style={{ fontWeight: 500, color: '#CBD5E1' }}>{item.event.featureName}</span>
          {' — '}
          {LEVEL_LABELS[item.event.level]}功能已解锁
        </div>
      </div>
      <button
        onClick={() => onDismiss(item.id)}
        style={{
          fontSize: 12,
          color: '#64748B',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#CBD5E1'; }}
        onMouseLeave={e => { e.currentTarget.style.color = '#64748B'; }}
      >
        ✕
      </button>
    </div>
  );
}

// ── 主组件 ──────────────────────────────────────────────────

export default function UnlockNotification() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isExiting: true } : n))
    );
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 300);
  }, []);

  useEffect(() => {
    const unsub = onUnlock((event) => {
      const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      setNotifications((prev) => [
        ...prev,
        { id, event, isExiting: false },
      ]);
    });

    return unsub;
  }, []);

  if (notifications.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      zIndex: 50,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      maxWidth: 384,
    }}>
      {notifications.map((item) => (
        <NotificationCard key={item.id} item={item} onDismiss={dismiss} />
      ))}
    </div>
  );
}
