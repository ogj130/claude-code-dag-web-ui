/**
 * voiceService — 语音输入/输出服务
 *
 * TTS (Text-to-Speech): Web Speech API SpeechSynthesis
 * STT (Speech-to-Text):
 *   1. OpenAI Whisper API (主路径 — 精度最高)
 *   2. whisper.cpp sidecar (降级路径 — 离线可用)
 *   3. Web SpeechRecognition (兜底路径 — 浏览器原生)
 *
 * 使用方式：
 *   import { tts, stt } from '@/services/voiceService';
 *   await tts.speak('Hello');
 *   const text = await stt.transcribe(audioBlob);
 */

// ── TTS: Web Speech API ──────────────────────────────────

export interface TTSOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
}

class TTSService {
  private synth: SpeechSynthesis | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
    }
  }

  get isAvailable(): boolean {
    return this.synth !== null;
  }

  /**
   * 朗读文本
   */
  speak(text: string, options: TTSOptions = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.synth) {
        reject(new Error('SpeechSynthesis not available'));
        return;
      }

      // 取消当前朗读
      this.synth.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = options.lang ?? 'zh-CN';
      utterance.rate = options.rate ?? 1.0;
      utterance.pitch = options.pitch ?? 1.0;
      utterance.volume = options.volume ?? 1.0;

      utterance.onend = () => resolve();
      utterance.onerror = (e) => reject(new Error(`TTS error: ${e.error}`));

      this.synth.speak(utterance);
    });
  }

  /**
   * 停止朗读
   */
  stop(): void {
    this.synth?.cancel();
  }

  /**
   * 获取可用的语音列表
   */
  getVoices(lang?: string): SpeechSynthesisVoice[] {
    if (!this.synth) return [];
    const voices = this.synth.getVoices();
    if (lang) {
      return voices.filter((v) => v.lang.startsWith(lang));
    }
    return voices;
  }
}

// ── STT: 语音识别 ─────────────────────────────────────────

export interface STTOptions {
  language?: string;
  /** Whisper API Key（如不传，从 localStorage 读取） */
  apiKey?: string;
}

class STTService {
  /**
   * 检查浏览器原生语音识别是否可用
   */
  get isNativeAvailable(): boolean {
    return typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  }

  /**
   * 检查 whisper.cpp sidecar 是否可用（Electron 环境）
   */
  get isSidecarAvailable(): boolean {
    return typeof window !== 'undefined' && !!(window as any).electron?.invoke;
  }

  /**
   * 使用 whisper.cpp sidecar 转录音频（Electron 降级路径）
   *
   * 通过 IPC 调用主进程的 whisper.cpp 子进程进行离线转录。
   */
  async transcribeWithSidecar(
    audioBlob: Blob,
    options: STTOptions = {}
  ): Promise<string> {
    const electron = (window as any).electron;
    if (!electron?.invoke) {
      throw new Error('Electron IPC not available — whisper.cpp sidecar requires Electron environment');
    }

    // 检查 sidecar 是否可用
    const status = await electron.invoke('whisper:status');
    if (!status.available) {
      throw new Error('whisper.cpp sidecar not available: ' + (status.error ?? 'binary or model not found'));
    }

    // 确保 sidecar 正在运行
    if (!status.running) {
      const startResult = await electron.invoke('whisper:start');
      if (!startResult.success) {
        throw new Error('Failed to start whisper.cpp sidecar: ' + startResult.error);
      }
    }

    // 将 Blob 转为 base64
    const arrayBuffer = await audioBlob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const base64 = btoa(String.fromCharCode(...uint8Array));

    // 调用 IPC 转录
    const result = await electron.invoke('whisper:transcribe', {
      audioBase64: base64,
      language: options.language ?? 'zh',
    });

    if (!result.success) {
      throw new Error('whisper.cpp transcription failed: ' + (result.error ?? 'unknown'));
    }

    return result.text ?? '';
  }

  /**
   * 使用浏览器原生 SpeechRecognition（实时识别）
   *
   * 返回识别结果文本。适合短命令。
   */
  startNativeRecognition(options: STTOptions = {}): Promise<string> {
    return new Promise((resolve, reject) => {
      const SpeechRecognition =
        (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;

      if (!SpeechRecognition) {
        reject(new Error('SpeechRecognition not available'));
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.lang = options.language ?? 'zh-CN';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        const text = event.results[0]?.[0]?.transcript ?? '';
        resolve(text);
      };

      recognition.onerror = (event: any) => {
        reject(new Error(`STT error: ${event.error}`));
      };

      recognition.onend = () => {
        // 如果没有触发 onresult，resolve 空字符串
        resolve('');
      };

      recognition.start();
    });
  }

  /**
   * 使用 OpenAI Whisper API 转录音频
   *
   * 主路径：精度更高，支持更长的音频。
   */
  async transcribeWithWhisper(
    audioBlob: Blob,
    options: STTOptions = {}
  ): Promise<string> {
    const apiKey = options.apiKey ?? localStorage.getItem('openai-api-key');
    if (!apiKey) {
      throw new Error('OpenAI API key not found. Set it in Settings or pass via options.');
    }

    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', options.language ?? 'zh');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Whisper API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.text ?? '';
  }

  /**
   * 智能转录 — 自动选择最佳可用路径
   *
   * 降级策略：
   *   1. OpenAI Whisper API（在线，精度最高）
   *   2. whisper.cpp sidecar（离线，精度高）
   *   3. Web SpeechRecognition（兜底，精度一般）
   *
   * @param audioBlob 音频数据
   * @param options 选项
   * @returns 转录文本
   */
  async transcribe(
    audioBlob: Blob,
    options: STTOptions = {}
  ): Promise<{ text: string; method: 'whisper-api' | 'whisper-sidecar' | 'speech-recognition' }> {
    // 路径 1：OpenAI Whisper API
    try {
      const apiKey = options.apiKey ?? localStorage.getItem('openai-api-key');
      if (apiKey) {
        const text = await this.transcribeWithWhisper(audioBlob, options);
        if (text.trim()) {
          return { text, method: 'whisper-api' };
        }
      }
    } catch (err) {
      console.warn('[STT] Whisper API failed, trying sidecar:', (err as Error).message);
    }

    // 路径 2：whisper.cpp sidecar（仅 Electron 环境）
    try {
      if (this.isSidecarAvailable) {
        const text = await this.transcribeWithSidecar(audioBlob, options);
        if (text.trim()) {
          return { text, method: 'whisper-sidecar' };
        }
      }
    } catch (err) {
      console.warn('[STT] whisper.cpp sidecar failed, trying SpeechRecognition:', (err as Error).message);
    }

    // 路径 3：Web SpeechRecognition（兜底）
    try {
      if (this.isNativeAvailable) {
        const text = await this.startNativeRecognition(options);
        if (text.trim()) {
          return { text, method: 'speech-recognition' };
        }
      }
    } catch (err) {
      console.warn('[STT] SpeechRecognition also failed:', (err as Error).message);
    }

    throw new Error('All STT methods failed. Please check your audio input and try again.');
  }
}

// ── 导出单例 ──────────────────────────────────────────────

export const tts = new TTSService();
export const stt = new STTService();
