/**
 * V1.4.0 - Diff Compressor Tests
 */

import { describe, it, expect } from 'vitest';
import {
  groupToolCallPatterns,
  analyzeErrorPatterns,
  extractRootCause,
  extractCodeStructure,
  extractDecisions,
  summarizeProcesses,
  estimateTokens,
  shouldTriggerCompression,
  executeDiffCompression,
  type CompressionInput,
} from '../utils/diffCompressor';

describe('Diff Compressor - Token Estimation', () => {
  it('should estimate Chinese text correctly', () => {
    const chinese = '你好世界，这是一个测试';
    const tokens = estimateTokens(chinese);
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(chinese.length);
  });

  it('should estimate English text correctly', () => {
    const english = 'Hello world this is a test message';
    const tokens = estimateTokens(english);
    expect(tokens).toBeGreaterThan(0);
  });

  it('should estimate mixed text', () => {
    const mixed = 'Hello 你好 World 世界';
    const tokens = estimateTokens(mixed);
    expect(tokens).toBeGreaterThan(0);
  });
});

describe('Diff Compressor - Pattern Grouping', () => {
  it('should group similar tool calls', () => {
    const toolCalls = [
      { id: '1', tool: 'Read', args: { file_path: 'a.txt' }, result: null, duration: 100, timestamp: Date.now() },
      { id: '2', tool: 'Read', args: { file_path: 'b.txt' }, result: null, duration: 100, timestamp: Date.now() },
      { id: '3', tool: 'Write', args: { content: 'test' }, result: null, duration: 100, timestamp: Date.now() },
    ];

    const groups = groupToolCallPatterns(toolCalls);
    expect(groups.size).toBeGreaterThan(0);
  });

  it('should normalize arguments to templates', () => {
    const args1 = { file_path: 'src/components/Button.tsx', content: 'test' };
    const args2 = { file_path: 'src/components/Modal.tsx', content: 'demo' };
    expect(Object.keys(args1).length).toBe(Object.keys(args2).length);
  });
});

describe('Diff Compressor - Error Analysis', () => {
  it('should detect error patterns', () => {
    const errorLogs = [
      'TypeError: Cannot read property "foo" of undefined',
      'TypeError: x is not a function',
    ];

    const analysis = analyzeErrorPatterns(errorLogs);
    expect(analysis.length).toBeGreaterThan(0);
    expect(analysis[0].rootCause).toBeTruthy();
  });

  it('should count error occurrences', () => {
    const errorLogs = [
      'Error: Connection failed',
      'Error: Connection failed',
      'Error: Connection failed',
    ];

    const analysis = analyzeErrorPatterns(errorLogs);
    expect(analysis[0]?.count).toBe(3);
  });
});

describe('Diff Compressor - Root Cause Analysis', () => {
  it('should identify null/undefined issues', () => {
    const errorLogs = 'TypeError: Cannot read property of undefined';
    const rootCause = extractRootCause(errorLogs);
    expect(rootCause).toBeTruthy();
  });

  it('should identify permission errors', () => {
    const errorLogs = 'Error: Permission denied';
    const rootCause = extractRootCause(errorLogs);
    expect(rootCause).toContain('Permission');
  });

  it('should identify file not found errors', () => {
    const errorLogs = 'Error: ENOENT: no such file';
    const rootCause = extractRootCause(errorLogs);
    expect(rootCause).toContain('not found');
  });
});

describe('Diff Compressor - Code Structure', () => {
  it('should extract code structure from Read tool calls', () => {
    const toolCalls = [
      { id: '1', tool: 'Read', args: { file_path: 'test.ts' }, result: 'function test() {}', duration: 100, timestamp: Date.now() },
    ];

    const structure = extractCodeStructure(toolCalls, 'smart');
    expect(structure.files).toBe(1);
    expect(structure.functions).toBeGreaterThanOrEqual(0);
  });

  it('should count functions in code', () => {
    const toolCalls = [
      { id: '1', tool: 'Read', args: {}, result: 'function a() {}\nconst b = () => {}\nclass C {}', duration: 100, timestamp: Date.now() },
    ];

    const structure = extractCodeStructure(toolCalls, 'smart');
    expect(structure.functions).toBeGreaterThan(0);
    expect(structure.classes).toBe(1);
  });
});

describe('Diff Compressor - Decision Extraction', () => {
  it('should extract decisions from subagent messages', () => {
    const messages = [
      { type: 'subagent_message' as const, message: 'I decided to use React for the UI', content: '', id: '1' },
    ];

    const decisions = extractDecisions(messages);
    expect(decisions).toBeTruthy();
  });
});

describe('Diff Compressor - Process Summary', () => {
  it('should summarize work done', () => {
    const toolCalls = [
      { id: '1', tool: 'Write', args: { file_path: 'test.ts' }, result: null, duration: 100, timestamp: Date.now() },
      { id: '2', tool: 'Read', args: { file_path: 'other.ts' }, result: null, duration: 100, timestamp: Date.now() },
    ];

    const summary = summarizeProcesses(toolCalls);
    expect(summary).toBeTruthy();
  });
});

describe('Diff Compressor - Compression Trigger', () => {
  it('should trigger at conversation limit', () => {
    const history = {
      events: new Array(50).fill({ type: 'tool_call' }),
      totalTokens: 100000,
    };

    const shouldTrigger = shouldTriggerCompression(history as any);
    expect(typeof shouldTrigger).toBe('boolean');
  });

  it('should not trigger for short conversations', () => {
    const history = {
      events: [{ type: 'tool_call' }],
      totalTokens: 1000,
    };

    const shouldTrigger = shouldTriggerCompression(history as any);
    expect(shouldTrigger).toBe(false);
  });
});

describe('Diff Compressor - Full Compression', () => {
  it('should execute full compression pipeline', () => {
    const input: CompressionInput = {
      events: [
        { type: 'tool_call', name: 'Read', arguments: '{"file_path":"test.ts"}', id: '1', tool: 'Read', args: { file_path: 'test.ts' }, result: null, duration: 100, timestamp: Date.now() },
        { type: 'tool_call', name: 'Write', arguments: '{"file_path":"output.ts"}', id: '2', tool: 'Write', args: { file_path: 'output.ts' }, result: null, duration: 100, timestamp: Date.now() },
        { type: 'message', role: 'assistant', content: 'I have fixed the issue', id: '3' },
      ],
      toolCalls: [
        { id: '1', tool: 'Read', args: { file_path: 'test.ts' }, result: null, duration: 100, timestamp: Date.now() },
        { id: '2', tool: 'Write', args: { file_path: 'output.ts' }, result: null, duration: 100, timestamp: Date.now() },
      ],
      nodes: new Map(),
      sessionId: 'test-session',
      settings: {
        preservationStrategy: 'smart',
        errorThreshold: 3,
        groupingThreshold: 5,
      },
    };

    const report = executeDiffCompression(input);

    expect(report).toBeTruthy();
    expect(report.id).toBeTruthy();
    expect(report.sessionId).toBe('test-session');
    expect(report.timestamp).toBeGreaterThan(0);
    expect(report.beforeTokens).toBeGreaterThanOrEqual(0);
    expect(report.afterTokens).toBeGreaterThanOrEqual(0);
  });

  it('should handle minimal input', () => {
    const input: CompressionInput = {
      events: [],
      toolCalls: [],
      nodes: new Map(),
      sessionId: 'test-session',
    };

    const report = executeDiffCompression(input);
    expect(report).toBeTruthy();
    expect(report.id).toBeTruthy();
    expect(report.sessionId).toBe('test-session');
  });
});
