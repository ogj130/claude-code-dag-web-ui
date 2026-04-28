/**
 * Whisper.cpp Sidecar IPC Handlers
 *
 * 管理 whisper.cpp 作为 sidecar 子进程的生命周期：
 * - 自动检测/启动 whisper.cpp 二进制
 * - 发送音频数据进行转录
 * - 健康检查和状态查询
 * - 优雅关闭
 *
 * 渲染进程通过 window.electron.invoke('whisper:*', params) 调用。
 *
 * 降级策略：
 *   OpenAI Whisper API (主路径) → whisper.cpp sidecar (降级) → Web SpeechRecognition (兜底)
 */

import { ipcMain } from 'electron';
import { spawn, type ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// ── 类型定义 ────────────────────────────────────────────────

export interface WhisperSidecarStatus {
  available: boolean;
  running: boolean;
  modelPath: string | null;
  binaryPath: string | null;
  pid: number | null;
  error: string | null;
}

export interface WhisperTranscribeParams {
  /** base64 编码的音频数据（WAV/PCM 16kHz mono） */
  audioBase64: string;
  /** 语言代码，默认 'zh' */
  language?: string;
  /** 是否输出段落时间戳 */
  timestamps?: boolean;
}

export interface WhisperTranscribeResult {
  success: boolean;
  text?: string;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
  durationMs?: number;
  error?: string;
}

// ── Whisper Sidecar 管理器 ──────────────────────────────────

class WhisperSidecarManager {
  private _process: ChildProcess | null = null;
  private _binaryPath: string | null = null;
  private _modelPath: string | null = null;
  private _isReady = false;
  private _pendingRequests: Map<string, {
    resolve: (result: WhisperTranscribeResult) => void;
    reject: (err: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  private _stdoutBuffer = '';
  private _requestCounter = 0;

  constructor() {
    this._detectBinary();
    this._detectModel();
  }

  /**
   * 检测 whisper.cpp 二进制文件路径
   *
   * 优先级：
   * 1. 环境变量 WHISPER_CPP_PATH
   * 2. 应用 resources 目录
   * 3. 系统 PATH
   */
  private _detectBinary(): void {
    // 1. 环境变量
    if (process.env.WHISPER_CPP_PATH && fs.existsSync(process.env.WHISPER_CPP_PATH)) {
      this._binaryPath = process.env.WHISPER_CPP_PATH;
      return;
    }

    // 2. 应用 resources 目录（打包后）
    const isPackaged = !!(process as { resourcesPath?: string }).resourcesPath;
    if (isPackaged()) {
      const resPath = path.join(
        (process as { resourcesPath: string }).resourcesPath,
        'bin',
        process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli'
      );
      if (fs.existsSync(resPath)) {
        this._binaryPath = resPath;
        return;
      }
    }

    // 3. 开发模式 — 项目根目录的 bin 子目录
    const devBinPath = path.resolve(
      __dirname,
      '..', '..', '..', '..', 'bin',
      process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli'
    );
    if (fs.existsSync(devBinPath)) {
      this._binaryPath = devBinPath;
      return;
    }

    // 4. 系统 PATH（whisper-cli 或 main）
    this._binaryPath = this._findInPath('whisper-cli') ?? this._findInPath('main');
  }

  /**
   * 检测 whisper 模型文件
   */
  private _detectModel(): void {
    const modelNames = [
      'ggml-base.bin',
      'ggml-small.bin',
      'ggml-medium.bin',
      'ggml-tiny.bin',
    ];

    const searchPaths = [
      // 应用 resources 目录
      (process as { resourcesPath?: string }).resourcesPath
        ? path.join((process as { resourcesPath: string }).resourcesPath, 'models')
        : null,
      // 项目根目录
      path.resolve(__dirname, '..', '..', '..', '..', 'models'),
      // 用户 home 目录
      path.join(os.homedir(), '.whisper'),
      // 系统默认
      '/usr/local/share/whisper',
      '/opt/homebrew/share/whisper',
    ].filter(Boolean) as string[];

    for (const dir of searchPaths) {
      for (const name of modelNames) {
        const fullPath = path.join(dir, name);
        if (fs.existsSync(fullPath)) {
          this._modelPath = fullPath;
          return;
        }
      }
    }
  }

  /**
   * 在系统 PATH 中查找可执行文件
   */
  private _findInPath(name: string): string | null {
    const pathEnv = process.env.PATH ?? '';
    const dirs = pathEnv.split(path.delimiter);
    const ext = process.platform === 'win32' ? '.exe' : '';

    for (const dir of dirs) {
      const fullPath = path.join(dir, name + ext);
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
    }
    return null;
  }

  /**
   * whisper.cpp 二进制是否可用
   */
  get isAvailable(): boolean {
    return this._binaryPath !== null && this._modelPath !== null;
  }

  /**
   * sidecar 进程是否正在运行
   */
  get isRunning(): boolean {
    return this._process !== null && !this._process.killed;
  }

  /**
   * 获取当前状态
   */
  getStatus(): WhisperSidecarStatus {
    return {
      available: this.isAvailable,
      running: this.isRunning,
      modelPath: this._modelPath,
      binaryPath: this._binaryPath,
      pid: this._process?.pid ?? null,
      error: this.isAvailable ? null : 'whisper.cpp binary or model not found',
    };
  }

  /**
   * 启动 whisper.cpp sidecar 进程（server 模式）
   *
   * 使用 --host 127.0.0.1 --port 0 让 whisper.cpp 通过 stdin/stdout 通信
   */
  async start(): Promise<void> {
    if (this.isRunning) return;

    if (!this.isAvailable) {
      throw new Error(
        'whisper.cpp not available. Binary: ' + (this._binaryPath ?? 'not found') +
        ', Model: ' + (this._modelPath ?? 'not found')
      );
    }

    return new Promise<void>((resolve, reject) => {
      try {
        this._process = spawn(this._binaryPath!, [
          '-m', this._modelPath!,
          '-t', String(Math.max(1, Math.floor(os.cpus().length / 2))),
          '--no-prints',
          '--output-txt',
        ], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env },
        });

        this._stdoutBuffer = '';

        this._process.stdout?.on('data', (chunk: Buffer) => {
          this._stdoutBuffer += chunk.toString('utf-8');
          this._processStdoutBuffer();
        });

        this._process.stderr?.on('data', (_chunk: Buffer) => {
          // whisper.cpp 的日志输出在 stderr，忽略
        });

        this._process.on('error', (err) => {
          this._cleanup();
          reject(new Error(`Failed to start whisper.cpp: ${err.message}`));
        });

        this._process.on('exit', (code) => {
          this._isReady = false;
          this._cleanup();
          if (code !== null && code !== 0) {
            console.warn(`[Whisper] Sidecar exited with code ${code}`);
          }
        });

        // 等待进程就绪
        this._isReady = true;
        resolve();
      } catch (err) {
        this._cleanup();
        reject(err);
      }
    });
  }

  /**
   * 处理 stdout 缓冲区中的完整响应
   */
  private _processStdoutBuffer(): void {
    // whisper.cpp 输出以 JSON 行格式（或纯文本行）
    // 当我们收到完整的转录结果时，匹配对应的 pending request
    if (this._stdoutBuffer.includes('\n')) {
      const lines = this._stdoutBuffer.split('\n');
      this._stdoutBuffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) continue;
        this._resolveNextPending(line.trim());
      }
    }
  }

  /**
   * 解析并完成下一个待处理的转录请求
   */
  private _resolveNextPending(text: string): void {
    const entries = Array.from(this._pendingRequests.entries());
    if (entries.length === 0) return;

    const [id, pending] = entries[0];
    clearTimeout(pending.timeout);
    this._pendingRequests.delete(id);

    // 解析时间戳（如果有）
    const segments = this._parseSegments(text);

    pending.resolve({
      success: true,
      text: segments.length > 0
        ? segments.map((s) => s.text).join(' ')
        : text,
      segments: segments.length > 0 ? segments : undefined,
    });
  }

  /**
   * 解析 whisper.cpp 输出的时间戳段落
   *
   * 格式: [00:00:00.000 --> 00:00:02.500]  你好世界
   */
  private _parseSegments(text: string): Array<{ start: number; end: number; text: string }> {
    const regex = /\[(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})\]\s*(.*)/g;
    const segments: Array<{ start: number; end: number; text: string }> = [];
    let match;

    while ((match = regex.exec(text)) !== null) {
      segments.push({
        start: this._parseTimestamp(match[1]),
        end: this._parseTimestamp(match[2]),
        text: match[3].trim(),
      });
    }

    return segments;
  }

  /**
   * 解析 HH:MM:SS.mmm 时间戳为秒数
   */
  private _parseTimestamp(ts: string): number {
    const parts = ts.split(':');
    const hours = parseFloat(parts[0]) * 3600;
    const minutes = parseFloat(parts[1]) * 60;
    const seconds = parseFloat(parts[2]);
    return hours + minutes + seconds;
  }

  /**
   * 转录音频
   *
   * @param audioBase64 base64 编码的音频数据
   * @param language 语言代码（默认 'zh'）
   * @param timeoutMs 超时时间（默认 30 秒）
   */
  async transcribe(
    audioBase64: string,
    language = 'zh',
    timeoutMs = 30000
  ): Promise<WhisperTranscribeResult> {
    if (!this.isRunning) {
      return {
        success: false,
        error: 'whisper.cpp sidecar is not running',
      };
    }

    const id = `req_${++this._requestCounter}`;

    return new Promise<WhisperTranscribeResult>((resolve) => {
      const timeout = setTimeout(() => {
        this._pendingRequests.delete(id);
        resolve({
          success: false,
          error: `Transcription timeout after ${timeoutMs}ms`,
        });
      }, timeoutMs);

      this._pendingRequests.set(id, { resolve, reject: () => {}, timeout });

      // 将音频数据写入 stdin（base64 解码为二进制）
      try {
        const audioBuffer = Buffer.from(audioBase64, 'base64');
        this._process!.stdin?.write(audioBuffer);
        this._process!.stdin?.end();
      } catch (err) {
        clearTimeout(timeout);
        this._pendingRequests.delete(id);
        resolve({
          success: false,
          error: `Failed to write audio: ${(err as Error).message}`,
        });
      }
    });
  }

  /**
   * 直接使用文件路径转录（跳过 stdin，直接传文件）
   *
   * 这是更可靠的路径，适用于大多数场景
   */
  async transcribeFile(
    audioFilePath: string,
    language = 'zh',
    timeoutMs = 60000
  ): Promise<WhisperTranscribeResult> {
    if (!this.isAvailable) {
      return {
        success: false,
        error: 'whisper.cpp not available',
      };
    }

    const startTime = Date.now();

    return new Promise<WhisperTranscribeResult>((resolve) => {
      const args = [
        '-m', this._modelPath!,
        '-f', audioFilePath,
        '-l', language,
        '-t', String(Math.max(1, Math.floor(os.cpus().length / 2))),
        '--no-prints',
        '-pc',   // 输出颜色标记的时间戳
      ];

      const proc = spawn(this._binaryPath!, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf-8');
      });

      proc.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf-8');
      });

      const timer = setTimeout(() => {
        proc.kill();
        resolve({
          success: false,
          error: `Transcription timeout after ${timeoutMs}ms`,
        });
      }, timeoutMs);

      proc.on('close', (code) => {
        clearTimeout(timer);
        const durationMs = Date.now() - startTime;

        if (code !== 0) {
          resolve({
            success: false,
            error: `whisper.cpp exited with code ${code}: ${stderr}`,
            durationMs,
          });
          return;
        }

        // 解析输出
        const segments = this._parseSegments(stdout);
        const text = segments.length > 0
          ? segments.map((s) => s.text).join(' ')
          : stdout.trim();

        resolve({
          success: true,
          text,
          segments: segments.length > 0 ? segments : undefined,
          durationMs,
        });
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        resolve({
          success: false,
          error: `Failed to run whisper.cpp: ${err.message}`,
        });
      });
    });
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    if (!this.isAvailable) return false;

    // 创建一个空的临时 WAV 文件来测试
    const tmpFile = path.join(os.tmpdir(), `whisper_health_${Date.now()}.wav`);

    try {
      // 写入最小 WAV 文件头（16kHz mono 16bit，0.1秒静音）
      const sampleRate = 16000;
      const duration = 0.1;
      const numSamples = Math.floor(sampleRate * duration);
      const dataSize = numSamples * 2; // 16bit = 2 bytes
      const fileSize = 44 + dataSize;

      const buffer = Buffer.alloc(fileSize);
      // RIFF header
      buffer.write('RIFF', 0);
      buffer.writeUInt32LE(fileSize - 8, 4);
      buffer.write('WAVE', 8);
      // fmt subchunk
      buffer.write('fmt ', 12);
      buffer.writeUInt32LE(16, 16);       // subchunk size
      buffer.writeUInt16LE(1, 20);        // PCM format
      buffer.writeUInt16LE(1, 22);        // mono
      buffer.writeUInt32LE(sampleRate, 24);
      buffer.writeUInt32LE(sampleRate * 2, 28); // byte rate
      buffer.writeUInt16LE(2, 32);        // block align
      buffer.writeUInt16LE(16, 34);       // bits per sample
      // data subchunk
      buffer.write('data', 36);
      buffer.writeUInt32LE(dataSize, 40);
      // 填充静音
      buffer.fill(0, 44);

      fs.writeFileSync(tmpFile, buffer);

      const result = await this.transcribeFile(tmpFile, 'en', 10000);
      return result.success;
    } catch {
      return false;
    } finally {
      try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
    }
  }

  /**
   * 停止 sidecar 进程
   */
  stop(): void {
    if (this._process && !this._process.killed) {
      this._process.stdin?.end();
      this._process.kill();

      // 等待最多 3 秒让进程优雅退出
      const timer = setTimeout(() => {
        if (this._process && !this._process.killed) {
          this._process.kill('SIGKILL');
        }
      }, 3000);

      this._process.on('exit', () => clearTimeout(timer));
    }
    this._cleanup();
  }

  /**
   * 清理内部状态
   */
  private _cleanup(): void {
    this._process = null;
    this._isReady = false;
    this._stdoutBuffer = '';

    // 清理所有 pending 请求
    for (const [, pending] of this._pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Sidecar process exited'));
    }
    this._pendingRequests.clear();
  }
}

