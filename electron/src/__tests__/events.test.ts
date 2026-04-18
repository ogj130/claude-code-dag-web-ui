import { describe, it, expect } from 'vitest';
import type {
  NodeStatus,
  DAGNode,
  ToolCall,
  TokenUsage,
  ClaudeEvent,
  WSMessage,
  WSTerminalMessage,
  WSTerminalChunkMessage,
  WSClientMessage,
} from '../types/events';

describe('electron/types/events', () => {
  describe('NodeStatus', () => {
    it('should be a valid union type', () => {
      const statuses: NodeStatus[] = ['pending', 'running', 'completed', 'failed'];
      expect(statuses).toHaveLength(4);
    });
  });

  describe('DAGNode', () => {
    it('should accept valid node structure', () => {
      const node: DAGNode = {
        id: 'node-1',
        label: 'Test Node',
        status: 'running',
        type: 'agent',
      };
      expect(node.id).toBe('node-1');
      expect(node.status).toBe('running');
    });

    it('should accept optional parentId', () => {
      const node: DAGNode = {
        id: 'node-2',
        label: 'Child Node',
        status: 'pending',
        type: 'tool',
        parentId: 'node-1',
      };
      expect(node.parentId).toBe('node-1');
    });

    it('should accept optional timing fields', () => {
      const now = Date.now();
      const node: DAGNode = {
        id: 'node-3',
        label: 'Timed Node',
        status: 'completed',
        type: 'query',
        startTime: now - 1000,
        endTime: now,
      };
      expect(node.startTime).toBe(now - 1000);
      expect(node.endTime).toBe(now);
    });

    it('should accept summaryContent for summary nodes', () => {
      const node: DAGNode = {
        id: 'node-4',
        label: 'Summary',
        status: 'completed',
        type: 'summary',
        summaryContent: '# Summary\n\nSome markdown content',
        endToolIds: ['tool-1', 'tool-2'],
      };
      expect(node.summaryContent).toContain('markdown');
      expect(node.endToolIds).toHaveLength(2);
    });

    it('should accept toolMessage for tool nodes', () => {
      const node: DAGNode = {
        id: 'node-5',
        label: 'Tool',
        status: 'running',
        type: 'tool',
        toolMessage: 'Reading file',
      };
      expect(node.toolMessage).toBe('Reading file');
    });

    it('should accept additional arbitrary properties', () => {
      const node: DAGNode = {
        id: 'node-6',
        label: 'Extra Props',
        status: 'pending',
        type: 'agent',
        customField: 'custom-value',
      };
      expect((node as Record<string, unknown>).customField).toBe('custom-value');
    });
  });

  describe('ToolCall', () => {
    it('should accept valid tool call structure', () => {
      const toolCall: ToolCall = {
        id: 'tool-1',
        tool: 'read',
        args: { file_path: '/tmp/test.txt' },
        status: 'completed',
        startTime: Date.now(),
      };
      expect(toolCall.tool).toBe('read');
      expect(toolCall.status).toBe('completed');
    });

    it('should accept optional result field', () => {
      const toolCall: ToolCall = {
        id: 'tool-2',
        tool: 'bash',
        args: { command: 'ls' },
        status: 'completed',
        startTime: Date.now(),
        result: 'file1.txt\nfile2.txt',
        endTime: Date.now(),
      };
      expect(toolCall.result).toBeDefined();
    });

    it('should accept optional parentId', () => {
      const toolCall: ToolCall = {
        id: 'tool-3',
        tool: 'edit',
        args: {},
        status: 'running',
        startTime: Date.now(),
        parentId: 'query-1',
      };
      expect(toolCall.parentId).toBe('query-1');
    });
  });

  describe('TokenUsage', () => {
    it('should accept valid token usage', () => {
      const usage: TokenUsage = { input: 1000, output: 500 };
      expect(usage.input).toBe(1000);
      expect(usage.output).toBe(500);
    });
  });

  describe('ClaudeEvent union types', () => {
    it('should accept agent_start event', () => {
      const event: ClaudeEvent = { type: 'agent_start', agentId: 'a1', label: 'Agent 1' };
      expect(event.type).toBe('agent_start');
    });

    it('should accept agent_end event', () => {
      const event: ClaudeEvent = { type: 'agent_end', agentId: 'a1', result: 'done' };
      expect(event.type).toBe('agent_end');
    });

    it('should accept tool_call event', () => {
      const event: ClaudeEvent = {
        type: 'tool_call',
        toolId: 't1',
        tool: 'read',
        args: { path: '/a' },
      };
      expect(event.type).toBe('tool_call');
    });

    it('should accept tool_result event with success status', () => {
      const event: ClaudeEvent = {
        type: 'tool_result',
        toolId: 't1',
        result: 'file content',
        status: 'success',
      };
      expect(event.status).toBe('success');
    });

    it('should accept tool_result event with error status', () => {
      const event: ClaudeEvent = {
        type: 'tool_result',
        toolId: 't1',
        result: 'error message',
        status: 'error',
      };
      expect(event.status).toBe('error');
    });

    it('should accept tool_progress event', () => {
      const event: ClaudeEvent = {
        type: 'tool_progress',
        toolId: 't1',
        tool: 'read',
        message: 'Reading /tmp/file.txt',
      };
      expect(event.message).toContain('Reading');
    });

    it('should accept token_usage event', () => {
      const event: ClaudeEvent = {
        type: 'token_usage',
        usage: { input: 500, output: 200 },
      };
      expect(event.usage.input).toBe(500);
    });

    it('should accept error event', () => {
      const event: ClaudeEvent = { type: 'error', message: 'Something went wrong' };
      expect(event.type).toBe('error');
    });

    it('should accept session_start event', () => {
      const event: ClaudeEvent = { type: 'session_start', sessionId: 's1' };
      expect(event.sessionId).toBe('s1');
    });

    it('should accept session_end event', () => {
      const event: ClaudeEvent = { type: 'session_end', sessionId: 's1', reason: 'killed' };
      expect(event.reason).toBe('killed');
    });

    it('should accept streamEnd event', () => {
      const event: ClaudeEvent = { type: 'streamEnd', queryId: 'q1' };
      expect(event.type).toBe('streamEnd');
    });

    it('should accept user_input_sent event', () => {
      const event: ClaudeEvent = { type: 'user_input_sent', queryId: 'q1', text: 'hello' };
      expect(event.text).toBe('hello');
    });

    it('should accept query_start event', () => {
      const event: ClaudeEvent = { type: 'query_start', queryId: 'q1', label: 'Query 1' };
      expect(event.label).toBe('Query 1');
    });

    it('should accept query_end event', () => {
      const event: ClaudeEvent = { type: 'query_end', queryId: 'q1' };
      expect(event.queryId).toBe('q1');
    });

    it('should accept query_summary event', () => {
      const event: ClaudeEvent = {
        type: 'query_summary',
        queryId: 'q1',
        summary: 'The task was completed successfully',
        endToolIds: ['t1', 't2'],
      };
      expect(event.summary).toContain('completed');
    });

    it('should accept summary_chunk event', () => {
      const event: ClaudeEvent = { type: 'summary_chunk', queryId: 'q1', chunk: 'partial text' };
      expect(event.chunk).toBe('partial text');
    });
  });

  describe('WSMessage', () => {
    it('should accept valid WSMessage structure', () => {
      const msg: WSMessage = {
        event: { type: 'session_start', sessionId: 's1' },
        sessionId: 's1',
        timestamp: Date.now(),
      };
      expect(msg.sessionId).toBe('s1');
    });

    it('should accept WSMessage with undefined event', () => {
      const msg: WSMessage = {
        sessionId: 's1',
        timestamp: Date.now(),
      };
      expect(msg.event).toBeUndefined();
    });
  });

  describe('WSTerminalMessage', () => {
    it('should accept valid terminal message', () => {
      const msg: WSTerminalMessage = {
        type: 'terminal',
        text: '> Hello world',
        sessionId: 's1',
        timestamp: Date.now(),
      };
      expect(msg.type).toBe('terminal');
      expect(msg.text).toContain('Hello');
    });
  });

  describe('WSTerminalChunkMessage', () => {
    it('should accept valid terminal chunk message', () => {
      const msg: WSTerminalChunkMessage = {
        type: 'terminalChunk',
        text: 'streaming text',
        sessionId: 's1',
        timestamp: Date.now(),
      };
      expect(msg.type).toBe('terminalChunk');
    });
  });

  describe('WSClientMessage union types', () => {
    it('should accept start_session message', () => {
      const msg: WSClientMessage = {
        type: 'start_session',
        sessionId: 's1',
        projectPath: '/tmp/project',
        prompt: 'Hello',
      };
      expect(msg.type).toBe('start_session');
    });

    it('should accept send_input message', () => {
      const msg: WSClientMessage = {
        type: 'send_input',
        sessionId: 's1',
        input: 'Continue with the task',
      };
      expect(msg.input).toContain('task');
    });

    it('should accept kill_session message', () => {
      const msg: WSClientMessage = {
        type: 'kill_session',
        sessionId: 's1',
      };
      expect(msg.sessionId).toBe('s1');
    });
  });
});
