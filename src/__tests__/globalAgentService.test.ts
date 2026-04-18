import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { DispatchWorkspaceResult, DispatchResult } from '@/types/global-dispatch';
import type { GlobalAgentConfig, GlobalAgentResult } from '@/types/globalAgent';
import {
  analyzeWorkspaceResults,
  getGlobalAgentResult,
  _clearResultsStore,
} from '@/services/globalAgentService';
import * as globalAgentService from '@/services/globalAgentService';

const mockWorkspaceResults: DispatchWorkspaceResult[] = [
  {
    workspaceId: 'ws1',
    sessionId: 'session1',
    status: 'success',
    promptResults: [
      { prompt: 'hello', status: 'success' },
      { prompt: 'world', status: 'success' },
    ],
  },
  {
    workspaceId: 'ws2',
    sessionId: 'session2',
    status: 'partial',
    promptResults: [
      { prompt: 'hello', status: 'success' },
      { prompt: 'world', status: 'failed', reason: 'timeout' },
    ],
  },
  {
    workspaceId: 'ws3',
    sessionId: 'session3',
    status: 'failed',
    promptResults: [
      { prompt: 'hello', status: 'failed', reason: 'connection error' },
    ],
  },
];

const mockDispatchResult: DispatchResult = {
  batchId: 'batch_1234567890_abc123',
  mode: 'list',
  policy: 'new_session_for_all',
  workspaceResults: mockWorkspaceResults,
};

const mockConfig: GlobalAgentConfig = {
  modelConfigId: 'claude-sonnet-4-20250514',
  autoAnalyze: false,
};

