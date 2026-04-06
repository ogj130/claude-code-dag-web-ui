import { EventEmitter } from 'events';
import type { ClaudeEvent } from '../src/types/events.js';

export class AnsiParser extends EventEmitter {
  private buffer = '';

  feed(data: string): void {
    this.buffer += data;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() ?? '';

    for (const line of lines) {
      this.parseLine(line);
    }
  }

  flush(): void {
    if (this.buffer) {
      this.parseLine(this.buffer);
      this.buffer = '';
    }
  }

  /** 解析单行：尝试 JSON（stream-json），否则 ANSI 文本 */
  private parseLine(line: string): void {
    const clean = line.replace(/\x1b\[[0-9;]*m/g, '').trim();
    if (!clean) return;

    if (clean.startsWith('{')) {
      try {
        const obj = JSON.parse(clean) as Record<string, unknown>;
        // 结构化事件
        const events = this.jsonToEvents(obj);
        for (const event of events) {
          this.emit('event', event);
        }
        // 终端显示文本
        const text = this.jsonToTerminalText(obj);
        if (text) {
          this.emit('terminalLine', text);
        }
        return;
      } catch {
        // 不是有效 JSON
      }
    }

    // ANSI 终端输出：事件 + 原始文本
    const events = this.parseAnsiLine(clean);
    for (const event of events) {
      this.emit('event', event);
    }
    this.emit('terminalLine', clean);
  }

  /** 从 stream-json 对象提取终端显示文本 */
  private jsonToTerminalText(obj: Record<string, unknown>): string | null {
    const type = obj.type as string;

    if (type === 'assistant' && obj.message) {
      const msg = obj.message as Record<string, unknown>;
      const content = msg.content;
      if (Array.isArray(content)) {
        const parts: string[] = [];
        for (const block of content) {
          if (block.type === 'text') {
            const text = String(block.text ?? '').trim();
            if (text) parts.push(text);
          }
          if (block.type === 'tool_use') {
            parts.push(`\x1b[33m››› ${(block as { name: string }).name}\x1b[0m`);
          }
        }
        return parts.length ? parts.join(' ') : null;
      }
      if (typeof content === 'string') return content.trim() || null;
    }

    if (type === 'result') {
      if (obj.result) return String(obj.result);
      if (obj.error) return `\x1b[31m✗ ${obj.error}\x1b[0m`;
    }

    return null;
  }

  /**
   * 将 stream-json JSON 对象转换为 ClaudeEvent[]
   *
   * stream-json 事件类型：
   *   { "type": "system", "subtype": "init" }
   *   { "type": "assistant", "message": { "content": [...] } }
   *   { "type": "result", "result": "..." }
   */
  private jsonToEvents(obj: Record<string, unknown>): ClaudeEvent[] {
    const events: ClaudeEvent[] = [];
    const type = obj.type as string;

    if (type === 'system') return []; // 忽略初始化消息

    if (type === 'assistant' && obj.message) {
      const msg = obj.message as Record<string, unknown>;
      const content = msg.content as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'tool_use') {
            const tool = block as { name: string; input: Record<string, unknown>; id: string };
            events.push({
              type: 'tool_call',
              toolId: tool.id,
              tool: tool.name.toLowerCase(),
              args: tool.input,
            });
          }
        }
      }
    }

    if (type === 'result') {
      const isError = obj.subtype === 'error' || obj.is_error === true;
      const resultStr = String(obj.result ?? obj.error ?? '');
      if (isError) {
        events.push({ type: 'error', message: resultStr });
      } else {
        events.push({ type: 'tool_result', toolId: 'last', result: resultStr, status: 'success' });
        events.push({ type: 'session_end', sessionId: '', reason: 'completed' });
      }
      const usage = obj.usage as Record<string, number> | undefined;
      if (usage) {
        events.push({
          type: 'token_usage',
          usage: { input: usage.input_tokens ?? 0, output: usage.output_tokens ?? 0 },
        });
      }
    }

    return events;
  }

  /** 解析 ANSI 彩色终端输出行（交互模式回退） */
  private parseAnsiLine(clean: string): ClaudeEvent[] {
    const agentStart = clean.match(/›››\s*Agent:\s*(.+?)\s*(启动|开始|start)/);
    if (agentStart) return [{ type: 'agent_start', agentId: `agent_${Date.now()}`, label: agentStart[1] }];

    const agentEnd = clean.match(/›››\s*Agent:\s*(.+?)\s*(✓|完成|end|done)/);
    if (agentEnd) return [{ type: 'agent_end', agentId: `agent_${Date.now()}`, result: agentEnd[1] }];

    const toolMatch = clean.match(/›››\s*([A-Za-z]+)\s*(.*)/);
    if (toolMatch && !clean.includes('Agent')) {
      return [{
        type: 'tool_call',
        toolId: `tool_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        tool: toolMatch[1].toLowerCase(),
        args: { raw: toolMatch[2] || '' },
      }];
    }

    if (clean.startsWith('✓') || clean.includes('完成') || clean.includes('success')) {
      return [{ type: 'tool_result', toolId: 'last', result: clean, status: 'success' }];
    }
    if (clean.includes('error') || clean.includes('Error') || clean.includes('失败')) {
      return [{ type: 'tool_result', toolId: 'last', result: clean, status: 'error' }];
    }
    return [];
  }
}
