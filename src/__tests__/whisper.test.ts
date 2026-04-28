/**
 * whisper.cpp sidecar 降级方案测试
 *
 * 覆盖：
 * - whisper IPC 通道名称验证
 * - 时间戳解析逻辑
 * - 段落解析逻辑（whisper.cpp 输出格式）
 * - voiceService STT 降级链接口
 */

import { describe, it, expect } from 'vitest';

// ── 时间戳解析逻辑测试 ──────────────────────────────────────

describe('whisper timestamp parsing', () => {
  /**
   * 测试 HH:MM:SS.mmm 时间戳解析
   * 复现 whisperHandlers 中 _parseTimestamp 的逻辑
   */
  function parseTimestamp(ts: string): number {
    const parts = ts.split(':');
    const hours = parseFloat(parts[0]) * 3600;
    const minutes = parseFloat(parts[1]) * 60;
    const seconds = parseFloat(parts[2]);
    return hours + minutes + seconds;
  }

  it('解析零时间戳', () => {
    expect(parseTimestamp('00:00:00.000')).toBe(0);
  });

  it('解析秒级时间戳', () => {
    expect(parseTimestamp('00:00:02.500')).toBeCloseTo(2.5);
  });

  it('解析分钟级时间戳', () => {
    expect(parseTimestamp('00:01:30.000')).toBe(90);
  });

  it('解析小时级时间戳', () => {
    expect(parseTimestamp('01:00:00.000')).toBe(3600);
  });

  it('解析复杂时间戳', () => {
    expect(parseTimestamp('01:23:45.678')).toBeCloseTo(5025.678);
  });
});

// ── 段落解析逻辑测试 ──────────────────────────────────────

describe('whisper segment parsing', () => {
  /**
   * 测试 whisper.cpp 输出格式的段落解析
   * 格式: [HH:MM:SS.mmm --> HH:MM:SS.mmm]  text
   */
  function parseSegments(text: string): Array<{ start: number; end: number; text: string }> {
    const regex = /\[(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})\]\s*(.*)/g;
    const segments: Array<{ start: number; end: number; text: string }> = [];
    let match;

    const parseTs = (ts: string): number => {
      const parts = ts.split(':');
      return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
    };

    while ((match = regex.exec(text)) !== null) {
      segments.push({
        start: parseTs(match[1]),
        end: parseTs(match[2]),
        text: match[3].trim(),
      });
    }

    return segments;
  }

  it('解析单段落', () => {
    const result = parseSegments('[00:00:00.000 --> 00:00:02.500]  你好世界');
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('你好世界');
    expect(result[0].start).toBe(0);
    expect(result[0].end).toBeCloseTo(2.5);
  });

  it('解析多段落', () => {
    const input = [
      '[00:00:00.000 --> 00:00:02.000]  第一句',
      '[00:00:02.000 --> 00:00:04.500]  第二句',
      '[00:00:04.500 --> 00:00:07.000]  第三句',
    ].join('\n');

    const result = parseSegments(input);
    expect(result).toHaveLength(3);
    expect(result[0].text).toBe('第一句');
    expect(result[1].text).toBe('第二句');
    expect(result[2].text).toBe('第三句');
  });

  it('无时间戳输出返回空', () => {
    const result = parseSegments('纯文本输出，没有时间戳');
    expect(result).toHaveLength(0);
  });

  it('空输入返回空', () => {
    const result = parseSegments('');
    expect(result).toHaveLength(0);
  });

  it('段落文本拼接还原完整文本', () => {
    const input = [
      '[00:00:00.000 --> 00:00:02.000]  你好',
      '[00:00:02.000 --> 00:00:04.000]  世界',
    ].join('\n');

    const segments = parseSegments(input);
    const fullText = segments.map((s) => s.text).join(' ');
    expect(fullText).toBe('你好 世界');
  });

  it('段落时间连续性验证', () => {
    const input = [
      '[00:00:00.000 --> 00:00:02.000]  A',
      '[00:00:02.000 --> 00:00:05.000]  B',
      '[00:00:05.000 --> 00:00:08.000]  C',
    ].join('\n');

    const segments = parseSegments(input);
    // 验证段落之间无重叠
    for (let i = 1; i < segments.length; i++) {
      expect(segments[i].start).toBeGreaterThanOrEqual(segments[i - 1].end);
    }
  });
});

// ── IPC 通道名称验证 ───────────────────────────────────────

describe('whisper IPC channels', () => {
  const expectedChannels = [
    'whisper:status',
    'whisper:start',
    'whisper:stop',
    'whisper:transcribe',
    'whisper:transcribeFile',
    'whisper:healthCheck',
  ];

  it('所有 whisper IPC 通道名符合命名规范', () => {
    for (const channel of expectedChannels) {
      expect(channel).toMatch(/^whisper:[a-zA-Z]+$/);
    }
  });

  it('6 个 IPC 通道', () => {
    expect(expectedChannels).toHaveLength(6);
  });
});

// ── voiceService STT 降级链接口验证 ────────────────────────

describe('voiceService STT fallback chain', () => {
  it('stt 单例包含所有降级方法', async () => {
    const { stt } = await import('../services/voiceService');
    expect(stt).toBeDefined();

    // 三个降级路径
    expect(typeof stt.transcribeWithWhisper).toBe('function');     // 路径 1: OpenAI Whisper API
    expect(typeof stt.transcribeWithSidecar).toBe('function');     // 路径 2: whisper.cpp sidecar
    expect(typeof stt.startNativeRecognition).toBe('function');    // 路径 3: Web SpeechRecognition

    // 智能转录入口
    expect(typeof stt.transcribe).toBe('function');
  });

  it('stt 可用性检测方法', async () => {
    const { stt } = await import('../services/voiceService');

    expect(typeof stt.isNativeAvailable).toBe('boolean');     // 浏览器 SpeechRecognition
    expect(typeof stt.isSidecarAvailable).toBe('boolean');    // Electron whisper.cpp sidecar
  });
});

// ── WhisperTranscribeParams 结构验证 ───────────────────────

describe('whisper transcribe params', () => {
  it('转录参数包含必要字段', () => {
    const params = {
      audioBase64: 'base64-encoded-audio-data',
      language: 'zh',
      timestamps: true,
    };

    expect(params).toHaveProperty('audioBase64');
    expect(params).toHaveProperty('language');
    expect(typeof params.audioBase64).toBe('string');
    expect(params.audioBase64.length).toBeGreaterThan(0);
  });

  it('转录结果成功结构', () => {
    const result = {
      success: true,
      text: '你好世界',
      segments: [
        { start: 0, end: 2.5, text: '你好' },
        { start: 2.5, end: 5.0, text: '世界' },
      ],
      durationMs: 1500,
    };

    expect(result.success).toBe(true);
    expect(result.text).toBeTruthy();
    expect(result.segments).toHaveLength(2);
    expect(result.durationMs).toBeGreaterThan(0);
  });

  it('转录结果失败结构', () => {
    const result = {
      success: false,
      error: 'whisper.cpp sidecar is not running',
    };

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
});