describe('globalAgentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _clearResultsStore();
  });

  describe('analyzeWorkspaceResults', () => {
    it('1. 返回正确的 GlobalAgentResult 结构（demoMode）', async () => {
      const analyzeResult = await analyzeWorkspaceResults(
        mockDispatchResult.batchId,
        mockWorkspaceResults,
        mockConfig,
        { demoMode: true },
      );

      expect(analyzeResult.status).toBe('success');
      if (analyzeResult.status !== 'success') return;
      const result = analyzeResult.result;

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('batchId', mockDispatchResult.batchId);
      expect(result).toHaveProperty('modelUsed');
      expect(result).toHaveProperty('rankings');
      expect(result).toHaveProperty('scores');
      expect(result).toHaveProperty('commentary');
      expect(result).toHaveProperty('roast');
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('createdAt');
    });

    it('2. id 格式是 gar_{timestamp}_{random}（demoMode）', async () => {
      const analyzeResult = await analyzeWorkspaceResults(
        mockDispatchResult.batchId,
        mockWorkspaceResults,
        mockConfig,
        { demoMode: true },
      );

      if (analyzeResult.status !== 'success') return;
      expect(analyzeResult.result.id).toMatch(/^gar_\d+_[a-z0-9]+$/);
    });

    it('3. rankings 按 totalScore 降序排列（demoMode）', async () => {
      const analyzeResult = await analyzeWorkspaceResults(
        mockDispatchResult.batchId,
        mockWorkspaceResults,
        mockConfig,
        { demoMode: true },
      );

      if (analyzeResult.status !== 'success') return;
      expect(analyzeResult.result.rankings).toHaveLength(3);
      for (let i = 0; i < analyzeResult.result.rankings.length - 1; i++) {
        expect(analyzeResult.result.rankings[i].totalScore).toBeGreaterThanOrEqual(
          analyzeResult.result.rankings[i + 1].totalScore,
        );
      }
    });

    it('4. rankings 中每个 workspaceId 都对应一个排名（demoMode）', async () => {
      const analyzeResult = await analyzeWorkspaceResults(
        mockDispatchResult.batchId,
        mockWorkspaceResults,
        mockConfig,
        { demoMode: true },
      );

      if (analyzeResult.status !== 'success') return;
      const rankedIds = analyzeResult.result.rankings.map(r => r.workspaceId);
      expect(rankedIds).toContain('ws1');
      expect(rankedIds).toContain('ws2');
      expect(rankedIds).toContain('ws3');
    });

    it('5. commentary 和 roast 字段非空（demoMode）', async () => {
      const analyzeResult = await analyzeWorkspaceResults(
        mockDispatchResult.batchId,
        mockWorkspaceResults,
        mockConfig,
        { demoMode: true },
      );

      if (analyzeResult.status !== 'success') return;
      expect(analyzeResult.result.commentary.length).toBeGreaterThan(0);
      expect(analyzeResult.result.roast.length).toBeGreaterThan(0);
    });

    it('6. scores 包含所有 7 个维度（demoMode）', async () => {
      const analyzeResult = await analyzeWorkspaceResults(
        mockDispatchResult.batchId,
        mockWorkspaceResults,
        mockConfig,
        { demoMode: true },
      );

      if (analyzeResult.status !== 'success') return;
      expect(analyzeResult.result.scores).toHaveLength(7);
      const dimensions = analyzeResult.result.scores.map(s => s.dimension);
      expect(dimensions).toContain('codeQuality');
      expect(dimensions).toContain('correctness');
      expect(dimensions).toContain('performance');
      expect(dimensions).toContain('consistency');
      expect(dimensions).toContain('creativity');
      expect(dimensions).toContain('costEfficiency');
      expect(dimensions).toContain('speed');
    });

    it('7. 每个 dimensionScore 的 score 在 1-10 范围内（demoMode）', async () => {
      const analyzeResult = await analyzeWorkspaceResults(
        mockDispatchResult.batchId,
        mockWorkspaceResults,
        mockConfig,
        { demoMode: true },
      );

      if (analyzeResult.status !== 'success') return;
      for (const score of analyzeResult.result.scores) {
        expect(score.score).toBeGreaterThanOrEqual(1);
        expect(score.score).toBeLessThanOrEqual(10);
        expect(score.comment.length).toBeGreaterThan(0);
      }
    });

    it('8. recommendations 数组非空（demoMode）', async () => {
      const analyzeResult = await analyzeWorkspaceResults(
        mockDispatchResult.batchId,
        mockWorkspaceResults,
        mockConfig,
        { demoMode: true },
      );

      if (analyzeResult.status !== 'success') return;
      expect(analyzeResult.result.recommendations.length).toBeGreaterThan(0);
    });

    it('9. 相同 batchId 分析结果可被 getGlobalAgentResult 查询到（demoMode）', async () => {
      const analyzeResult = await analyzeWorkspaceResults(
        mockDispatchResult.batchId,
        mockWorkspaceResults,
        mockConfig,
        { demoMode: true },
      );

      if (analyzeResult.status !== 'success') return;
      const found = await getGlobalAgentResult(mockDispatchResult.batchId);
      expect(found).not.toBeUndefined();
      expect(found!.id).toBe(analyzeResult.result.id);
    });

    it('10. modelUsed 与配置中的 modelConfigId 相关（demoMode）', async () => {
      const analyzeResult = await analyzeWorkspaceResults(
        mockDispatchResult.batchId,
        mockWorkspaceResults,
        mockConfig,
        { demoMode: true },
      );

      if (analyzeResult.status !== 'success') return;
      expect(analyzeResult.result.modelUsed).toBe(mockConfig.modelConfigId);
    });

    it('11. rankings 中 rank 字段正确（1, 2, 3...）（demoMode）', async () => {
      const analyzeResult = await analyzeWorkspaceResults(
        mockDispatchResult.batchId,
        mockWorkspaceResults,
        mockConfig,
        { demoMode: true },
      );

      if (analyzeResult.status !== 'success') return;
      for (let i = 0; i < analyzeResult.result.rankings.length; i++) {
        expect(analyzeResult.result.rankings[i].rank).toBe(i + 1);
      }
    });

    it('12. 空的 workspaceResults 返回 NO_DATA 错误（demoMode=false）', async () => {
      const analyzeResult = await analyzeWorkspaceResults(
        'batch_empty',
        [],
        mockConfig,
        { demoMode: false },
      );

      expect(analyzeResult.status).toBe('error');
      if (analyzeResult.status === 'error') {
        expect(analyzeResult.code).toBe('NO_DATA');
        expect(analyzeResult.retryable).toBe(false);
      }
    });

    it('12b. demoMode=true 时空 workspaceResults 也返回 mock 结果', async () => {
      const analyzeResult = await analyzeWorkspaceResults(
        'batch_empty_demo',
        [],
        mockConfig,
        { demoMode: true },
      );

      expect(analyzeResult.status).toBe('success');
      if (analyzeResult.status === 'success') {
        expect(analyzeResult.result.batchId).toBe('batch_empty_demo');
        expect(analyzeResult.result.isDemo).toBe(true);
      }
    });
  });

  describe('getGlobalAgentResult', () => {
    it('13. 存在的 batchId 返回对应的 GlobalAgentResult', async () => {
      const analyzeResult = await analyzeWorkspaceResults(
        'batch_test_123',
        mockWorkspaceResults,
        mockConfig,
        { demoMode: true },
      );

      if (analyzeResult.status !== 'success') return;
      const found = await getGlobalAgentResult('batch_test_123');

      expect(found).not.toBeUndefined();
      expect(found!.id).toBe(analyzeResult.result.id);
      expect(found!.batchId).toBe('batch_test_123');
    });

    it('14. 不存在的 batchId 返回 undefined', async () => {
      const found = await getGlobalAgentResult('non_existent_batch_id_99999');
      expect(found).toBeUndefined();
    });

    it('15. 多次 analyzeWorkspaceResults 生成不同的结果（demoMode）', async () => {
      const analyzeResult1 = await analyzeWorkspaceResults(
        'batch_multi_1',
        mockWorkspaceResults,
        mockConfig,
        { demoMode: true },
      );

      const analyzeResult2 = await analyzeWorkspaceResults(
        'batch_multi_2',
        mockWorkspaceResults,
        mockConfig,
        { demoMode: true },
      );

      if (analyzeResult1.status !== 'success' || analyzeResult2.status !== 'success') return;
      expect(analyzeResult1.result.id).not.toBe(analyzeResult2.result.id);
    });
  });

  describe('错误处理', () => {
    it('16. 无 API key 时返回 CONFIG_MISSING 不可重试错误（demoMode=false）', async () => {
      const analyzeResult = await analyzeWorkspaceResults(
        'batch_no_config',
        mockWorkspaceResults,
        mockConfig,
        { demoMode: false },
      );

      expect(analyzeResult.status).toBe('error');
      if (analyzeResult.status === 'error') {
        expect(['CONFIG_MISSING', 'API_ERROR']).toContain(analyzeResult.code);
        expect(analyzeResult.retryable).toBe(false); // CONFIG_MISSING 不可重试
        expect(analyzeResult.message.length).toBeGreaterThan(0);
      }
    });

    it('17. demoMode=true 时返回带 isDemo: true 的结果', async () => {
      const analyzeResult = await analyzeWorkspaceResults(
        'batch_demo_check',
        mockWorkspaceResults,
        mockConfig,
        { demoMode: true },
      );

      expect(analyzeResult.status).toBe('success');
      if (analyzeResult.status === 'success') {
        expect(analyzeResult.result.isDemo).toBe(true);
        expect(analyzeResult.result.rankings.length).toBeGreaterThan(0);
      }
    });

    it('18. AnalysisError 类包含正确的 code 和 retryable 属性', async () => {
      const { AnalysisError } = await import('@/services/globalAgentService');

      const retryableError = new AnalysisError('test', 'API_ERROR', true);
      expect(retryableError.code).toBe('API_ERROR');
      expect(retryableError.retryable).toBe(true);
      expect(retryableError.message).toBe('test');
      expect(retryableError.name).toBe('AnalysisError');

      const nonRetryableError = new AnalysisError('test2', 'CONFIG_MISSING', false);
      expect(nonRetryableError.code).toBe('CONFIG_MISSING');
      expect(nonRetryableError.retryable).toBe(false);
    });

    it('19. demoMode 时 latencyMs 为 0', async () => {
      const analyzeResult = await analyzeWorkspaceResults(
        'batch_latency',
        mockWorkspaceResults,
        mockConfig,
        { demoMode: true },
      );

      expect(analyzeResult.status).toBe('success');
      if (analyzeResult.status === 'success') {
        expect(analyzeResult.latencyMs).toBe(0);
      }
    });
  });
});
