import { EventEmitter } from 'events';
import type { ClaudeEvent } from '../src/types/events.js';

export class AnsiParser extends EventEmitter {
  private buffer = '';

  feed(data: string): void {
    this.buffer += data;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() ?? '';

    for (const line of lines) {
      const event = this.parseLine(line);
      if (event) {
        this.emit('event', event);
      }
    }
  }

  flush(): void {
    if (this.buffer) {
      const event = this.parseLine(this.buffer);
      if (event) this.emit('event', event);
      this.buffer = '';
    }
  }

  private parseLine(line: string): ClaudeEvent | null {
    // 去掉 ANSI 转义序列
    const clean = line.replace(/\x1b\[[0-9;]*m/g, '').trim();
    if (!clean) return null;

    // Agent 启动: ››› Agent: xxx 启动
    const agentMatch = clean.match(/›››\s*Agent:\s*(.+?)\s*(启动|开始|start)/);
    if (agentMatch) {
      return { type: 'agent_start', agentId: `agent_${Date.now()}`, label: agentMatch[1] };
    }

    // Agent 完成
    const agentEnd = clean.match(/›››\s*Agent:\s*(.+?)\s*(✓|完成|end|done)/);
    if (agentEnd) {
      return { type: 'agent_end', agentId: `agent_${Date.now()}`, result: agentEnd[1] };
    }

    // 工具调用: ››› Bash xxx, ››› Read xxx
    const toolMatch = clean.match(/›››\s*([A-Za-z]+)\s*(.*)/);
    if (toolMatch && !clean.includes('Agent')) {
      const tool = toolMatch[1].toLowerCase();
      const toolId = `tool_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      return {
        type: 'tool_call',
        toolId,
        tool,
        args: { raw: toolMatch[2] || '' }
      };
    }

    // 成功结果
    if (clean.startsWith('✓') || clean.includes('完成') || clean.includes('success')) {
      return { type: 'tool_result', toolId: 'last', result: clean, status: 'success' };
    }

    // 错误
    if (clean.includes('error') || clean.includes('Error') || clean.includes('失败')) {
      return { type: 'tool_result', toolId: 'last', result: clean, status: 'error' };
    }

    // Token 用量
    const tokenMatch = clean.match(/tokens?[:\s]+(\d+)/i);
    if (tokenMatch) {
      return { type: 'token_usage', usage: { input: parseInt(tokenMatch[1]), output: 0 } };
    }

    return null;
  }
}
