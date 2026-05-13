import { describe, it, expect, beforeEach } from 'vitest';
import { SkillStore, resetSkillStore } from '../services/multi-agent/skill-store/SkillStore';
import type { SkillSearchOptions } from '../types/multi-agent/skill';

describe('SkillStore', () => {
  let store: SkillStore;

  beforeEach(() => {
    resetSkillStore();
    store = new SkillStore();
  });

  describe('register', () => {
    it('registers a new skill', async () => {
      const id = await store.register({
        name: 'test-skill',
        domain: 'test',
        trigger: { keywords: ['test'], contextPatterns: [] },
        summary: 'A test skill',
        stepsHint: [],
        detail: { id: 'temp', steps: [], examples: [] },
      });

      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
    });

    it('retrieves metadata after registration', async () => {
      const id = await store.register({
        name: 'meta-test',
        domain: 'performance',
        trigger: { keywords: ['perf', 'optimize'], contextPatterns: [] },
        summary: 'Performance skill',
        stepsHint: [],
        detail: { id: 'temp', steps: [], examples: [] },
      });

      const meta = await store.getMetadata(id);
      expect(meta).not.toBeNull();
      expect(meta!.name).toBe('meta-test');
      expect(meta!.domain).toBe('performance');
    });
  });

  describe('getMetadata', () => {
    it('returns null for non-existent skill', async () => {
      const meta = await store.getMetadata('non-existent');
      expect(meta).toBeNull();
    });
  });

  describe('getDetail', () => {
    it('returns null for non-existent skill', async () => {
      const detail = await store.getDetail('non-existent');
      expect(detail).toBeNull();
    });

    it('returns detail after registration', async () => {
      const id = await store.register({
        name: 'detail-test',
        domain: 'test',
        trigger: { keywords: ['detail'], contextPatterns: [] },
        summary: 'Detail test skill',
        stepsHint: ['Step 1', 'Step 2'],
        detail: { id: 'detail-1', steps: ['Step 1', 'Step 2'], examples: [] },
      });

      const detail = await store.getDetail(id);
      expect(detail).not.toBeNull();
      expect(detail!.steps).toHaveLength(2);
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      await store.register({
        name: 'performance-skill',
        domain: 'performance',
        trigger: { keywords: ['performance', 'optimize'], contextPatterns: [] },
        summary: 'Performance optimization skill',
        stepsHint: [],
        detail: { id: '1', steps: [], examples: [] },
      });

      await store.register({
        name: 'refactor-skill',
        domain: 'refactor',
        trigger: { keywords: ['refactor', 'clean'], contextPatterns: [] },
        summary: 'Code refactoring skill',
        stepsHint: [],
        detail: { id: '2', steps: [], examples: [] },
      });

      await store.register({
        name: 'bugfix-skill',
        domain: 'bugfix',
        trigger: { keywords: ['bug', 'fix'], contextPatterns: [] },
        summary: 'Bug fixing skill',
        stepsHint: [],
        detail: { id: '3', steps: [], examples: [] },
      });
    });

    it('finds skills by keyword', async () => {
      const results = await store.search('performance');
      expect(results.length).toBeGreaterThan(0);
    });

    it('filters by domain', async () => {
      const options: SkillSearchOptions = { domain: 'performance' };
      const results = await store.search('skill', options);
      expect(results.length).toBeGreaterThan(0);
    });

    it('respects topK parameter', async () => {
      const results = await store.search('skill', { topK: 2 });
      expect(results.length).toBeLessThanOrEqual(2);
    });
  });

  describe('getAll', () => {
    it('returns empty array initially', async () => {
      const all = await store.getAll();
      expect(all).toHaveLength(0);
    });

    it('returns all registered skills', async () => {
      await store.register({
        name: 'skill1',
        domain: 'test',
        trigger: { keywords: ['s1'], contextPatterns: [] },
        summary: 'Skill 1',
        stepsHint: [],
        detail: { id: '1', steps: [], examples: [] },
      });

      await store.register({
        name: 'skill2',
        domain: 'test',
        trigger: { keywords: ['s2'], contextPatterns: [] },
        summary: 'Skill 2',
        stepsHint: [],
        detail: { id: '2', steps: [], examples: [] },
      });

      const all = await store.getAll();
      expect(all).toHaveLength(2);
    });
  });

  describe('delete', () => {
    it('deletes existing skill', async () => {
      const id = await store.register({
        name: 'to-delete',
        domain: 'test',
        trigger: { keywords: ['delete'], contextPatterns: [] },
        summary: 'Will be deleted',
        stepsHint: [],
        detail: { id: 'temp', steps: [], examples: [] },
      });

      const deleted = await store.delete(id);
      expect(deleted).toBe(true);

      const meta = await store.getMetadata(id);
      expect(meta).toBeNull();
    });

    it('returns false for non-existent skill', async () => {
      const deleted = await store.delete('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('updateStats', () => {
    it('updates success rate after successful use', async () => {
      const id = await store.register({
        name: 'stats-test',
        domain: 'test',
        trigger: { keywords: ['stats'], contextPatterns: [] },
        summary: 'Stats test',
        stepsHint: [],
        detail: { id: 'temp', steps: [], examples: [] },
      });

      await store.updateStats(id, true);
      const meta = await store.getMetadata(id);
      expect(meta!.meta.successRate).toBeGreaterThan(0);
    });

    it('updates failure rate after failed use', async () => {
      const id = await store.register({
        name: 'stats-fail',
        domain: 'test',
        trigger: { keywords: ['fail'], contextPatterns: [] },
        summary: 'Stats fail test',
        stepsHint: [],
        detail: { id: 'temp', steps: [], examples: [] },
      });

      await store.updateStats(id, false);
      const meta = await store.getMetadata(id);
      expect(meta!.meta.successRate).toBeLessThan(1);
    });
  });
});
