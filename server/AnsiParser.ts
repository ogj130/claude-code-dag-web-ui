import { EventEmitter } from 'events';
// @ts-ignore
import type { ClaudeEvent } from '../../dist/src/types/events.js';

export class AnsiParser extends EventEmitter {
  private buffer = '';
  private currentQueryId = '';
  // 检测到 stream-json 模式后，禁止 fallback 的 terminalLine（防止重复输出）
  private streamJsonMode = false;

  setCurrentQueryId(id: string): void {
    this.currentQueryId = id;
  }

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
        const type = obj.type as string;

        // 检测 stream-json 模式：收到 system/init 消息后确认
        if (type === 'system') {
          this.streamJsonMode = true;
        }

        // 结构化事件
        const events = this.jsonToEvents(obj);
        for (const event of events) {
          this.emit('event', event);
        }

        // 流式文本：assistant text 块逐块发出 terminalChunk
        const chunks = this.jsonToTerminalChunks(obj);
        for (const chunk of chunks) {
          this.emit('terminalChunk', chunk);
        }
        return;
      } catch {
        // 不是有效 JSON → fallback 处理
      }
    }

    // stream-json 模式下：非 JSON 行（如调试信息）写入终端，并发结构化事件
    if (this.streamJsonMode) {
      const events = this.parseAnsiLine(clean);
      for (const event of events) {
        this.emit('event', event);
      }
      this.emit('terminalLine', clean);
      return;
    }

    // 交互模式（ANSI）：事件 + 原始文本
    const events = this.parseAnsiLine(clean);
    for (const event of events) {
      this.emit('event', event);
    }
    this.emit('terminalLine', clean);
  }

  /** 从 stream-json 对象提取终端显示文本片段（逐块流式输出） */
  private jsonToTerminalChunks(obj: Record<string, unknown>): string[] {
    const chunks: string[] = [];
    const type = obj.type as string;

    if (type === 'assistant' && obj.message) {
      const msg = obj.message as Record<string, unknown>;
      const content = msg.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'text') {
            const text = (block as { text: string }).text;
            if (text) chunks.push(text);
          }
          // tool_use 不在这里输出
        }
      }
    }
    // result 不发任何 terminalChunk（文本已在流式过程中输出完毕）
    return chunks;
  }

  /**
   * 将 stream-json JSON 对象转换为 ClaudeEvent[]
   */
  private jsonToEvents(obj: Record<string, unknown>): ClaudeEvent[] {
    const events: ClaudeEvent[] = [];
    const type = obj.type as string;

    if (type === 'system') return []; // 忽略初始化消息

    // 处理 assistant 消息：所有文本都作为 summary_chunk 流式发送
    if (type === 'assistant' && obj.message) {
      const msg = obj.message as Record<string, unknown>;
      const content = msg.content as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(content)) {
        let lastToolUseIndex = -1;
        // 第一遍：记录最后一个 tool_use 的位置
        for (let i = 0; i < content.length; i++) {
          if (content[i].type === 'tool_use') {
            lastToolUseIndex = i;
          }
        }
        // 第二遍：处理所有 block
        for (let i = 0; i < content.length; i++) {
          const block = content[i];
          if (block.type === 'tool_use') {
            const tool = block as { name: string; input: Record<string, unknown>; id: string };
            events.push({
              type: 'tool_call',
              toolId: tool.id,
              tool: tool.name.toLowerCase(),
              args: tool.input ?? {},
            });
          } else if (block.type === 'text') {
            const text = (block as { text: string }).text;
            if (text) {
              // text 在最后一个 tool_use 之后，或者整条消息没有 tool_use → 都是 summary_chunk
              if (lastToolUseIndex < 0 || i > lastToolUseIndex) {
                events.push({
                  type: 'summary_chunk',
                  queryId: this.currentQueryId || 'main',
                  chunk: text,
                });
              }
            }
          }
        }
      }
    }

    // 处理 type:'input' 消息：Claude Code 流式发送工具交互描述
    // content 中含 tool_use block，提取人类可读描述为 tool_progress 事件
    if (type === 'input' && obj.message) {
      const msg = obj.message as Record<string, unknown>;
      const content = msg.content as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'tool_use') {
            const tool = block as { name: string; input: Record<string, unknown>; id: string };
            const toolName = tool.name.toLowerCase();
            const message = this.formatToolMessage(toolName, tool.input ?? {});
            if (message) {
              events.push({
                type: 'tool_progress',
                toolId: tool.id,
                tool: toolName,
                message,
              });
            }
          }
        }
      }
    }

    // 处理 user 消息中的 tool_result（Claude Code 将工具结果放在这里）
    if (type === 'user' && obj.message) {
      const msg = obj.message as Record<string, unknown>;
      const content = msg.content as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'tool_result') {
            const toolResult = block as { tool_use_id: string; content: string; is_error?: boolean };
            events.push({
              type: 'tool_result',
              toolId: toolResult.tool_use_id,
              result: toolResult.content ?? '',
              status: (toolResult.is_error ?? false) ? 'error' : 'success',
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
        events.push({ type: 'streamEnd' });
      } else {
        // type === 'result' 表示最终回答（tool_result 已通过 type === 'user' 消息单独发送）
        events.push({
          type: 'query_summary',
          queryId: this.currentQueryId || 'main',
          summary: resultStr,
        });
        events.push({ type: 'streamEnd' });
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

  /** 生成人类可读的工具提示文字 */
  private formatToolMessage(tool: string, args: Record<string, unknown>): string {
    switch (tool) {
      case 'read': {
        const path = String(args.file_path ?? args.path ?? '');
        return path ? `Reading ${path}` : 'Reading file';
      }
      case 'edit': {
        const path = String(args.file_path ?? '');
        return path ? `Editing ${path}` : 'Editing file';
      }
      case 'write': {
        const path = String(args.file_path ?? '');
        return path ? `Writing to ${path}` : 'Writing file';
      }
      case 'bash':
      case 'shell': {
        const cmd = String(args.command ?? args.cmd ?? '');
        return cmd.length > 50 ? cmd.slice(0, 50) + '...' : cmd || 'Running shell';
      }
      case 'websearch':
      case 'search': {
        const query = String(args.query ?? args.term ?? '');
        return query ? `Searching: ${query}` : 'Searching';
      }
      case 'mcp': {
        const name = String(args.tool ?? args.name ?? tool);
        return `Using ${name}`;
      }
      case 'grep':
      case 'glob': {
        const pattern = String(args.pattern ?? args.glob ?? '');
        return pattern ? `${tool.charAt(0).toUpperCase() + tool.slice(1)}: ${pattern}` : tool;
      }
      case 'notebook':
      case 'notebookedit': {
        const path = String(args.file_path ?? '');
        return path ? `Editing notebook ${path}` : 'Editing notebook';
      }
      default:
        return tool;
    }
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
