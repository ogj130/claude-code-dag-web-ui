/**
 * SessionSidebar — 会话侧边栏
 *
 * 按工作路径分组显示所有会话
 * 顶部：新建会话 + 搜索；主体：可折叠的分组列表
 */

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/stores/db';
import type { DBSession } from '@/types/storage';

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function getStatusDotColor(status: DBSession['status']): string {
  switch (status) {
    case 'active': return '#4ade80';
    case 'archived': return '#6b7280';
    case 'deleted': return '#ef4444';
    default: return '#6b7280';
  }
}

function truncate(text: string, maxLen: number): string {
  if (!text) return 'Untitled';
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '…';
}

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

type GroupedSessions = Record<string, DBSession[]>;

// ---------------------------------------------------------------------------
// 子组件
// ---------------------------------------------------------------------------

/** 骨架屏 */
function SessionRowSkeleton() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 16px 8px 24px',
        borderRadius: 6,
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: 'var(--bg-input)',
          flexShrink: 0,
          animation: 'shimmer 1.5s infinite',
          backgroundSize: '200% 100%',
        }}
      />
      <div
        style={{
          flex: 1,
          height: 12,
          borderRadius: 4,
          background:
            'linear-gradient(90deg, var(--bg-input) 25%, var(--border) 50%, var(--bg-input) 75%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.5s infinite',
        }}
      />
    </div>
  );
}

