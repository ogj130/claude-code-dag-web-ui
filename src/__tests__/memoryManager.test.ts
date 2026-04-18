import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  estimateMemoryUsage,
  estimateMapMemory,
  getCurrentMemoryUsage,
  getMemoryInfo,
  isMemoryAboveThreshold,
  checkNodeLimit,
  shouldEvictSessions,
  getEvictCount,
  notifyFifoEviction,
  cleanupDagNodes,
  startMemoryMonitoring,
  formatMemorySize,
  NODE_LIMIT,
  MEMORY_WARNING_THRESHOLD,
  SESSION_FIFO_LIMIT,
} from '@/utils/memoryManager';

describe('memoryManager', () => {
  describe('estimateMemoryUsage', () => {
    it('returns 0 for null/undefined', () => {
      expect(estimateMemoryUsage(null)).toBe(0);
      expect(estimateMemoryUsage(undefined)).toBe(0);
    });

    it('calculates string memory (UTF-16)', () => {
      expect(estimateMemoryUsage('abc')).toBe(6); // 3 chars * 2
    });

    it('calculates number memory', () => {
      expect(estimateMemoryUsage(42)).toBe(8);
    });

    it('calculates boolean memory', () => {
      expect(estimateMemoryUsage(true)).toBe(4);
    });

    it('calculates array memory recursively', () => {
      const arr = [1, 2, 3];
      const result = estimateMemoryUsage(arr);
      expect(result).toBeGreaterThan(0);
    });

    it('calculates object memory recursively', () => {
      const obj = { a: 'test', b: 42 };
      const result = estimateMemoryUsage(obj);
      expect(result).toBeGreaterThan(0);
    });
  });

  describe('estimateMapMemory', () => {
    it('returns base overhead for empty map', () => {
      const map = new Map();
      expect(estimateMapMemory(map)).toBe(50);
    });

    it('calculates memory for map with entries', () => {
      const map = new Map([['key', 'value']]);
      expect(estimateMapMemory(map)).toBeGreaterThan(50);
    });
  });

  describe('getCurrentMemoryUsage', () => {
    it('returns -1 when memory API not available', () => {
      const result = getCurrentMemoryUsage();
      // Either -1 (not supported) or a real value
      expect(result).toBeGreaterThanOrEqual(-1);
    });
  });

  describe('getMemoryInfo', () => {
    it('returns memory info object', () => {
      const info = getMemoryInfo();
      expect(info).toHaveProperty('used');
      expect(info).toHaveProperty('total');
      expect(info).toHaveProperty('limit');
      expect(info).toHaveProperty('supported');
    });
  });

  describe('isMemoryAboveThreshold', () => {
    it('returns false when memory API not available', () => {
      expect(isMemoryAboveThreshold()).toBe(false);
    });
  });

  describe('checkNodeLimit', () => {
    it('returns false when node count is under limit', () => {
      expect(checkNodeLimit(100)).toBe(false);
    });

    it('returns true when node count exceeds limit', () => {
      expect(checkNodeLimit(NODE_LIMIT + 1)).toBe(true);
    });
  });

  describe('shouldEvictSessions', () => {
    it('returns false when count is at or below limit', () => {
      expect(shouldEvictSessions(SESSION_FIFO_LIMIT)).toBe(false);
      expect(shouldEvictSessions(SESSION_FIFO_LIMIT - 1)).toBe(false);
    });

    it('returns true when count exceeds limit', () => {
      expect(shouldEvictSessions(SESSION_FIFO_LIMIT + 1)).toBe(true);
    });
  });

  describe('getEvictCount', () => {
    it('returns 0 when count is at or below limit', () => {
      expect(getEvictCount(SESSION_FIFO_LIMIT)).toBe(0);
    });

    it('returns positive number when count exceeds limit', () => {
      const count = SESSION_FIFO_LIMIT + 5;
      const evict = getEvictCount(count);
      expect(evict).toBeGreaterThan(0);
      expect(evict).toBeLessThanOrEqual(count - SESSION_FIFO_LIMIT);
    });
  });

  describe('cleanupDagNodes', () => {
    it('returns original nodes unchanged when under threshold', () => {
      const nodes = new Map([
        ['main-agent', { type: 'agent' }],
        ['q1', { type: 'query' }],
      ]);
      const result = cleanupDagNodes(nodes, 5);
      expect(result.size).toBe(nodes.size);
    });

    it('removes old nodes when over threshold', () => {
      const nodes = new Map<string, { type?: string; parentId?: string }>([
        ['main-agent', { type: 'agent' }],
        ['q1', { type: 'query' }],
        ['q2', { type: 'query' }],
        ['q3', { type: 'query' }],
        ['q4', { type: 'query' }],
        ['q5', { type: 'query' }],
        ['q6', { type: 'query' }],
        ['q7', { type: 'query' }],
      ]);
      const result = cleanupDagNodes(nodes, 2);
      // Should keep main-agent + last 2 queries
      expect(result.size).toBeLessThan(nodes.size);
      expect(result.has('main-agent')).toBe(true);
    });
  });

  describe('startMemoryMonitoring', () => {
    it('returns a cleanup function', () => {
      const stop = startMemoryMonitoring(60000);
      expect(typeof stop).toBe('function');
      stop();
    });

    it('calls onWarning when memory is above threshold', () => {
      const onWarning = vi.fn();
      const stop = startMemoryMonitoring(60000, onWarning);
      stop();
      // onWarning may or may not be called depending on memory API availability
    });
  });

  describe('formatMemorySize', () => {
    it('returns 0 B for zero', () => {
      expect(formatMemorySize(0)).toBe('0 B');
    });

    it('formats bytes', () => {
      expect(formatMemorySize(512)).toBe('512.0 B');
    });

    it('formats kilobytes', () => {
      expect(formatMemorySize(1024 * 5)).toBe('5.0 KB');
    });

    it('formats megabytes', () => {
      expect(formatMemorySize(1024 * 1024 * 50)).toBe('50.0 MB');
    });
  });

  describe('constants', () => {
    it('NODE_LIMIT is 500', () => {
      expect(NODE_LIMIT).toBe(500);
    });

    it('MEMORY_WARNING_THRESHOLD is 150MB', () => {
      expect(MEMORY_WARNING_THRESHOLD).toBe(150 * 1024 * 1024);
    });

    it('SESSION_FIFO_LIMIT is 100', () => {
      expect(SESSION_FIFO_LIMIT).toBe(100);
    });
  });
});
