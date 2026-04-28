/**
 * 用户建模全流程测试
 *
 * 覆盖：行为收集 → 摘要分析 → 推理推导 → 质疑修正 → 画像输出
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  record,
  getEvents,
  getEventsByType,
  summarize,
  resetCollector,
  type BehaviorEventType,
} from '../services/behaviorCollector';
import {
  infer,
  getInferenceCooldown,
  resetReasoner,
  buildUserPeerPrompt,
  buildAiPeerPrompt,
  type InferredDimension,
} from '../services/honchoReasoner';

// ── behaviorCollector 测试 ──────────────────────────────────

describe('behaviorCollector', () => {
  beforeEach(() => {
    resetCollector();
  });

  describe('record', () => {
    it('记录事件并返回 ID', () => {
      const id = record({
        type: 'file_create',
        workspaceId: 'ws1',
        data: { ext: '.ts', fileName: 'app.ts' },
      });
      expect(id).toBeTruthy();
      expect(getEvents('ws1')).toHaveLength(1);
    });

    it('按工作区隔离事件', () => {
      record({ type: 'file_create', workspaceId: 'ws1', data: {} });
      record({ type: 'file_create', workspaceId: 'ws2', data: {} });
      expect(getEvents('ws1')).toHaveLength(1);
      expect(getEvents('ws2')).toHaveLength(1);
    });

    it('按类型过滤', () => {
      record({ type: 'file_create', workspaceId: 'ws1', data: {} });
      record({ type: 'command_run', workspaceId: 'ws1', data: {} });
      record({ type: 'file_create', workspaceId: 'ws1', data: {} });

      expect(getEventsByType('ws1', 'file_create')).toHaveLength(2);
      expect(getEventsByType('ws1', 'command_run')).toHaveLength(1);
    });

    it('超过上限时淘汰旧事件', () => {
      // 直接测试上限逻辑：插入大量事件
      for (let i = 0; i < 1010; i++) {
        record({ type: 'file_edit', workspaceId: 'ws1', data: {} });
      }
      // 应该限制在 1000
      expect(getEvents('ws1').length).toBeLessThanOrEqual(1000);
    });
  });

  describe('summarize', () => {
    it('空工作区返回零摘要', () => {
      const summary = summarize('ws_empty');
      expect(summary.totalEvents).toBe(0);
      expect(summary.frameworkHints).toHaveLength(0);
    });

    it('统计事件类型分布', () => {
      record({ type: 'file_create', workspaceId: 'ws1', data: { ext: '.ts' } });
      record({ type: 'file_create', workspaceId: 'ws1', data: { ext: '.ts' } });
      record({ type: 'command_run', workspaceId: 'ws1', data: {} });

      const summary = summarize('ws1');
      expect(summary.totalEvents).toBe(3);
      expect(summary.byType['file_create']).toBe(2);
      expect(summary.byType['command_run']).toBe(1);
    });

    it('统计语言分布', () => {
      record({ type: 'file_create', workspaceId: 'ws1', data: { ext: '.ts' } });
      record({ type: 'file_create', workspaceId: 'ws1', data: { ext: '.ts' } });
      record({ type: 'file_create', workspaceId: 'ws1', data: { ext: '.py' } });

      const summary = summarize('ws1');
      expect(summary.languageDistribution['TypeScript']).toBe(2);
      expect(summary.languageDistribution['Python']).toBe(1);
    });

    it('检测框架', () => {
      record({ type: 'file_create', workspaceId: 'ws1', data: { fileName: 'App.tsx' } });
      record({ type: 'command_run', workspaceId: 'ws1', data: { command: 'npx vitest run' } });

      const summary = summarize('ws1');
      expect(summary.frameworkHints).toContain('React');
      expect(summary.frameworkHints).toContain('Vitest/Jest');
    });
  });
});

// ── honchoReasoner 测试 ────────────────────────────────────

describe('honchoReasoner', () => {
  beforeEach(() => {
    resetCollector();
    resetReasoner();
  });

  describe('infer', () => {
    it('无行为数据时返回空维度', async () => {
      const result = await infer('ws_empty', true);
      expect(result.dimensions).toHaveLength(0);
      expect(result.convergenceScore).toBe(0);
    });

    it('基于行为数据推断语言偏好', async () => {
      // 模拟大量 TypeScript 使用
      for (let i = 0; i < 20; i++) {
        record({ type: 'file_create', workspaceId: 'ws1', data: { ext: '.ts' } });
      }
      record({ type: 'file_create', workspaceId: 'ws1', data: { ext: '.py' } });

      const result = await infer('ws1', true);
      const langDim = result.dimensions.find((d) => d.key === 'language');
      expect(langDim).toBeDefined();
      expect(langDim!.value).toBe('TypeScript');
      expect(langDim!.confidence).toBeGreaterThan(0.5);
    });

    it('基于行为数据推断框架偏好', async () => {
      for (let i = 0; i < 10; i++) {
        record({ type: 'file_create', workspaceId: 'ws1', data: { fileName: `Component${i}.tsx` } });
      }

      const result = await infer('ws1', true);
      const fwDim = result.dimensions.find((d) => d.key === 'framework');
      expect(fwDim).toBeDefined();
      expect(fwDim!.value).toBe('React');
    });

    it('双 Peer 交叉验证产生结果', async () => {
      for (let i = 0; i < 10; i++) {
        record({ type: 'file_create', workspaceId: 'ws1', data: { ext: '.ts' } });
      }

      const result = await infer('ws1', true);
      expect(result.userPeerDimensions.length).toBeGreaterThan(0);
      expect(result.aiPeerDimensions.length).toBeGreaterThan(0);
      expect(result.convergenceScore).toBeGreaterThanOrEqual(0);
    });

    it('数据量少时 AI Peer 降低置信度', async () => {
      // 只有 3 条事件（低于 10）
      record({ type: 'file_create', workspaceId: 'ws1', data: { ext: '.ts' } });
      record({ type: 'file_create', workspaceId: 'ws1', data: { ext: '.ts' } });
      record({ type: 'file_create', workspaceId: 'ws1', data: { ext: '.ts' } });

      const result = await infer('ws1', true);
      const langUser = result.userPeerDimensions.find((d) => d.key === 'language');
      const langAi = result.aiPeerDimensions.find((d) => d.key === 'language');

      expect(langUser).toBeDefined();
      expect(langAi).toBeDefined();
      // AI Peer 应该有更低的置信度
      expect(langAi!.confidence).toBeLessThanOrEqual(langUser!.confidence);
    });

    it('频率限制生效', async () => {
      for (let i = 0; i < 5; i++) {
        record({ type: 'file_create', workspaceId: 'ws1', data: { ext: '.ts' } });
      }

      await infer('ws1', true);

      // 再次推理应被拒绝
      await expect(infer('ws1')).rejects.toThrow('推理冷却中');
    });

    it('forceRefresh 绕过频率限制', async () => {
      for (let i = 0; i < 5; i++) {
        record({ type: 'file_create', workspaceId: 'ws1', data: { ext: '.ts' } });
      }

      await infer('ws1', true);
      // forceRefresh=true 应该成功
      const result = await infer('ws1', true);
      expect(result.dimensions.length).toBeGreaterThan(0);
    });
  });

  describe('getInferenceCooldown', () => {
    it('未推理过时 isReady=true', () => {
      const status = getInferenceCooldown('ws_new');
      expect(status.isReady).toBe(true);
    });
  });

  describe('Prompt 模板', () => {
    it('User Peer Prompt 包含行为数据', () => {
      const summary = {
        totalEvents: 50,
        byType: { file_create: 30, command_run: 20 },
        languageDistribution: { TypeScript: 25, Python: 5 },
        frameworkHints: ['React'],
        recentPatterns: ['debug:step'],
      };

      const prompt = buildUserPeerPrompt(summary);
      expect(prompt).toContain('50');
      expect(prompt).toContain('TypeScript');
      expect(prompt).toContain('React');
    });

    it('AI Peer Prompt 包含初步推断', () => {
      const summary = {
        totalEvents: 50,
        byType: {},
        languageDistribution: {},
        frameworkHints: [],
        recentPatterns: [],
      };
      const dims: InferredDimension[] = [
        { key: 'language', value: 'TypeScript', confidence: 0.8, reasoning: 'test', source: 'user_peer' },
      ];

      const prompt = buildAiPeerPrompt(summary, dims);
      expect(prompt).toContain('TypeScript');
      expect(prompt).toContain('质疑');
    });
  });
});
