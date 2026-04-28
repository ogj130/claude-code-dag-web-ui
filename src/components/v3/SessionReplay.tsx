/**
 * SessionReplay — 对话回放
 *
 * 时间线 + 播放/暂停/步进，支持标注。
 * 所有样式使用内联 style + CSS 变量（本项目未安装 Tailwind CSS）。
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { getQueriesBySession } from '../../stores/queryStorage';
import { useSessionStore } from '../../stores/useSessionStore';

// ── 类型 ────────────────────────────────────────────────────

interface ReplayEvent {
  id: string;
  timestamp: number;
  type: 'user_input' | 'agent_response' | 'tool_call' | 'decision' | 'error';
  content: string;
  metadata?: Record<string, unknown>;
}

interface Annotation {
  eventId: string;
  text: string;
  author: string;
  timestamp: number;
}

// ── 真实数据 Hook ────────────────────────────────────────────

function useReplayEvents(): ReplayEvent[] {
  const activeSessionId = useSessionStore(s => s.activeSessionId);
  const [events, setEvents] = useState<ReplayEvent[]>([]);

  useEffect(() => {
    if (!activeSessionId) return;
    getQueriesBySession(activeSessionId).then(result => {
      const queries = result.items;
      const mapped: ReplayEvent[] = queries.map(q => ({
        id: `q_${q.id}`,
        timestamp: q.timestamp || Date.now(),
        type: 'user_input' as const,
        content: q.query || '',
        metadata: q.metadata ? (() => { try { return JSON.parse(q.metadata); } catch { return undefined; } })() : undefined,
      }));
      setEvents(mapped);
    }).catch(() => {
      setEvents([]);
    });
  }, [activeSessionId]);

  return events;
}

// ── 事件类型样式 ────────────────────────────────────────────

const EVENT_STYLES: Record<ReplayEvent['type'], { icon: string; color: string }> = {
  user_input: { icon: '👤', color: '#60A5FA' },
  agent_response: { icon: '🤖', color: '#34D399' },
  tool_call: { icon: '🔧', color: '#A78BFA' },
  decision: { icon: '💡', color: '#FBBF24' },
  error: { icon: '✗', color: '#F87171' },
};

// ── 播放控制 ────────────────────────────────────────────────

function PlaybackControls({
  isPlaying,
  currentIndex,
  totalEvents,
  onPlay,
  onPause,
  onStepForward,
  onStepBack,
  onReset,
}: {
  isPlaying: boolean;
  currentIndex: number;
  totalEvents: number;
  onPlay: () => void;
  onPause: () => void;
  onStepForward: () => void;
  onStepBack: () => void;
  onReset: () => void;
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: 8,
      border: '1px solid rgba(148, 163, 184, 0.12)',
      background: 'rgba(30, 41, 59, 0.3)',
      marginBottom: 12,
    }}>
      <button onClick={onReset} style={{ fontSize: 12, color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
        onMouseEnter={e => { e.currentTarget.style.color = '#CBD5E1'; }}
        onMouseLeave={e => { e.currentTarget.style.color = '#94A3B8'; }}
        title="重置">⏮</button>
      <button onClick={onStepBack} style={{ fontSize: 12, color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
        onMouseEnter={e => { e.currentTarget.style.color = '#CBD5E1'; }}
        onMouseLeave={e => { e.currentTarget.style.color = '#94A3B8'; }}
        title="上一步">◀</button>
      {isPlaying ? (
        <button onClick={onPause} style={{ fontSize: 14, color: '#60A5FA', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          title="暂停">⏸</button>
      ) : (
        <button onClick={onPlay} style={{ fontSize: 14, color: '#60A5FA', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          title="播放">▶</button>
      )}
      <button onClick={onStepForward} style={{ fontSize: 12, color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
        onMouseEnter={e => { e.currentTarget.style.color = '#CBD5E1'; }}
        onMouseLeave={e => { e.currentTarget.style.color = '#94A3B8'; }}
        title="下一步">▶</button>

      <div style={{
        flex: 1,
        height: 4,
        borderRadius: 2,
        background: 'rgba(148, 163, 184, 0.15)',
        margin: '0 8px',
      }}>
        <div style={{
          height: '100%',
          borderRadius: 2,
          background: '#3B82F6',
          width: `${((currentIndex + 1) / totalEvents) * 100}%`,
          transition: 'width 0.3s ease-out',
        }} />
      </div>

      <span style={{ fontSize: 10, color: '#64748B' }}>
        {currentIndex + 1} / {totalEvents}
      </span>
    </div>
  );
}

// ── 事件节点 ────────────────────────────────────────────────

function EventNode({
  event,
  isActive,
  isPast,
  annotation,
  onAnnotate,
}: {
  event: ReplayEvent;
  isActive: boolean;
  isPast: boolean;
  annotation?: Annotation;
  onAnnotate: (eventId: string) => void;
}) {
  const style = EVENT_STYLES[event.type];

  return (
    <div className="v3-replay-event" style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      transition: 'all 0.3s ease-out',
      opacity: isPast ? 1 : 0.3,
    }}>
      {/* 时间线 */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 24, flexShrink: 0 }}>
        <div style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          border: '2px solid',
          borderColor: isActive ? '#60A5FA' : isPast ? '#34D399' : '#475569',
          background: isActive ? '#3B82F6' : isPast ? '#34D399' : 'transparent',
        }} />
        <div style={{ width: 1, height: '100%', background: 'rgba(148, 163, 184, 0.15)', marginTop: 4 }} />
      </div>

      {/* 内容 */}
      <div style={{
        flex: 1,
        paddingBottom: 16,
        ...(isActive ? {
          background: 'rgba(59, 130, 246, 0.05)',
          margin: '-8px',
          padding: '8px 10px',
          borderRadius: 8,
          border: '1px solid rgba(59, 130, 246, 0.2)',
        } : {}),
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 14 }}>{style.icon}</span>
          <span style={{ fontSize: 10, fontWeight: 500, color: style.color }}>{event.type}</span>
          <span style={{ fontSize: 10, color: '#475569' }}>
            {new Date(event.timestamp).toLocaleTimeString()}
          </span>
          <button
            onClick={() => onAnnotate(event.id)}
            style={{
              opacity: 0,
              fontSize: 10,
              color: '#64748B',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              marginLeft: 'auto',
              transition: 'opacity 0.15s ease-out',
            }}
            className="v3-replay-annotate-btn"
            onMouseEnter={e => { e.currentTarget.style.color = '#94A3B8'; }}
          >
            📝
          </button>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: '#CBD5E1' }}>{event.content}</p>

        {/* 标注 */}
        {annotation && (
          <div style={{
            marginTop: 6,
            padding: 8,
            borderRadius: 6,
            background: 'rgba(251, 191, 36, 0.05)',
            border: '1px solid rgba(251, 191, 36, 0.15)',
          }}>
            <span style={{ fontSize: 10, color: '#FBBF24' }}>📝 {annotation.author}：</span>
            <span style={{ fontSize: 10, color: '#94A3B8' }}>{annotation.text}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 主组件 ──────────────────────────────────────────────────

export interface SessionReplayProps {
  className?: string;
}

export default function SessionReplay({}: SessionReplayProps) {
  const events = useReplayEvents();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [annotatingEvent, setAnnotatingEvent] = useState<string | null>(null);
  const [annotationText, setAnnotationText] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  // 播放逻辑
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev >= events.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1500);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isPlaying, events.length]);

  const handlePlay = useCallback(() => setIsPlaying(true), []);
  const handlePause = useCallback(() => setIsPlaying(false), []);
  const handleStepForward = useCallback(() => {
    setIsPlaying(false);
    setCurrentIndex((prev) => Math.min(prev + 1, events.length - 1));
  }, [events.length]);
  const handleStepBack = useCallback(() => {
    setIsPlaying(false);
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  }, []);
  const handleReset = useCallback(() => {
    setIsPlaying(false);
    setCurrentIndex(0);
  }, []);

  const handleAnnotate = useCallback((eventId: string) => {
    setAnnotatingEvent(eventId);
    setAnnotationText('');
  }, []);

  const handleSubmitAnnotation = useCallback(() => {
    if (annotatingEvent && annotationText) {
      setAnnotations((prev) => [
        ...prev,
        { eventId: annotatingEvent, text: annotationText, author: '哈雷酱', timestamp: Date.now() },
      ]);
      setAnnotatingEvent(null);
      setAnnotationText('');
    }
  }, [annotatingEvent, annotationText]);

  const handleExport = useCallback(() => {
    const data = { events, annotations, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-replay-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [events, annotations]);

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 500, color: '#CBD5E1' }}>对话回放</h3>
        <button
          onClick={handleExport}
          style={{
            fontSize: 10,
            padding: '4px 8px',
            borderRadius: 6,
            background: 'rgba(148, 163, 184, 0.07)',
            color: '#94A3B8',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'all 0.15s ease-out',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(148, 163, 184, 0.15)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(148, 163, 184, 0.07)'; }}
        >
          导出 JSON
        </button>
      </div>

      <PlaybackControls
        isPlaying={isPlaying}
        currentIndex={currentIndex}
        totalEvents={events.length}
        onPlay={handlePlay}
        onPause={handlePause}
        onStepForward={handleStepForward}
        onStepBack={handleStepBack}
        onReset={handleReset}
      />

      {/* 标注输入 */}
      {annotatingEvent && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
          padding: 8,
          borderRadius: 6,
          background: 'rgba(251, 191, 36, 0.05)',
          border: '1px solid rgba(251, 191, 36, 0.15)',
        }}>
          <input
            type="text"
            value={annotationText}
            onChange={(e) => setAnnotationText(e.target.value)}
            placeholder="添加标注..."
            style={{
              flex: 1,
              fontSize: 12,
              padding: '4px 8px',
              borderRadius: 6,
              background: '#1E293B',
              border: '1px solid rgba(148, 163, 184, 0.12)',
              color: '#CBD5E1',
              fontFamily: 'inherit',
              outline: 'none',
            }}
            autoFocus
          />
          <button
            onClick={handleSubmitAnnotation}
            disabled={!annotationText}
            style={{
              fontSize: 10,
              color: '#60A5FA',
              background: 'none',
              border: 'none',
              cursor: !annotationText ? 'default' : 'pointer',
              fontFamily: 'inherit',
              opacity: !annotationText ? 0.5 : 1,
            }}
          >
            保存
          </button>
          <button
            onClick={() => setAnnotatingEvent(null)}
            style={{
              fontSize: 10,
              color: '#64748B',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            取消
          </button>
        </div>
      )}

      {/* 事件时间线 */}
      <div>
        {events.map((event, i) => (
          <EventNode
            key={event.id}
            event={event}
            isActive={i === currentIndex}
            isPast={i <= currentIndex}
            annotation={annotations.find((a) => a.eventId === event.id)}
            onAnnotate={handleAnnotate}
          />
        ))}
      </div>
    </div>
  );
}