/** 会话行 */
function SessionRow({ session }: { session: DBSession }) {
  return (
    <div
      className="session-row"
      role="button"
      tabIndex={0}
      onClick={() => {
        // TODO: 对接主应用切换会话逻辑
        console.info('[SessionSidebar] Session clicked:', session.id);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          console.info('[SessionSidebar] Session clicked:', session.id);
        }
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 16px 7px 24px',
        borderRadius: 6,
        cursor: 'pointer',
        transition: 'background-color 0.15s',
        minWidth: 0,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--bg-input)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent';
      }}
    >
      {/* 状态点 */}
      <div
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          backgroundColor: getStatusDotColor(session.status),
          flexShrink: 0,
        }}
        title={session.status}
      />

      {/* 标题 */}
      <span
        style={{
          flex: 1,
          fontSize: 12,
          color: 'var(--text-secondary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {truncate(session.title || 'Untitled', 38)}
      </span>

      {/* 相对时间 */}
      <span
        style={{
          fontSize: 10,
          color: 'var(--text-muted)',
          flexShrink: 0,
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        {formatRelativeTime(session.updatedAt)}
      </span>
    </div>
  );
}

/** 可折叠工作组 */
function WorkspaceGroup({
  workspacePath,
  sessions,
  defaultOpen = false,
}: {
  workspacePath: string;
  sessions: DBSession[];
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // 路径太长时截断显示
  const displayPath = workspacePath.length > 40
    ? '…' + workspacePath.slice(-37)
    : workspacePath;

  return (
    <div style={{ marginBottom: 2 }}>
      {/* Group Header */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen(v => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setIsOpen(v => !v);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 12px',
          cursor: 'pointer',
          userSelect: 'none',
          borderRadius: 6,
          transition: 'background-color 0.15s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--bg-input)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent';
        }}
      >
        {/* 展开/折叠图标 */}
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          style={{
            flexShrink: 0,
            transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
            color: 'var(--text-muted)',
          }}
        >
          <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        {/* 路径文字 */}
        <span
          style={{
            flex: 1,
            fontSize: 11,
            fontWeight: 500,
            color: 'var(--text-secondary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={workspacePath}
        >
          {displayPath}
        </span>

        {/* 会话数标签 */}
        <span
          style={{
            fontSize: 10,
            color: 'var(--text-muted)',
            background: 'var(--bg-input)',
            borderRadius: 10,
            padding: '1px 7px',
            flexShrink: 0,
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {sessions.length}
        </span>
      </div>

      {/* 会话列表 */}
      {isOpen && (
        <div style={{ marginTop: 1 }}>
          {sessions.map(session => (
            <SessionRow key={session.id} session={session} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 主组件
// ---------------------------------------------------------------------------

export function SessionSidebar() {
  const [grouped, setGrouped] = useState<GroupedSessions>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      // 读取所有非 deleted 状态的会话，按 updatedAt 降序
      const allSessions = await db.sessions
        .where('status')
        .notEqual('deleted')
        .reverse()
        .sortBy('updatedAt');

      // 按 workspacePath 分组
      const grouped: GroupedSessions = {};
      for (const session of allSessions) {
        const path = (session as DBSession & { workspacePath?: string }).workspacePath ?? 'Default';
        if (!grouped[path]) grouped[path] = [];
        grouped[path].push(session);
      }

      // 按路径字母序排序
      const sorted: GroupedSessions = {};
      Object.keys(grouped).sort().forEach(key => {
        sorted[key] = grouped[key];
      });

      setGrouped(sorted);
    } catch (err) {
      console.error('[SessionSidebar] Failed to load sessions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // 过滤后的分组数据
  const filteredGrouped: GroupedSessions = search.trim()
    ? Object.fromEntries(
        Object.entries(grouped).map(([path, sessions]) => [
          path,
          sessions.filter(s =>
            s.title.toLowerCase().includes(search.toLowerCase())
          ),
        ]).filter(([, sessions]) => sessions.length > 0)
      )
    : grouped;

  const totalSessions = Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <>
      <style>{`
        .session-row:focus {
          outline: 1px solid var(--accent);
          outline-offset: -1px;
        }
      `}</style>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          background: 'var(--bg-card)',
          borderRight: '1px solid var(--border)',
          width: 280,
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        {/* 顶部区域 */}
        <div style={{ padding: '12px 12px 8px' }}>
          {/* 标题行 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="2" width="5" height="5" rx="1" fill="var(--accent)" opacity="0.7" />
                <rect x="9" y="2" width="5" height="5" rx="1" fill="var(--accent)" />
                <rect x="2" y="9" width="5" height="5" rx="1" fill="var(--accent)" />
                <rect x="9" y="9" width="5" height="5" rx="1" fill="var(--accent)" opacity="0.4" />
              </svg>
              会话
            </span>
            <span
              style={{
                fontSize: 10,
                color: 'var(--text-muted)',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {totalSessions}
            </span>
          </div>

          {/* 新建会话按钮 */}
          <button
            onClick={() => {
              // TODO: 对接主应用新建会话逻辑
              console.info('[SessionSidebar] New session clicked');
            }}
            style={{
              width: '100%',
              padding: '7px 10px',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 7,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              marginBottom: 8,
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.opacity = '0.85';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.opacity = '1';
            }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            新建会话
          </button>

          {/* 搜索框 */}
          <div style={{ position: 'relative' }}>
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              style={{
                position: 'absolute',
                left: 9,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                pointerEvents: 'none',
              }}
            >
              <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="搜索会话…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px 6px 28px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                borderRadius: 7,
                fontSize: 12,
                color: 'var(--text-primary)',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => {
                (e.target as HTMLInputElement).style.borderColor = 'var(--accent)';
              }}
              onBlur={e => {
                (e.target as HTMLInputElement).style.borderColor = 'var(--border)';
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute',
                  right: 7,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 2,
                  fontSize: 11,
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* 分隔线 */}
        <div style={{ borderTop: '1px solid var(--border)', margin: '0 12px 6px' }} />

        {/* 会话列表 */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '2px 12px',
          }}
        >
          {loading ? (
            <>
              {Array.from({ length: 8 }).map((_, i) => (
                <SessionRowSkeleton key={i} />
              ))}
            </>
          ) : Object.keys(filteredGrouped).length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px 16px',
                color: 'var(--text-muted)',
                gap: 8,
                textAlign: 'center',
              }}
            >
              <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
                <rect x="8" y="10" width="32" height="28" rx="3" stroke="currentColor" strokeWidth="2" fill="none" />
                <path d="M8 18h32" stroke="currentColor" strokeWidth="2" />
                <path d="M16 6v8M32 6v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <div style={{ fontSize: 12, fontWeight: 600 }}>
                {search ? '未找到匹配会话' : '暂无会话'}
              </div>
            </div>
          ) : (
            Object.entries(filteredGrouped).map(([path, sessions]) => (
              <WorkspaceGroup
                key={path}
                workspacePath={path}
                sessions={sessions}
                defaultOpen={!search} // 无搜索时默认全部展开
              />
            ))
          )}
        </div>

        {/* 分隔线 */}
        <div style={{ borderTop: '1px solid var(--border)', margin: '0 12px' }} />

        {/* 底部管理按钮 */}
        <div style={{ padding: '8px 12px 12px' }}>
          <button
            onClick={() => {
              // TODO: 对接主应用工作路径管理逻辑
              console.info('[SessionSidebar] Manage workspaces clicked');
            }}
            style={{
              width: '100%',
              padding: '6px 10px',
              background: 'transparent',
              color: 'var(--text-muted)',
              border: '1px solid var(--border)',
              borderRadius: 7,
              fontSize: 11,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              const btn = e.currentTarget as HTMLButtonElement;
              btn.style.background = 'var(--bg-input)';
              btn.style.color = 'var(--text-secondary)';
            }}
            onMouseLeave={e => {
              const btn = e.currentTarget as HTMLButtonElement;
              btn.style.background = 'transparent';
              btn.style.color = 'var(--text-muted)';
            }}
          >
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 2v2M8 12v2M2 8h2M12 8h2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M3.5 12.5l1.4-1.4M11.1 4.9l1.4-1.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            管理所有工作路径
          </button>
        </div>
      </div>
    </>
  );
}
