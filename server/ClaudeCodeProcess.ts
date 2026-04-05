import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { AnsiParser } from './AnsiParser.js';
import type { ClaudeEvent } from '../src/types/events.js';

export class ClaudeCodeProcess extends EventEmitter {
  private processes = new Map<string, ChildProcess>();
  private parsers = new Map<string, AnsiParser>();

  spawn(sessionId: string, projectPath: string, prompt?: string): void {
    if (this.processes.has(sessionId)) {
      this.kill(sessionId);
    }

    const proc = spawn('claude', [], {
      cwd: projectPath,
      shell: true,
      env: { ...process.env, CLAUDE_NO_INTERACTION: '1' }
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
      this.emit('close', { sessionId, code });
      this.processes.delete(sessionId);
      this.parsers.delete(sessionId);
    });

    proc.on('error', (err) => {
      this.emit('error', { sessionId, error: err.message });
    });

    if (prompt) {
      proc.stdin?.write(prompt + '\n');
    }

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
