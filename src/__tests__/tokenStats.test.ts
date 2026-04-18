import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatTokens,
  getModelPricing,
  saveModelPricing,
  resetModelPricing,
  DEFAULT_MODEL_PRICING,
} from '@/utils/tokenStats';

describe('tokenStats', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('formatTokens', () => {
    it('formats small numbers as-is', () => {
      expect(formatTokens(0)).toBe('0');
      expect(formatTokens(100)).toBe('100');
      expect(formatTokens(999)).toBe('999');
    });

    it('formats thousands as K', () => {
      expect(formatTokens(1000)).toBe('1.0K');
      expect(formatTokens(5500)).toBe('5.5K');
      expect(formatTokens(999999)).toBe('1000.0K');
    });

    it('formats millions as M', () => {
      expect(formatTokens(1_000_000)).toBe('1.0M');
      expect(formatTokens(2_500_000)).toBe('2.5M');
    });
  });

  describe('getModelPricing', () => {
    it('returns default pricing when localStorage is empty', () => {
      const pricing = getModelPricing();
      expect(pricing).toEqual(DEFAULT_MODEL_PRICING);
    });

    it('returns stored pricing from localStorage', () => {
      const custom = [{ modelId: 'custom-model', displayName: 'Custom', inputPrice: 5, outputPrice: 10 }];
      localStorage.setItem('cc-model-pricing', JSON.stringify(custom));
      const pricing = getModelPricing();
      expect(pricing).toEqual(custom);
    });

    it('returns default on invalid JSON', () => {
      localStorage.setItem('cc-model-pricing', 'not valid json');
      const pricing = getModelPricing();
      expect(pricing).toEqual(DEFAULT_MODEL_PRICING);
    });
  });

  describe('saveModelPricing', () => {
    it('saves pricing to localStorage', () => {
      const custom = [{ modelId: 'test', displayName: 'Test', inputPrice: 1, outputPrice: 2 }];
      saveModelPricing(custom);
      expect(localStorage.getItem('cc-model-pricing')).toBe(JSON.stringify(custom));
    });
  });

  describe('resetModelPricing', () => {
    it('removes stored pricing', () => {
      saveModelPricing([{ modelId: 'test', displayName: 'Test', inputPrice: 1, outputPrice: 2 }]);
      resetModelPricing();
      expect(localStorage.getItem('cc-model-pricing')).toBeNull();
    });
  });

  describe('DEFAULT_MODEL_PRICING', () => {
    it('contains expected models', () => {
      const ids = DEFAULT_MODEL_PRICING.map(p => p.modelId);
      expect(ids).toContain('claude-sonnet-4-20250514');
      expect(ids).toContain('claude-opus-4-20250514');
      expect(ids).toContain('claude-haiku-35-20241022');
    });

    it('marks default model', () => {
      const defaultModel = DEFAULT_MODEL_PRICING.find(p => p.isDefault);
      expect(defaultModel?.modelId).toBe('claude-sonnet-4-20250514');
    });
  });
});
