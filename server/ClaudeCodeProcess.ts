import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { AnsiParser } from './AnsiParser.js';
import type { ClaudeEvent } from '../src/types/events.js';
import { child as log } from './utils/logger.js';

const logger = log('ClaudeCodeProcess');

export class ClaudeCodeProcess extends EventEmitter {
  private processes = new Map<string, ChildProcess>();
  private parsers = new Map<string, AnsiParser>();

  spawn(sessionId: string, projectPath: string, prompt?: string): void {
    if (this.processes.has(sessionId)) {
      this.kill(sessionId);
    }

    // --bare: 跳过 hooks/LSP/插件同步等，加速冷启动
    // -p: 非交互式，--output-format stream-json: 流式结构化输出
    const args = [
      '--bare',
      '-p',
      '--output-format', 'stream-json',
      '--permission-mode', 'bypassPermissions',
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

  sendInput(sessionId: string, input: string): void {
    const proc = this.processes.get(sessionId);
    if (proc?.stdin) {
      proc.stdin.write(input + '\n');
    }
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
