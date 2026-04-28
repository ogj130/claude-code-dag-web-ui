/**
 * VoiceInputButton — 语音输入按钮
 *
 * 录音 → 语音转文字 → 发送/执行。
 * 支持实时录音动画、转写状态展示、语音命令检测。
 * 所有样式使用内联 style + CSS 变量（本项目未安装 Tailwind CSS）。
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { stt, tts } from '../../services/voiceService';
import { mapVoiceCommand, type VoiceCommand } from '../../services/voiceCommandMapper';

// ── 类型定义 ────────────────────────────────────────────────

export type VoiceState = 'idle' | 'recording' | 'transcribing' | 'error';

export interface VoiceInputButtonProps {
  onTranscription: (text: string) => void;
  onVoiceCommand?: (command: VoiceCommand) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  language?: string;
  speakResult?: boolean;
  className?: string;
}

const SIZE_MAP: Record<string, { button: number; icon: number }> = {
  sm: { button: 36, icon: 16 },
  md: { button: 56, icon: 24 },
  lg: { button: 80, icon: 36 },
};

// ── 录音波形 ────────────────────────────────────────────────

function RecordingWaveform({ size }: { size: 'sm' | 'md' | 'lg' }) {
  const barCount = size === 'sm' ? 3 : size === 'md' ? 5 : 7;
  const barHeight = size === 'sm' ? 8 : size === 'md' ? 14 : 20;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      height: barHeight + 4,
    }}>
      {Array.from({ length: barCount }).map((_, i) => (
        <div
          key={i}
          className="v3-voice-wave-bar"
          style={{
            width: 2.5,
            background: '#F87171',
            borderRadius: '50%',
            height: `${barHeight * (0.35 + Math.random() * 0.65)}px`,
            animation: `voiceWave 0.6s ease-in-out ${i * 0.08}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

// ── 图标 ────────────────────────────────────────────────────

function MicIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function SpinnerIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="v3-spin-anim">
      <circle className="v3-spin-opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="v3-spin-opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function ErrorIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

// ── 主组件 ──────────────────────────────────────────────────

export default function VoiceInputButton({
  onTranscription,
  onVoiceCommand,
  disabled = false,
  size = 'md',
  language = 'zh-CN',
  speakResult = false,
}: VoiceInputButtonProps) {
  const { t } = useTranslation();
  const [state, setState] = useState<VoiceState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const sizeConfig = SIZE_MAP[size];

  // ── 录音 ──

  const handleTranscription = useCallback(
    (text: string) => {
      onTranscription(text);
      const cmd = mapVoiceCommand(text);
      if (cmd.action !== 'unknown') onVoiceCommand?.(cmd);
      if (speakResult && tts.isAvailable) tts.speak(text).catch(() => {});
    },
    [onTranscription, onVoiceCommand, speakResult]
  );

  const startRecording = useCallback(async () => {
    if (stt.isNativeAvailable) {
      try {
        setState('recording');
        const text = await stt.startNativeRecognition({ language });
        if (text) handleTranscription(text);
        setState('idle');
        return;
      } catch { /* fall through */ }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size === 0) { setState('idle'); return; }
        setState('transcribing');
        try {
          const text = await stt.transcribeWithWhisper(blob, { language });
          if (text) handleTranscription(text);
        } catch (err) {
          setErrorMsg(err instanceof Error ? err.message : t('voice.transcribe_failed'));
          setState('error');
          setTimeout(() => setState('idle'), 3000);
          return;
        }
        setState('idle');
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setState('recording');
    } catch {
      setErrorMsg(t('voice.mic_denied'));
      setState('error');
      setTimeout(() => setState('idle'), 3000);
    }
  }, [language, t, handleTranscription]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
  }, []);

  const handleClick = useCallback(() => {
    if (state === 'recording') stopRecording();
    else if (state === 'idle' || state === 'error') startRecording();
  }, [state, startRecording, stopRecording]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
      tts.stop();
    };
  }, []);

  // ── 状态样式 ──

  const isUnavailable = disabled || (!stt.isNativeAvailable && typeof navigator !== 'undefined' && !navigator.mediaDevices);
  const btnSize = sizeConfig.button;

  const getButtonStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      width: btnSize,
      height: btnSize,
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: '1px solid',
      cursor: isUnavailable || state === 'transcribing' ? 'default' : 'pointer',
      position: 'relative',
      zIndex: 10,
      fontFamily: 'inherit',
      transition: 'all 0.2s ease-out',
      opacity: isUnavailable ? 0.3 : 1,
    };

    switch (state) {
      case 'recording':
        return {
          ...base,
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.25) 0%, rgba(220, 38, 38, 0.1) 100%)',
          borderColor: 'rgba(248, 113, 113, 0.5)',
          color: '#F87171',
          boxShadow: '0 0 24px rgba(239, 68, 68, 0.35), 0 0 0 4px rgba(239, 68, 68, 0.15)',
        };
      case 'transcribing':
        return {
          ...base,
          background: 'linear-gradient(135deg, var(--accent-dim) 0%, rgba(59, 130, 246, 0.1) 100%)',
          borderColor: 'var(--accent)',
          color: 'var(--accent)',
          cursor: 'wait',
          boxShadow: '0 0 24px var(--accent-dim), 0 0 0 4px rgba(59, 130, 246, 0.12)',
        };
      case 'error':
        return {
          ...base,
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(225, 29, 72, 0.1) 100%)',
          borderColor: 'rgba(248, 113, 113, 0.4)',
          color: '#F87171',
        };
      default: // idle
        return {
          ...base,
          background: 'linear-gradient(135deg, var(--accent-dim) 0%, transparent 100%)',
          borderColor: 'var(--accent)',
          color: 'var(--text-muted)',
          boxShadow: '0 0 20px rgba(59, 130, 246, 0.08)',
        };
    }
  };

  const stateLabel = state === 'recording'
    ? t('voice.state_recording', '录音中 • 点击停止')
    : state === 'transcribing'
      ? t('voice.state_transcribing', '正在转写...')
      : state === 'error'
        ? errorMsg
        : t('voice.state_idle', '点击开始语音输入');

  const stateLabelColor = state === 'recording'
    ? '#F87171'
    : state === 'transcribing'
      ? 'var(--accent)'
      : state === 'error'
        ? '#F87171'
        : 'var(--text-muted)';

  return (
    <div style={{
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 16,
    }}>
      {/* Breathing ring (idle) */}
      {state === 'idle' && !isUnavailable && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <div className="v3-breathing-ring" style={{
            width: btnSize + 56,
            height: btnSize + 56,
            borderRadius: '50%',
            border: '1px solid var(--accent)',
            opacity: 0.4,
            animation: 'ping 3s ease-in-out infinite',
          }} />
        </div>
      )}

      {/* Recording ripple */}
      {state === 'recording' && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="v3-ripple-ring"
              style={{
                position: 'absolute',
                width: btnSize + 40,
                height: btnSize + 40,
                borderRadius: '50%',
                border: '1px solid rgba(248, 113, 113, 0.3)',
                animation: `rippleExpand 1.8s ease-out ${i * 0.6}s infinite`,
              }}
            />
          ))}
        </div>
      )}

      {/* Button */}
      <button
        onClick={handleClick}
        disabled={isUnavailable || state === 'transcribing'}
        title={isUnavailable ? t('voice.unavailable') : t(`voice.${state === 'recording' ? 'stop_recording' : 'start_recording'}`)}
        style={getButtonStyle()}
        onMouseEnter={e => {
          if (state === 'idle' && !isUnavailable) {
            e.currentTarget.style.color = 'var(--accent)';
            e.currentTarget.style.borderColor = 'var(--accent)';
            e.currentTarget.style.boxShadow = '0 0 28px rgba(59, 130, 246, 0.15)';
          }
        }}
        onMouseLeave={e => {
          if (state === 'idle' && !isUnavailable) {
            e.currentTarget.style.color = 'var(--text-muted)';
            e.currentTarget.style.borderColor = 'var(--accent)';
            e.currentTarget.style.boxShadow = '0 0 20px rgba(59, 130, 246, 0.08)';
          }
        }}
      >
        {state === 'idle' && <MicIcon size={sizeConfig.icon} />}
        {state === 'recording' && <RecordingWaveform size={size} />}
        {state === 'transcribing' && <SpinnerIcon size={sizeConfig.icon} />}
        {state === 'error' && <ErrorIcon size={sizeConfig.icon} />}
      </button>

      {/* State label */}
      <span style={{
        fontSize: 12,
        color: stateLabelColor,
        transition: 'all 0.3s ease-out',
        textAlign: 'center',
        maxWidth: 180,
        lineHeight: 1.5,
      }}>
        {stateLabel}
      </span>

      {/* Recording indicator */}
      {state === 'recording' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 10,
          color: 'rgba(248, 113, 113, 0.7)',
        }}>
          <span className="v3-rec-dot" style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#F87171',
            animation: 'pulseDot 1.2s ease-in-out infinite',
          }} />
          <span>REC</span>
        </div>
      )}
    </div>
  );
}
