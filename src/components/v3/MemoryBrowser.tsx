/**
 * MemoryBrowser — 记忆浏览器
 *
 * 三标签：情景记忆 / 语义记忆 / 工作记忆。
 * 支持全文搜索、筛选、编辑、软删除。
 * 所有样式使用内联 style + CSS 变量（本项目未安装 Tailwind CSS）。
 */

import { useState, useCallback, useEffect } from 'react';
import {
  episodeStore,
  patternStore,
  type Episode,
  type Pattern,
} from '../../stores/memoryStore';
import {
  useWorkingMemoryEntries,
  type WorkingMemoryEntry,
} from '../../stores/useWorkingMemoryStore';

// ── 类型 ────────────────────────────────────────────────────

type TabKey = 'episodes' | 'patterns' | 'working';

const TAB_CONFIG: Array<{ key: TabKey; labelKey: string }> = [
  { key: 'episodes', labelKey: 'memory.tab_episodes' },
  { key: 'patterns', labelKey: 'memory.tab_patterns' },
  { key: 'working', labelKey: 'memory.tab_working' },
];

const EPISODE_TYPE_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  feature_impl: { text: '#60A5FA', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.2)' },
  bug_fix: { text: '#F87171', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)' },
  code_review: { text: '#C084FC', bg: 'rgba(168,85,247,0.1)', border: 'rgba(168,85,247,0.2)' },
  debug_session: { text: '#FBBF24', bg: 'rgba(234,179,8,0.1)', border: 'rgba(234,179,8,0.2)' },
  config_change: { text: '#34D399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.2)' },
  architecture_decision: { text: '#67E8F9', bg: 'rgba(6,182,212,0.1)', border: 'rgba(6,182,212,0.2)' },
};

const EMOTION_ICONS: Record<string, string> = {
  success: '✓',
  failure: '✗',
  confusion: '?',
  satisfaction: '★',
};

// ── 搜索栏 ─────────────────────────────────────────────────

