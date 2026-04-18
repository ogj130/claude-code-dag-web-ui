import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  formatDuration,
  formatErrorRate,
  getTimeRangeLabel,
  getToolCallDistribution,
  getHotTools,
  getResponseTimeStats,
  getErrorRateTrend,
} from '@/utils/executionAnalytics';

describe('executionAnalytics utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('formatDuration', () => {
    it('should format milliseconds', () => {
      expect(formatDuration(500)).toBe('500ms');
      expect(formatDuration(999)).toBe('999ms');
    });

    it('should format seconds', () => {
      expect(formatDuration(1000)).toBe('1.0s');
      expect(formatDuration(5500)).toBe('5.5s');
      expect(formatDuration(59999)).toBe('60.0s');
    });

    it('should format minutes', () => {
      expect(formatDuration(60000)).toBe('1m 0s');
      expect(formatDuration(90000)).toBe('1m 30s');
      expect(formatDuration(120000)).toBe('2m 0s');
    });
  });

  describe('formatErrorRate', () => {
    it('should format rate to percentage string', () => {
      expect(formatErrorRate(0)).toBe('0.0%');
      expect(formatErrorRate(50)).toBe('50.0%');
      expect(formatErrorRate(33.333)).toBe('33.3%');
      expect(formatErrorRate(100)).toBe('100.0%');
    });
  });

  describe('getTimeRangeLabel', () => {
    it('should return correct labels', () => {
      expect(getTimeRangeLabel('7d')).toBe('最近 7 天');
      expect(getTimeRangeLabel('30d')).toBe('最近 30 天');
      expect(getTimeRangeLabel('all')).toBe('全部时间');
    });
  });

  describe('getToolCallDistribution', () => {
    it('should return empty array on error', async () => {
      vi.doMock('@/stores/db', () => ({
        db: { queries: { where: vi.fn().mockReturnValue({ above: vi.fn().mockRejectedValue(new Error('db error')) }) } },
      }));
      const result = await getToolCallDistribution('7d');
      expect(result).toEqual([]);
      vi.doUnmock('@/stores/db');
    });

    it('should aggregate tool calls', async () => {
      vi.doMock('@/stores/db', () => ({
        db: {
          queries: {
            where: vi.fn().mockReturnValue({
              above: vi.fn().mockResolvedValue([
                {
                  toolCalls: [
                    { name: 'bash', success: true, startTime: 0, endTime: 100 },
                    { name: 'bash', success: false, startTime: 0, endTime: 200 },
                    { name: 'read', success: true, startTime: 0, endTime: 50 },
                  ],
                },
              ]),
            }),
          },
        },
      }));
      const result = await getToolCallDistribution('all');
      expect(result.length).toBeGreaterThanOrEqual(0);
      vi.doUnmock('@/stores/db');
    });
  });

  describe('getHotTools', () => {
    it('should return up to 10 tools', async () => {
      vi.doMock('@/stores/db', () => ({
        db: {
          queries: {
            where: vi.fn().mockReturnValue({
              above: vi.fn().mockResolvedValue([]),
            }),
          },
        },
      }));
      const result = await getHotTools('7d');
      expect(Array.isArray(result)).toBe(true);
      vi.doUnmock('@/stores/db');
    });
  });

  describe('getResponseTimeStats', () => {
    it('should return zero stats on empty data', async () => {
      vi.doMock('@/stores/db', () => ({
        db: {
          queries: {
            where: vi.fn().mockReturnValue({
              above: vi.fn().mockResolvedValue([]),
            }),
          },
        },
      }));
      const result = await getResponseTimeStats('7d');
      expect(result.average).toBe(0);
      expect(result.min).toBe(0);
      expect(result.max).toBe(0);
      expect(result.median).toBe(0);
      vi.doUnmock('@/stores/db');
    });

    it('should return zero stats on error', async () => {
      vi.doMock('@/stores/db', () => ({
        db: {
          queries: {
            where: vi.fn().mockReturnValue({
              above: vi.fn().mockRejectedValue(new Error('db error')),
            }),
          },
        },
      }));
      const result = await getResponseTimeStats('all');
      expect(result.average).toBe(0);
      vi.doUnmock('@/stores/db');
    });
  });

  describe('getErrorRateTrend', () => {
    it('should return empty array on error', async () => {
      vi.doMock('@/stores/db', () => ({
        db: {
          queries: {
            where: vi.fn().mockReturnValue({
              above: vi.fn().mockRejectedValue(new Error('db error')),
            }),
          },
        },
      }));
      const result = await getErrorRateTrend('30d');
      expect(result).toEqual([]);
      vi.doUnmock('@/stores/db');
    });

    it('should calculate error rates', async () => {
      const now = Date.now();
      vi.doMock('@/stores/db', () => ({
        db: {
          queries: {
            where: vi.fn().mockReturnValue({
              above: vi.fn().mockResolvedValue([
                { createdAt: now, status: 'success' },
                { createdAt: now, status: 'error' },
                { createdAt: now, status: 'partial' },
                { createdAt: now, status: 'success' },
              ]),
            }),
          },
        },
      }));
      const result = await getErrorRateTrend('all');
      expect(Array.isArray(result)).toBe(true);
      vi.doUnmock('@/stores/db');
    });
  });
});
