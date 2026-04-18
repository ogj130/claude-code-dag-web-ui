import { describe, it, expect, beforeEach } from 'vitest';
import { AnsiParser } from '../AnsiParser';

describe('AnsiParser', () => {
  let parser: AnsiParser;

  beforeEach(() => {
    parser = new AnsiParser();
  });

  describe('constructor and basic properties', () => {
    it('should create an instance', () => {
      expect(parser).toBeInstanceOf(AnsiParser);
    });
  });

  describe('setCurrentQueryId', () => {
    it('should accept a query ID', () => {
      parser.setCurrentQueryId('query_1');
      expect(() => parser.setCurrentQueryId('query_2')).not.toThrow();
    });
  });

  describe('parse (plain text)', () => {
    it('should parse plain text without ANSI codes', () => {
      const events: string[] = [];
      parser.on('terminalLine', (text: string) => events.push(text));

      parser.feed('Hello world');
      parser.flush();

      expect(events).toContain('Hello world');
    });

    it('should strip ANSI color codes from text', () => {
      const events: string[] = [];
      parser.on('terminalLine', (text: string) => events.push(text));

      parser.feed('\x1b[31mRed text\x1b[0m');
      parser.flush();

      expect(events.some(e => e.includes('Red text'))).toBe(true);
    });

    it('should skip empty lines', () => {
      const events: string[] = [];
      parser.on('terminalLine', (text: string) => events.push(text));

      parser.feed('');
      parser.flush();

      expect(events).toHaveLength(0);
    });

    it('should handle multiple lines separated by newlines', () => {
      const events: string[] = [];
      parser.on('terminalLine', (text: string) => events.push(text));

      // Split and process (no trailing newline to avoid empty last item)
      parser.feed('Line 1\nLine 2\nLine 3');
      parser.flush();

      expect(events).toContain('Line 1');
      expect(events).toContain('Line 2');
      expect(events).toContain('Line 3');
    });

    it('should handle mixed ANSI and plain text lines', () => {
      const events: string[] = [];
      parser.on('terminalLine', (text: string) => events.push(text));

      parser.feed('\x1b[32mSuccess\x1b[0m: Operation completed');
      parser.flush();

      expect(events.some(e => e.includes('Success') && e.includes('Operation'))).toBe(true);
    });
  });

  describe('parse (stream-json mode)', () => {
    it('should detect stream-json mode from system message (non-JSON fallback disabled)', () => {
      // system message sets streamJsonMode = true
      // After system init, non-JSON lines should still write to terminal
      const terminalLines: string[] = [];
      parser.on('terminalLine', (text: string) => terminalLines.push(text));
      parser.feed(JSON.stringify({ type: 'system', message: 'init' }));
      parser.feed('Some debug output\n');
      parser.flush();
      // In streamJsonMode, non-JSON lines emit terminalLine
      expect(terminalLines).toContain('Some debug output');
    });

    it('should parse assistant message with text block', () => {
      const chunks: string[] = [];
      parser.on('terminalChunk', (chunk: string) => chunks.push(chunk));

      parser.feed(JSON.stringify({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Hello from Claude' }],
        },
      }));
      parser.flush();

      expect(chunks).toContain('Hello from Claude');
    });

    it('should parse assistant message with multiple blocks', () => {
      const events: { type: string }[] = [];
      parser.on('event', (e) => events.push(e as { type: string }));

      parser.feed(JSON.stringify({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            { type: 'tool_use', name: 'Read', id: 'tool-1', input: {} },
            { type: 'text', text: 'Reading the file now' },
          ],
        },
      }));
      parser.flush();

      const toolCall = events.find(e => e.type === 'tool_call');
      expect(toolCall).toBeDefined();
      expect((toolCall as unknown as { tool: string }).tool).toBe('read');
    });

    it('should parse tool_call event from stream-json', () => {
      const toolCalls: { toolId: string; tool: string }[] = [];
      parser.on('event', (event: { type: string; toolId?: string; tool?: string }) => {
        if (event.type === 'tool_call') {
          toolCalls.push({ toolId: event.toolId!, tool: event.tool! });
        }
      });

      parser.feed(JSON.stringify({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            { type: 'tool_use', name: 'Bash', id: 'tool-1', input: { command: 'ls' } },
          ],
        },
      }));
      parser.flush();

      expect(toolCalls[0].tool).toBe('bash');
      expect(toolCalls[0].toolId).toBe('tool-1');
    });

    it('should parse user tool_result event', () => {
      const results: { toolId: string; status: string }[] = [];
      parser.on('event', (event: { type: string; toolId?: string; status?: string }) => {
        if (event.type === 'tool_result') {
          results.push({ toolId: event.toolId!, status: event.status! });
        }
      });

      parser.feed(JSON.stringify({
        type: 'user',
        message: {
          role: 'user',
          content: [
            { type: 'tool_result', tool_use_id: 'tool-1', content: 'file contents', is_error: false },
          ],
        },
      }));
      parser.flush();

      expect(results[0].toolId).toBe('tool-1');
      expect(results[0].status).toBe('success');
    });

    it('should parse error result event', () => {
      const errors: { message: string }[] = [];
      parser.on('event', (event: { type: string; message?: string }) => {
        if (event.type === 'error') errors.push({ message: event.message! });
      });

      parser.feed(JSON.stringify({ type: 'result', subtype: 'error', error: 'Something failed' }));
      parser.flush();

      expect(errors[0].message).toBe('Something failed');
    });

    it('should parse successful result event', () => {
      const summaries: { summary: string }[] = [];
      const streamEnds: { type: string }[] = [];

      parser.on('event', (event: { type: string; summary?: string }) => {
        if (event.type === 'query_summary') summaries.push({ summary: event.summary! });
        if (event.type === 'streamEnd') streamEnds.push(event as { type: string });
      });

      parser.feed(JSON.stringify({ type: 'result', result: 'Task completed successfully' }));
      parser.flush();

      expect(summaries[0].summary).toBe('Task completed successfully');
      expect(streamEnds).toHaveLength(1);
    });

    it('should include token_usage in result event', () => {
      const usage: { usage?: { input: number; output: number } }[] = [];
      parser.on('event', (event: { type: string; usage?: { input: number; output: number } }) => {
        if (event.type === 'token_usage') usage.push({ usage: event.usage });
      });

      parser.feed(JSON.stringify({
        type: 'result',
        result: 'done',
        usage: { input_tokens: 1000, output_tokens: 500 },
      }));
      parser.flush();

      expect(usage[0].usage).toEqual({ input: 1000, output: 500 });
    });

    it('should emit streamEnd on result event', () => {
      const streamEnds: { type: string }[] = [];
      parser.on('event', (event: { type: string }) => {
        if (event.type === 'streamEnd') streamEnds.push(event);
      });

      parser.feed(JSON.stringify({ type: 'result', result: 'done' }));
      parser.flush();

      expect(streamEnds).toHaveLength(1);
    });
  });

  describe('parse (input type)', () => {
    it('should parse input message with tool_use blocks', () => {
      const progressEvents: { tool: string; message: string }[] = [];
      parser.on('event', (event: { type: string; tool?: string; message?: string }) => {
        if (event.type === 'tool_progress') {
          progressEvents.push({ tool: event.tool!, message: event.message! });
        }
      });

      parser.feed(JSON.stringify({
        type: 'input',
        message: {
          role: 'user',
          content: [
            { type: 'tool_use', name: 'Read', id: 'tool-1', input: { file_path: '/etc/hosts' } },
          ],
        },
      }));
      parser.flush();

      expect(progressEvents[0].tool).toBe('read');
      expect(progressEvents[0].message).toContain('/etc/hosts');
    });
  });

  describe('buffer management', () => {
    it('should buffer incomplete lines', () => {
      const events: string[] = [];
      parser.on('terminalLine', (text: string) => events.push(text));

      parser.feed('Partial');
      parser.feed('Line\n');

      expect(events).toContain('PartialLine');
    });

    it('should flush remaining buffer on flush call', () => {
      const events: string[] = [];
      parser.on('terminalLine', (text: string) => events.push(text));

      parser.feed('Line without newline');
      parser.flush();

      expect(events).toContain('Line without newline');
    });
  });

  describe('formatToolMessage', () => {
    it('should format read tool message', () => {
      const progressEvents: { message: string }[] = [];
      parser.on('event', (event: { type: string; message?: string }) => {
        if (event.type === 'tool_progress') progressEvents.push({ message: event.message! });
      });

      parser.feed(JSON.stringify({
        type: 'input',
        message: {
          role: 'user',
          content: [{ type: 'tool_use', name: 'Read', id: 't1', input: { file_path: '/tmp/file.txt' } }],
        },
      }));
      parser.flush();

      expect(progressEvents[0].message).toBe('Reading /tmp/file.txt');
    });

    it('should format edit tool message', () => {
      const progressEvents: { message: string }[] = [];
      parser.on('event', (event: { type: string; message?: string }) => {
        if (event.type === 'tool_progress') progressEvents.push({ message: event.message! });
      });

      parser.feed(JSON.stringify({
        type: 'input',
        message: {
          role: 'user',
          content: [{ type: 'tool_use', name: 'Edit', id: 't1', input: { file_path: '/a.js' } }],
        },
      }));
      parser.flush();

      expect(progressEvents[0].message).toBe('Editing /a.js');
    });

    it('should format write tool message', () => {
      const progressEvents: { message: string }[] = [];
      parser.on('event', (event: { type: string; message?: string }) => {
        if (event.type === 'tool_progress') progressEvents.push({ message: event.message! });
      });

      parser.feed(JSON.stringify({
        type: 'input',
        message: {
          role: 'user',
          content: [{ type: 'tool_use', name: 'Write', id: 't1', input: { file_path: '/b.js' } }],
        },
      }));
      parser.flush();

      expect(progressEvents[0].message).toBe('Writing to /b.js');
    });

    it('should format bash tool with short command', () => {
      const progressEvents: { message: string }[] = [];
      parser.on('event', (event: { type: string; message?: string }) => {
        if (event.type === 'tool_progress') progressEvents.push({ message: event.message! });
      });

      parser.feed(JSON.stringify({
        type: 'input',
        message: {
          role: 'user',
          content: [{ type: 'tool_use', name: 'Bash', id: 't1', input: { command: 'ls -la' } }],
        },
      }));
      parser.flush();

      expect(progressEvents[0].message).toBe('ls -la');
    });

    it('should truncate long bash commands', () => {
      const progressEvents: { message: string }[] = [];
      parser.on('event', (event: { type: string; message?: string }) => {
        if (event.type === 'tool_progress') progressEvents.push({ message: event.message! });
      });

      parser.feed(JSON.stringify({
        type: 'input',
        message: {
          role: 'user',
          content: [{ type: 'tool_use', name: 'Bash', id: 't1', input: { command: 'git commit -m "a very long commit message that exceeds 50 characters"' } }],
        },
      }));
      parser.flush();

      expect(progressEvents[0].message.length).toBeLessThanOrEqual(53); // 50 + '...'
      expect(progressEvents[0].message).toContain('...');
    });

    it('should format websearch tool', () => {
      const progressEvents: { message: string }[] = [];
      parser.on('event', (event: { type: string; message?: string }) => {
        if (event.type === 'tool_progress') progressEvents.push({ message: event.message! });
      });

      parser.feed(JSON.stringify({
        type: 'input',
        message: {
          role: 'user',
          content: [{ type: 'tool_use', name: 'WebSearch', id: 't1', input: { query: 'TypeScript best practices' } }],
        },
      }));
      parser.flush();

      expect(progressEvents[0].message).toBe('Searching: TypeScript best practices');
    });

    it('should format mcp tool', () => {
      const progressEvents: { message: string }[] = [];
      parser.on('event', (event: { type: string; message?: string }) => {
        if (event.type === 'tool_progress') progressEvents.push({ message: event.message! });
      });

      parser.feed(JSON.stringify({
        type: 'input',
        message: {
          role: 'user',
          content: [{ type: 'tool_use', name: 'MCP', id: 't1', input: { tool: 'fetch' } }],
        },
      }));
      parser.flush();

      expect(progressEvents[0].message).toBe('Using fetch');
    });

    it('should format grep tool', () => {
      const progressEvents: { message: string }[] = [];
      parser.on('event', (event: { type: string; message?: string }) => {
        if (event.type === 'tool_progress') progressEvents.push({ message: event.message! });
      });

      parser.feed(JSON.stringify({
        type: 'input',
        message: {
          role: 'user',
          content: [{ type: 'tool_use', name: 'Grep', id: 't1', input: { pattern: 'TODO' } }],
        },
      }));
      parser.flush();

      expect(progressEvents[0].message).toBe('Grep: TODO');
    });
  });

  describe('query summary with currentQueryId', () => {
    it('should use setCurrentQueryId for query_summary', () => {
      const summaries: { queryId: string }[] = [];
      parser.on('event', (event: { type: string; queryId?: string }) => {
        if (event.type === 'query_summary') summaries.push({ queryId: event.queryId! });
      });

      parser.setCurrentQueryId('query_42');
      parser.feed(JSON.stringify({ type: 'result', result: 'completed' }));
      parser.flush();

      expect(summaries[0].queryId).toBe('query_42');
    });

    it('should fall back to main when no queryId set', () => {
      const summaries: { queryId: string }[] = [];
      parser.on('event', (event: { type: string; queryId?: string }) => {
        if (event.type === 'query_summary') summaries.push({ queryId: event.queryId! });
      });

      parser.feed(JSON.stringify({ type: 'result', result: 'done' }));
      parser.flush();

      expect(summaries[0].queryId).toBe('main');
    });
  });
});
