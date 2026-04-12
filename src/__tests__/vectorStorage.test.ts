/**
 * vectorStorage.ts — 单元测试
 *
 * 测试策略：
 *   jsdom 环境下 isElectron = false，所有函数走 localVectorStorage 路径。
 *   - vi.mock('@/utils/embedding') 隔离 embedText
 *   - vi.mock('@/stores/localVectorStorage') 提供可预测的 mock 返回值
 *   - 验证 localVectorStorage mock 被正确调用（参数透传）
 *   - 验证返回值正确传递
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock embedText ────────────────────────────────────────────────────────────
vi.mock('@/utils/embedding', () => ({
  embedText: vi.fn().mockResolvedValue([0.1, 0.2, 0.3, 0.4]),
}));

// ── Mock localVectorStorage ──────────────────────────────────────────────────
// jsdom 下 isElectron = false，走此路径
const mockLocal = {
  indexQueryChunk: vi.fn().mockResolvedValue('local_q-123'),
  indexToolCallChunk: vi.fn().mockResolvedValue('local_tc-456'),
  indexAnswerChunks: vi.fn().mockResolvedValue([]),
  search: vi.fn().mockResolvedValue([
    {
      id: 'q_test-123',
      score: 0.95,
      content: 'Hello world',
      chunkType: 'query' as const,
      sessionId: 's1',
      queryId: 'q1',
      workspacePath: '/test',
      timestamp: 1710000000,
      metadata: {},
    },
  ]),
  searchWithVector: vi.fn().mockResolvedValue([]),
  listTables: vi.fn().mockResolvedValue([]),
  getTableStats: vi.fn().mockResolvedValue({ totalChunks: 0, tables: [] }),
  rebuildIndex: vi.fn().mockResolvedValue(undefined),
  closeDb: vi.fn().mockResolvedValue(undefined),
};

vi.mock('@/stores/localVectorStorage', () => mockLocal);

// ── Import after mocks ──────────────────────────────────────────────────────
import {
  indexQueryChunk,
  indexToolCallChunk,
  search,
  searchWithVector,
  listTables,
  getTableStats,
  rebuildIndex,
  closeDb,
} from '@/stores/vectorStorage';

describe('vectorStorage', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── indexQueryChunk ─────────────────────────────────────────────────────
  describe('indexQueryChunk', () => {
    it('调用 embedText 获取向量，然后透传到 localVectorStorage', async () => {
      const { embedText } = await import('@/utils/embedding');

      const id = await indexQueryChunk(
        's1', 'q1', '/test', 'Hello world', { foo: 'bar' }
      );

      expect(embedText).toHaveBeenCalledWith('Hello world');
      expect(mockLocal.indexQueryChunk).toHaveBeenCalledWith(
        's1', 'q1', '/test', 'Hello world', { foo: 'bar' }
      );
      expect(id).toBe('local_q-123');
    });

    it('metadata 默认为空对象', async () => {
      await indexQueryChunk('s1', 'q1', '/test', 'Hello');
      const call = mockLocal.indexQueryChunk.mock.calls[0];
      // call[3] = content, call[4] = metadata
      expect(call[4]).toEqual({});
    });
  });

  // ── indexToolCallChunk ─────────────────────────────────────────────────
  describe('indexToolCallChunk', () => {
    it('向量化后透传到 localVectorStorage', async () => {
      const id = await indexToolCallChunk(
        's1', 'q1', 'tc-456', '/test', 'Tool result output', {}
      );

      expect(mockLocal.indexToolCallChunk).toHaveBeenCalledWith(
        's1', 'q1', 'tc-456', '/test', 'Tool result output', {}
      );
      expect(id).toBe('local_tc-456');
    });
  });

  // ── search ─────────────────────────────────────────────────────────────
  describe('search', () => {
    it('空查询返回空数组', async () => {
      await expect(search('', { workspacePaths: ['/test'] })).resolves.toEqual([]);
    });

    it('空 workspacePaths 返回空数组', async () => {
      await expect(search('hello', { workspacePaths: [] })).resolves.toEqual([]);
    });

    it('先向量化再透传到 localVectorStorage.search', async () => {
      const { embedText } = await import('@/utils/embedding');

      const results = await search('Find similar queries', {
        workspacePaths: ['/a', '/b'],
        type: 'query',
        topK: 5,
        threshold: 0.7,
      });

      expect(embedText).toHaveBeenCalledWith('Find similar queries');
      expect(mockLocal.search).toHaveBeenCalledWith('Find similar queries', {
        workspacePaths: ['/a', '/b'],
        type: 'query',
        topK: 5,
        threshold: 0.7,
      });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('q_test-123');
    });

    it('默认 topK 和 threshold 由 localVectorStorage 处理（浏览器路径透传）', async () => {
      await search('hello', { workspacePaths: ['/test'] });

      const call = mockLocal.search.mock.calls[0];
      // 浏览器路径透传原始 options，不在此层填充默认值
      expect(call[1].topK).toBeUndefined();
      expect(call[1].threshold).toBeUndefined();
    });
  });

  // ── searchWithVector ───────────────────────────────────────────────────
  describe('searchWithVector', () => {
    it('直接使用已有向量，不调用 embedText', async () => {
      const { embedText } = await import('@/utils/embedding');
      const precomputed = [0.9, 0.8, 0.7, 0.6];

      await searchWithVector(precomputed, {
        workspacePaths: ['/test'],
        type: 'toolcall',
        topK: 3,
      });

      expect(embedText).not.toHaveBeenCalled();
      expect(mockLocal.searchWithVector).toHaveBeenCalledWith(precomputed, {
        workspacePaths: ['/test'],
        type: 'toolcall',
        topK: 3,
      });
    });
  });

  // ── admin ──────────────────────────────────────────────────────────────
  describe('admin operations', () => {
    it('listTables 透传到 localVectorStorage', async () => {
      const tables = await listTables();
      expect(mockLocal.listTables).toHaveBeenCalled();
      expect(tables).toEqual([]);
    });

    it('getTableStats 返回统计信息', async () => {
      const stats = await getTableStats();
      expect(mockLocal.getTableStats).toHaveBeenCalled();
      expect(stats.totalChunks).toBe(0);
      expect(stats.tables).toEqual([]);
    });

    it('rebuildIndex 透传到 localVectorStorage', async () => {
      await rebuildIndex();
      expect(mockLocal.rebuildIndex).toHaveBeenCalled();
    });

    it('closeDb 透传到 localVectorStorage', async () => {
      await closeDb();
      expect(mockLocal.closeDb).toHaveBeenCalled();
    });
  });
});
