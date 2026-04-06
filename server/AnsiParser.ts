import { EventEmitter } from 'events';
import type { ClaudeEvent } from '../src/types/events.js';

export class AnsiParser extends EventEmitter {
  private buffer = '';

  feed(data: string): void {
    this.buffer += data;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() ?? '';

    for (const line of lines) {
      const events = this.parseLine(line);
      for (const event of events) {
        this.emit('event', event);
      }
    }
  }

  flush(): void {
    if (this.buffer) {
      const events = this.parseLine(this.buffer);
      for (const event of events) {
        this.emit('event', event);
      }
      this.buffer = '';
    }
  }

  /** 解析单行：先尝试 JSON（stream-json 格式），否则按 ANSI 文本解析 */
  private parseLine(line: string): ClaudeEvent[] {
    const clean = line.replace(/\x1b\[[0-9;]*m/g, '').trim();
    if (!clean) return [];

    // stream-json 格式：以 { 开头
    if (clean.startsWith('{')) {
      try {
        const obj = JSON.parse(clean);
        return this.jsonToEvents(obj);
      } catch {
        // 不是有效 JSON，继续 ANSI 解析
      }
    }

    // ANSI 彩色终端输出
    return this.parseAnsiLine(clean);
  }

  /**
   * 将 claude -p --output-format stream-json 的 JSON 对象转换为 ClaudeEvent[]
   *
   * stream-json 事件类型：
   *   { "type": "system", "subtype": "init", ... }
   *   { "type": "assistant", "message": { "content": [...] }, ... }
   *   { "type": "result", "subtype": "success", "result": "...", ... }
   *   { "type": "result", "subtype": "error", "error": "...", ... }
   */
  private jsonToEvents(obj: Record<string, unknown>): ClaudeEvent[] {
    const events: ClaudeEvent[] = [];
    const type = obj.type as string;

    if (type === 'system' && obj.subtype === 'init') {
      // 会话初始化完成
      return [];
    }

    if (type === 'assistant' && obj.message) {
      const msg = obj.message as Record<string, unknown>;
      const content = msg.content as Array<Record<string, unknown>> | undefined;

      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'text') {
            // 文本块：忽略，stream-json 的 result 事件会给出完整输出
          }
          if (block.type === 'thinking') {
            // 思考块：忽略
          }
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
      const isError = obj.subtype === 'error' || (obj as Record<string, unknown>).is_error === true;
      const resultStr = String(obj.result ?? obj.error ?? '');

      if (isError) {
        events.push({ type: 'error', message: resultStr });
      } else {
        // 成功结果
        events.push({ type: 'tool_result', toolId: 'last', result: resultStr, status: 'success' });
        events.push({ type: 'session_end', sessionId: '', reason: 'completed' });
      }

      // Token 用量
      const usage = (obj as Record<string, unknown>).usage as Record<string, unknown> | undefined;
      if (usage) {
        events.push({
          type: 'token_usage',
          usage: {
            input: (usage.input_tokens as number) ?? 0,
            output: (usage.output_tokens as number) ?? 0,
          }
        });
      }
    }

    return events;
  }

  /** 解析 ANSI 彩色终端输出行（交互模式回退） */
  private parseAnsiLine(clean: string): ClaudeEvent[] {
    const agentStart = clean.match(/›››\s*Agent:\s*(.+?)\s*(启动|开始|start)/);
    if (agentStart) {
      return [{ type: 'agent_start', agentId: `agent_${Date.now()}`, label: agentStart[1] }];
    }

    const agentEnd = clean.match(/›››\s*Agent:\s*(.+?)\s*(✓|完成|end|done)/);
    if (agentEnd) {
      return [{ type: 'agent_end', agentId: `agent_${Date.now()}`, result: agentEnd[1] }];
    }

    const toolMatch = clean.match(/›››\s*([A-Za-z]+)\s*(.*)/);
    if (toolMatch && !clean.includes('Agent')) {
      const toolId = `tool_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      return [{
        type: 'tool_call',
        toolId,
        tool: toolMatch[1].toLowerCase(),
        args: { raw: toolMatch[2] || '' }
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