function SearchBar({
  query,
  onSearch,
  typeFilter,
  onTypeFilter,
  tagFilter,
  onTagFilter,
}: {
  query: string;
  onSearch: (q: string) => void;
  typeFilter: string;
  onTypeFilter: (t: string) => void;
  tagFilter: string;
  onTagFilter: (t: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
      <input
        type="text"
        value={query}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="搜索记忆..."
        style={{
          width: '100%',
          fontSize: 12,
          padding: '8px 12px',
          borderRadius: 8,
          background: '#1E293B',
          border: '1px solid #374151',
          color: '#CBD5E1',
          outline: 'none',
          fontFamily: 'inherit',
          boxSizing: 'border-box',
        }}
        onFocus={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)'; }}
        onBlur={e => { e.currentTarget.style.borderColor = '#374151'; }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <select
          value={typeFilter}
          onChange={(e) => onTypeFilter(e.target.value)}
          style={{
            fontSize: 10,
            padding: '4px 8px',
            borderRadius: 4,
            background: '#1E293B',
            border: '1px solid #374151',
            color: '#9CA3AF',
            fontFamily: 'inherit',
            outline: 'none',
          }}
        >
          <option value="">所有类型</option>
          <option value="feature_impl">功能实现</option>
          <option value="bug_fix">Bug 修复</option>
          <option value="code_review">代码审查</option>
          <option value="debug_session">调试会话</option>
        </select>
        <input
          type="text"
          value={tagFilter}
          onChange={(e) => onTagFilter(e.target.value)}
          placeholder="标签筛选"
          style={{
            fontSize: 10,
            padding: '4px 8px',
            borderRadius: 4,
            background: '#1E293B',
            border: '1px solid #374151',
            color: '#9CA3AF',
            width: 96,
            outline: 'none',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)'; }}
          onBlur={e => { e.currentTarget.style.borderColor = '#374151'; }}
        />
      </div>
    </div>
  );
}

// ── 情景记忆卡片 ────────────────────────────────────────────

function EpisodeCard({
  episode,
  onSoftDelete,
}: {
  episode: Episode;
  onSoftDelete: (id: string) => void;
}) {
  const defaultColor = { text: '#9CA3AF', bg: 'rgba(107,114,128,0.1)', border: 'transparent' };
  const typeColor = EPISODE_TYPE_COLORS[episode.type] ?? defaultColor;
  const emotionIcon = episode.emotionTag ? EMOTION_ICONS[episode.emotionTag] ?? '' : '';
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      style={{
        padding: 12,
        borderRadius: 8,
        border: '1px solid rgba(55,65,81,0.5)',
        background: 'rgba(30,41,59,0.3)',
        transition: 'all 0.15s ease-out',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 10,
            padding: '2px 6px',
            borderRadius: 4,
            border: `1px solid ${typeColor.border}`,
            background: typeColor.bg,
            color: typeColor.text,
          }}>
            {episode.type}
          </span>
          {emotionIcon && (
            <span style={{ fontSize: 10 }} title={episode.emotionTag}>{emotionIcon}</span>
          )}
          <span style={{ fontSize: 10, color: '#6B7280' }}>
            {new Date(episode.timestamp).toLocaleString()}
          </span>
        </div>
        <button
          onClick={() => onSoftDelete(episode.id)}
          style={{
            opacity: isHovered ? 1 : 0,
            fontSize: 10,
            color: isHovered ? '#F87171' : 'rgba(248,113,113,0.6)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'all 0.15s ease-out',
            padding: 0,
          }}
        >
          删除
        </button>
      </div>
      <p style={{
        margin: 0,
        fontSize: 12,
        color: '#CBD5E1',
        lineHeight: 1.6,
        whiteSpace: 'pre-wrap',
      }}>
        {episode.content.slice(0, 300)}
      </p>
      {episode.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
          {episode.tags.slice(0, 5).map((tag) => (
            <span key={tag} style={{
              fontSize: 10,
              padding: '2px 4px',
              borderRadius: 4,
              background: 'rgba(55,65,81,0.5)',
              color: '#6B7280',
            }}>
              {tag}
            </span>
          ))}
        </div>
      )}
      {episode.snippet && (
        <div
          style={{ marginTop: 6, fontSize: 10, color: 'rgba(253,224,71,0.7)' }}
          dangerouslySetInnerHTML={{ __html: episode.snippet }}
        />
      )}
    </div>
  );
}

// ── 语义记忆卡片 ────────────────────────────────────────────

function PatternCard({ pattern }: { pattern: Pattern }) {
  const confidenceColor = pattern.confidence >= 0.7 ? '#34D399'
    : pattern.confidence >= 0.4 ? '#FBBF24'
    : '#F87171';

  return (
    <div style={{
      padding: 12,
      borderRadius: 8,
      border: '1px solid rgba(55,65,81,0.5)',
      background: 'rgba(30,41,59,0.3)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: '#CBD5E1' }}>{pattern.pattern}</span>
        <span style={{ fontSize: 10, color: confidenceColor }}>
          {(pattern.confidence * 100).toFixed(0)}%
        </span>
      </div>
      <div style={{ fontSize: 10, color: '#6B7280', marginBottom: 4 }}>{pattern.domain}</div>
      <p style={{ margin: 0, fontSize: 12, color: '#9CA3AF' }}>{pattern.description}</p>
    </div>
  );
}

// ── 工作记忆卡片 ────────────────────────────────────────────

function WorkingMemoryCard({ entry }: { entry: WorkingMemoryEntry }) {
  const typeColors: Record<string, { border: string; bg: string }> = {
    context: { border: 'rgba(59,130,246,0.2)', bg: 'rgba(59,130,246,0.05)' },
    instruction: { border: 'rgba(52,211,153,0.2)', bg: 'rgba(52,211,153,0.05)' },
    constraint: { border: 'rgba(239,68,68,0.2)', bg: 'rgba(239,68,68,0.05)' },
    reference: { border: 'rgba(168,85,247,0.2)', bg: 'rgba(168,85,247,0.05)' },
    checkpoint: { border: 'rgba(234,179,8,0.2)', bg: 'rgba(234,179,8,0.05)' },
  };
  const tc = typeColors[entry.type] ?? { border: 'rgba(55,65,81,0.5)', bg: 'rgba(30,41,59,0.3)' };

  return (
    <div style={{
      padding: 12,
      borderRadius: 8,
      border: `1px solid ${tc.border}`,
      background: tc.bg,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 10, color: '#6B7280' }}>{entry.type}</span>
        <span style={{ fontSize: 10, color: '#4B5563' }}>p{entry.priority}</span>
        <span style={{ fontSize: 10, color: '#4B5563' }}>~{entry.tokenEstimate} tok</span>
      </div>
      <p style={{
        margin: 0,
        fontSize: 12,
        color: '#CBD5E1',
        lineHeight: 1.6,
        whiteSpace: 'pre-wrap',
      }}>
        {entry.content.slice(0, 200)}
      </p>
    </div>
  );
}

// ── 置信度衰减状态 ──────────────────────────────────────────

function ConfidenceDecayInfo() {
  return (
    <div style={{
      padding: 8,
      borderRadius: 4,
      background: 'rgba(30,41,59,0.3)',
      marginBottom: 12,
      fontSize: 10,
      color: '#6B7280',
    }}>
      置信度衰减策略：每 30 天自动衰减 10%，软删除的条目保留 30 天可恢复。
    </div>
  );
}

// ── 主组件 ──────────────────────────────────────────────────

export interface MemoryBrowserProps {
  workspaceId?: string;
  className?: string;
}

export default function MemoryBrowser({ workspaceId = 'default' }: MemoryBrowserProps) {
  const [tab, setTab] = useState<TabKey>('episodes');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');

  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const entries = useWorkingMemoryEntries();

  // ── 加载情景记忆 ──

  const loadEpisodes = useCallback(async () => {
    try {
      const results = query
        ? await episodeStore.search(query, workspaceId)
        : await episodeStore.list(workspaceId, 50);

      setEpisodes(
        results.filter((ep) => {
          if (typeFilter && ep.type !== typeFilter) return false;
          if (tagFilter && !ep.tags.some((t) => t.includes(tagFilter))) return false;
          return true;
        })
      );
    } catch (err) {
      console.error('[MemoryBrowser] Failed to load episodes:', err);
    }
  }, [workspaceId, query, typeFilter, tagFilter]);

  // ── 加载语义记忆 ──

  const loadPatterns = useCallback(async () => {
    try {
      const results = await patternStore.list('', 50);
      setPatterns(results);
    } catch (err) {
      console.error('[MemoryBrowser] Failed to load patterns:', err);
    }
  }, []);

  useEffect(() => {
    if (tab === 'episodes') loadEpisodes();
    if (tab === 'patterns') loadPatterns();
  }, [tab, loadEpisodes, loadPatterns]);

  // ── 软删除 ──

  const handleSoftDelete = useCallback(async (id: string) => {
    await episodeStore.softDelete(id);
    loadEpisodes();
  }, [loadEpisodes]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 标签栏 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '12px 12px 0', marginBottom: 12 }}>
        {TAB_CONFIG.map((t) => {
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                fontSize: 12,
                padding: '6px 12px',
                borderRadius: 6,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.15s ease-out',
                border: isActive ? '1px solid rgba(59,130,246,0.3)' : 'none',
                background: isActive ? 'rgba(59,130,246,0.2)' : 'rgba(55,65,81,0.3)',
                color: isActive ? '#60A5FA' : '#6B7280',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = '#9CA3AF'; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = '#6B7280'; }}
            >
              {t.labelKey}
            </button>
          );
        })}
      </div>

      {/* 搜索栏（仅情景记忆） */}
      {tab === 'episodes' && (
        <div style={{ padding: '0 12px' }}>
          <SearchBar
            query={query}
            onSearch={setQuery}
            typeFilter={typeFilter}
            onTypeFilter={setTypeFilter}
            tagFilter={tagFilter}
            onTagFilter={setTagFilter}
          />
        </div>
      )}

      {/* 置信度信息（仅语义记忆） */}
      {tab === 'patterns' && (
        <div style={{ padding: '0 12px' }}>
          <ConfidenceDecayInfo />
        </div>
      )}

      {/* 内容列表 */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0 12px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        {tab === 'episodes' && (
          episodes.length === 0
            ? <div style={{ textAlign: 'center', color: '#6B7280', fontSize: 12, padding: '32px 0' }}>暂无情景记忆</div>
            : episodes.map((ep) => (
                <EpisodeCard key={ep.id} episode={ep} onSoftDelete={handleSoftDelete} />
              ))
        )}

        {tab === 'patterns' && (
          patterns.length === 0
            ? <div style={{ textAlign: 'center', color: '#6B7280', fontSize: 12, padding: '32px 0' }}>暂无语义记忆</div>
            : patterns.map((p) => <PatternCard key={p.id} pattern={p} />)
        )}

        {tab === 'working' && (
          entries.length === 0
            ? <div style={{ textAlign: 'center', color: '#6B7280', fontSize: 12, padding: '32px 0' }}>暂无工作记忆条目</div>
            : entries.map((e) => <WorkingMemoryCard key={e.id} entry={e} />)
        )}
      </div>
    </div>
  );
}