// ── 辅助函数 ──────────────────────────────────────────────

function isPackaged(): boolean {
  // 判断是否在打包后的 resources 目录中
  return !!(process as { resourcesPath?: string }).resourcesPath;
}

// ── 单例 ──────────────────────────────────────────────────

let _manager: WhisperSidecarManager | null = null;

function getManager(): WhisperSidecarManager {
  if (!_manager) {
    _manager = new WhisperSidecarManager();
  }
  return _manager;
}

// ── IPC Handler 注册 ──────────────────────────────────────

export function registerWhisperHandlers(): void {
  // ── 状态查询 ──────────────────────────────────────────
  ipcMain.handle('whisper:status', () => {
    return getManager().getStatus();
  });

  // ── 启动 sidecar ──────────────────────────────────────
  ipcMain.handle('whisper:start', async () => {
    try {
      await getManager().start();
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  // ── 停止 sidecar ──────────────────────────────────────
  ipcMain.handle('whisper:stop', () => {
    try {
      getManager().stop();
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  // ── 转录音频（base64 数据）─────────────────────────────
  ipcMain.handle('whisper:transcribe', async (_event, params: WhisperTranscribeParams) => {
    try {
      const result = await getManager().transcribe(
        params.audioBase64,
        params.language ?? 'zh',
      );
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  // ── 转录音频文件 ──────────────────────────────────────
  ipcMain.handle('whisper:transcribeFile', async (_event, params: {
    filePath: string;
    language?: string;
  }) => {
    try {
      const result = await getManager().transcribeFile(
        params.filePath,
        params.language ?? 'zh',
      );
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  // ── 健康检查 ──────────────────────────────────────────
  ipcMain.handle('whisper:healthCheck', async () => {
    try {
      const healthy = await getManager().healthCheck();
      return { success: true, healthy };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, healthy: false, error: message };
    }
  });
}

/**
 * 停止 sidecar（应用退出时调用）
 */
export function stopWhisperSidecar(): void {
  if (_manager) {
    _manager.stop();
    _manager = null;
  }
}
