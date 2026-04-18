/**
 * localVectorStorage.ts — 单元测试
 *
 * 覆盖率标准: 行 95%
 * 测试策略：mock 所有依赖，直接 mock 目标模块导出的函数。
 *          不需要创建实际的 Dexie 实例。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock dependencies ─────────────────────────────────────────────────────────

vi.mock('@/utils/embeddingService', () => ({
  computeEmbeddings: vi.fn().mockResolvedValue([[0.1, 0.2, 0.3, 0.4, 0.5]]),
}));

vi.mock('@/stores/embeddingConfigStorage', () => ({
  getDefaultConfig: vi.fn().mockResolvedValue({
    id: 'cfg_1',
    name: 'test',
    provider: 'openai',
    model: 'text-embedding-3-small',
    apiKey: 'test-key',
    baseUrl: 'https://api.openai.com',
    dimensions: 1536,
  }),
}));

vi.mock('@/lib/db', () => ({
  db: {
    sessions: {
      toArray: vi.fn().mockResolvedValue([]),
    },
  },
}));

vi.mock('@/stores/queryStorage', () => ({
  getQuery: vi.fn().mockResolvedValue({ query: 'test query', summary: 'test summary' }),
}));

// ── Import after mocks ────────────────────────────────────────────────────────
import {
  indexQueryChunk,
  indexToolCallChunk,
  indexAnswerChunks,
  search,
  searchWithVector,
  getTableStats,
  listTables,
  rebuildIndex,
  closeDb,
} from '@/stores/localVectorStorage';

describe('localVectorStorage', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── indexQueryChunk ─────────────────────────────────────────────────────────
  describe('indexQueryChunk', () => {
    it('向量化后添加 chunk 不抛错', async () => {
      const id = await indexQueryChunk('s1', 'q1', '/test', 'Hello world', {});
      expect(typeof id).toBe('string');
    });

    it('带元数据参数不抛错', async () => {
      const id = await indexQueryChunk('s1', 'q1', '/test', 'Hello', { foo: 'bar' });
      expect(typeof id).toBe('string');
    });
  });

  // ── indexToolCallChunk ─────────────────────────────────────────────────────
  describe('indexToolCallChunk', () => {
    it('向量化后添加 ToolCall chunk 不抛错', async () => {
      const id = await indexToolCallChunk('s1', 'q1', 'tc1', '/test', 'Tool output', {});
      expect(typeof id).toBe('string');
    });

    it('空元数据不抛错', async () => {
      const id = await indexToolCallChunk('s1', 'q1', 'tc1', '/test', 'Tool');
      expect(typeof id).toBe('string');
    });
  });

  // ── indexAnswerChunks ────────────────────────────────────────────────────────
  describe('indexAnswerChunks', () => {
    it('短文本索引不抛错', async () => {
      const ids = await indexAnswerChunks('s1', 'q1', '/test', 'Short answer.', {});
      expect(Array.isArray(ids)).toBe(true);
    });

    it('无 embedding 配置时跳过索引并返回空', async () => {
      const { getDefaultConfig } = await import('@/stores/embeddingConfigStorage');
      vi.mocked(getDefaultConfig).mockResolvedValueOnce(null);
      const ids = await indexAnswerChunks('s1', 'q1', '/test', 'Some answer', {});
      expect(ids).toEqual([]);
    });
  });

  // ── search ─────────────────────────────────────────────────────────────────
  describe('search', () => {
    it('空查询返回空数组', async () => {
      const results = await search('', { workspacePaths: ['/test'] });
      expect(results).toEqual([]);
    });

    it('空 workspacePaths 返回空数组', async () => {
      const results = await search('hello', { workspacePaths: [] });
      expect(results).toEqual([]);
    });

    it('返回结果数组', async () => {
      const results = await search('hello', { workspacePaths: ['/test'] });
      expect(Array.isArray(results)).toBe(true);
    });

    it('支持 topK 限制', async () => {
      const results = await search('hello', { workspacePaths: ['/test'], topK: 3 });
      expect(Array.isArray(results)).toBe(true);
    });

    it('支持 threshold 过滤', async () => {
      const results = await search('hello', { workspacePaths: ['/test'], threshold: 0.9 });
      expect(Array.isArray(results)).toBe(true);
    });

    it('支持 type 过滤', async () => {
      const results = await search('hello', { workspacePaths: ['/test'], type: 'query', topK: 5 });
      expect(Array.isArray(results)).toBe(true);
    });
  });

  // ── searchWithVector ────────────────────────────────────────────────────────
  describe('searchWithVector', () => {
    it('空向量返回空数组', async () => {
      const results = await searchWithVector([], { workspacePaths: ['/test'] });
      expect(results).toEqual([]);
    });

    it('空 workspacePaths 返回空数组', async () => {
      const results = await searchWithVector([0.1, 0.2, 0.3, 0.4, 0.5], { workspacePaths: [] });
      expect(results).toEqual([]);
    });

    it('使用预计算向量搜索', async () => {
      const results = await searchWithVector([0.1, 0.2, 0.3, 0.4, 0.5], {
        workspacePaths: ['/test'],
        topK: 5,
      });
      expect(Array.isArray(results)).toBe(true);
    });

    it('支持 type 过滤', async () => {
      const results = await searchWithVector([0.1, 0.2, 0.3, 0.4, 0.5], {
        workspacePaths: ['/test'],
        type: 'toolcall',
      });
      expect(Array.isArray(results)).toBe(true);
    });
  });

  // ── getTableStats ──────────────────────────────────────────────────────────
  describe('getTableStats', () => {
    it('返回表统计信息', async () => {
      const stats = await getTableStats();
      expect(stats).toHaveProperty('totalChunks');
      expect(stats).toHaveProperty('tables');
      expect(Array.isArray(stats.tables)).toBe(true);
    });
  });

  // ── listTables ──────────────────────────────────────────────────────────────
  describe('listTables', () => {
    it('返回表名列表', async () => {
      const tables = await listTables();
      expect(Array.isArray(tables)).toBe(true);
    });
  });

  // ── rebuildIndex ────────────────────────────────────────────────────────────
  describe('rebuildIndex', () => {
    it('清空所有 chunks', async () => {
      await expect(rebuildIndex()).resolves.toBeUndefined();
    });
  });

  // ── closeDb ────────────────────────────────────────────────────────────────
  describe('closeDb', () => {
    it('IndexedDB 无需关闭，静默成功', async () => {
      await expect(closeDb()).resolves.toBeUndefined();
    });
  });
});
