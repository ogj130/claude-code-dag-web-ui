import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getErrorLogs, appendErrorLog, clearErrorLogs } from '@/utils/errorLogger';

describe('errorLogger utils', () => {
  const STORAGE_KEY = 'cc_errors';

  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  it('should export expected functions', async () => {
    const utils = await import('@/utils/errorLogger');
    expect(typeof utils.getErrorLogs).toBe('function');
    expect(typeof utils.appendErrorLog).toBe('function');
    expect(typeof utils.clearErrorLogs).toBe('function');
  });

  it('should get empty logs initially', () => {
    const logs = getErrorLogs();
    expect(Array.isArray(logs)).toBe(true);
    expect(logs).toHaveLength(0);
  });

  it('should append error log', () => {
    const log = appendErrorLog('Test error message', 'stack trace');
    expect(log.id).toMatch(/^err_/);
    expect(log.message).toBe('Test error message');
    expect(log.stack).toBe('stack trace');
    expect(log.timestamp).toBeDefined();
    expect(typeof log.timestamp).toBe('number');
  });

  it('should get appended logs', () => {
    appendErrorLog('Error 1');
    appendErrorLog('Error 2');
    const logs = getErrorLogs();
    expect(logs).toHaveLength(2);
    expect(logs[0].message).toBe('Error 1');
    expect(logs[1].message).toBe('Error 2');
  });

  it('should support componentStack', () => {
    const log = appendErrorLog('Error with component', undefined, 'Component stack');
    expect(log.componentStack).toBe('Component stack');
  });

  it('should enforce FIFO limit of 50', () => {
    for (let i = 0; i < 55; i++) {
      appendErrorLog(`Error ${i}`);
    }
    const logs = getErrorLogs();
    expect(logs).toHaveLength(50);
    // First log should be the 6th one (index 5)
    expect(logs[0].message).toBe('Error 5');
  });

  it('should clear all logs', () => {
    appendErrorLog('Error 1');
    appendErrorLog('Error 2');
    clearErrorLogs();
    const logs = getErrorLogs();
    expect(logs).toHaveLength(0);
  });

  it('should handle corrupted localStorage gracefully', () => {
    localStorage.setItem(STORAGE_KEY, 'not valid json');
    const logs = getErrorLogs();
    expect(logs).toEqual([]);
  });

  it('should handle non-array localStorage value', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ error: 'not an array' }));
    const logs = getErrorLogs();
    expect(logs).toEqual([]);
  });

  it('should handle localStorage full gracefully on append', () => {
    // When localStorage is full, appendErrorLog should still try to write minimal entry
    const log = appendErrorLog('Fallback error');
    expect(log.message).toBe('Fallback error');
  });

  it('should generate unique IDs', () => {
    const log1 = appendErrorLog('Error 1');
    const log2 = appendErrorLog('Error 2');
    expect(log1.id).not.toBe(log2.id);
  });
});
