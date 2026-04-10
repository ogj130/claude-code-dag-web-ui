import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { AnsiParser } from './AnsiParser.js';
// @ts-ignore
import type { ClaudeEvent } from '../types/events.js';
import { child as log } from './utils/logger.js';

const logger = log('ClaudeCodeProcess');

export class ClaudeCodeProcess extends EventEmitter {
  private processes = new Map<string, ChildProcess>();
  private parsers = new Map<string, AnsiParser>();
  // 跟踪每个 session 的 query 序号，匹配 send_input → result
  private queryCounters = new Map<string, number>();
  // 当前正在等待结果的 queryId（每次 sendInput 时递增写入，result 时读取）
  private pendingQueryIds = new Map<string, string>();

  spawn(sessionId: string, projectPath: string, prompt?: string): void {
    if (this.processes.has(sessionId)) {
      this.kill(sessionId);
    }

    // --bare: 跳过插件/LSP/hooks 加速冷启动
    // --input-format stream-json + --output-format stream-json: 双向流式 JSON 交互
    // --permission-mode bypassPermissions: 跳过信任目录确认
    const args = [
      '--bare',
      '-p',
      '--input-format', 'stream-json',
      '--output-format', 'stream-json',
      '--permission-mode', 'bypassPermissions',
      // 初始 prompt 作为第一个 stdin 消息发出
      ...(prompt ? [prompt] : [])
    ];

    logger.info({ sessionId, projectPath, args }, 'Spawning claude');

    const proc = spawn('claude', args, {
      cwd: projectPath,
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.processes.set(sessionId, proc);

    const parser = new AnsiParser();
    this.parsers.set(sessionId, parser);

    parser.on('event', (event: ClaudeEvent) => {
      this.emit('event', { event, sessionId, timestamp: Date.now() });
    });

    parser.on('terminalLine', (text: string) => {
      this.emit('terminalLine', { text, sessionId, timestamp: Date.now() });
    });

    parser.on('terminalChunk', (text: string) => {
      this.emit('terminalChunk', { text, sessionId, timestamp: Date.now() });
    });

    proc.stdout?.on('data', (data: Buffer) => {
      parser.feed(data.toString());
    });

    proc.stderr?.on('data', (data: Buffer) => {
      parser.feed(data.toString());
    });

    proc.on('close', (code) => {
      parser.flush();
      logger.info({ sessionId, code }, 'Process closed');
      this.emit('close', { sessionId, code });
      this.processes.delete(sessionId);
      this.parsers.delete(sessionId);
    });

    proc.on('error', (err) => {
      logger.error({ sessionId, err }, 'Process error');
      this.emit('error', { sessionId, error: err.message });
    });

    this.emit('event', {
      event: { type: 'session_start', sessionId },
      sessionId,
      timestamp: Date.now()
    });
  }

  sendInput(sessionId: string, input: string): string {
    // 返回生成的 queryId，供服务端立即广播给客户端
    const proc = this.processes.get(sessionId);
    if (proc?.stdin) {
      // 生成 query 序号，与 AnsiParser 中的 queryId 同步
      const count = (this.queryCounters.get(sessionId) ?? 0) + 1;
      this.queryCounters.set(sessionId, count);
      const queryId = `query_${count}`;
      this.pendingQueryIds.set(sessionId, queryId);

      // 通知 parser 当前 query ID（用于 query_summary 事件）
      const parser = this.parsers.get(sessionId);
      if (parser) {
        parser.setCurrentQueryId(queryId);
      }

      // --input-format stream-json: stdin 必须是 JSON 格式
      const msg = JSON.stringify({ type: 'user', message: { role: 'user', content: input } });
      proc.stdin.write(msg + '\n');

      return queryId;
    }
    return '';
  }

  kill(sessionId: string): void {
    const proc = this.processes.get(sessionId);
    if (proc) {
      proc.kill('SIGTERM');
      this.processes.delete(sessionId);
      this.parsers.delete(sessionId);
      this.emit('event', {
        event: { type: 'session_end', sessionId, reason: 'killed' },
        sessionId,
        timestamp: Date.now()
      });
    }
  }

  isRunning(sessionId: string): boolean {
    return this.processes.has(sessionId);
  }
}
