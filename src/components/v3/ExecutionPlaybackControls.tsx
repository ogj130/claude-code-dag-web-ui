/**
 * ExecutionPlaybackControls — 流程执行控制栏
 * Extracted from FlowExecutionView.tsx
 */

import { BUILTIN_TEMPLATES } from './FlowTemplates';

export interface ExecutionPlaybackControlsProps {
  templateId: string;
  onTemplateChange: (id: string) => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  isPlaying: boolean;
  isComplete: boolean;
  hasFailed: boolean;
  onPlayPause: () => void;
  onStepForward: () => void;
  onReset: () => void;
}

export function ExecutionPlaybackControls({
  templateId,
  onTemplateChange,
  speed,
  onSpeedChange,
  isPlaying,
  isComplete,
  hasFailed,
  onPlayPause,
  onStepForward,
  onReset,
}: ExecutionPlaybackControlsProps) {
  const playDisabled = isComplete && !hasFailed;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 16px',
      background: 'rgba(17,24,39,0.9)',
      borderBottom: '1px solid rgba(255,255,255,0.1)',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#fff' }}>执行视图</h3>
        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)' }} />
        <label style={{ fontSize: 10, color: '#6B7280' }}>模板</label>
        <select
          value={templateId}
          onChange={(e) => onTemplateChange(e.target.value)}
          style={{
            background: '#1E293B',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 4,
            padding: '4px 8px',
            fontSize: 10,
            color: '#CBD5E1',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        >
          {BUILTIN_TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* 速度控制 */}
        <label style={{ fontSize: 10, color: '#6B7280' }}>速度</label>
        <select
          value={speed}
          onChange={(e) => onSpeedChange(Number(e.target.value))}
          style={{
            background: '#1E293B',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 4,
            padding: '4px 8px',
            fontSize: 10,
            color: '#CBD5E1',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        >
          <option value={500}>快 (0.5s)</option>
          <option value={1000}>正常 (1s)</option>
          <option value={2000}>慢 (2s)</option>
        </select>
        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)' }} />
        <button
          onClick={onPlayPause}
          disabled={playDisabled}
          style={{
            padding: '4px 12px',
            fontSize: 10,
            borderRadius: 4,
            cursor: playDisabled ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            opacity: playDisabled ? 0.3 : 1,
            transition: 'all 0.15s ease-out',
            background: 'rgba(59,130,246,0.1)',
            color: '#60A5FA',
            border: 'none',
          }}
          onMouseEnter={e => { if (!playDisabled) e.currentTarget.style.background = 'rgba(59,130,246,0.2)'; }}
          onMouseLeave={e => { if (!playDisabled) e.currentTarget.style.background = 'rgba(59,130,246,0.1)'; }}
        >
          {isPlaying ? '\u23F8 暂停' : '\u25B6 播放'}
        </button>
        <button
          onClick={onStepForward}
          disabled={isPlaying || isComplete}
          style={{
            padding: '4px 8px',
            fontSize: 10,
            color: isPlaying || isComplete ? 'rgba(156,163,175,0.3)' : '#9CA3AF',
            background: isPlaying || isComplete ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.05)',
            borderRadius: 4,
            cursor: (isPlaying || isComplete) ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            border: 'none',
            transition: 'all 0.15s ease-out',
          }}
          onMouseEnter={e => { if (!isPlaying && !isComplete) e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
          onMouseLeave={e => { if (!isPlaying && !isComplete) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
        >
          步进
        </button>
        <button
          onClick={onReset}
          style={{
            padding: '4px 8px',
            fontSize: 10,
            color: '#9CA3AF',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: 4,
            cursor: 'pointer',
            fontFamily: 'inherit',
            border: 'none',
            transition: 'all 0.15s ease-out',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#CBD5E1'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#9CA3AF'; }}
        >
          重置
        </button>
      </div>
    </div>
  );
}
