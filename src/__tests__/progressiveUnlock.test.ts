/**
 * progressiveUnlock 测试
 *
 * 覆盖：使用次数追踪、阈值解锁、Unlock All 开关、解锁事件
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordUse,
  getUsageCount,
  isUnlocked,
  getFeatureState,
  getAllFeatureStates,
  getUserLevel,
  getNextUnlockTarget,
  setUnlockAll,
  isUnlockAllEnabled,
  onUnlock,
  resetUnlockState,
  getLevelThresholds,
  type UnlockEvent,
} from '../services/progressiveUnlock';

describe('progressiveUnlock', () => {
  beforeEach(() => {
    resetUnlockState();
  });

  // ── 使用次数追踪 ─────────────────────────────────────────

  describe('usage tracking', () => {
    it('记录使用次数', () => {
      expect(getUsageCount('chat')).toBe(0);
      recordUse('chat');
      expect(getUsageCount('chat')).toBe(1);
      recordUse('chat');
      recordUse('chat');
      expect(getUsageCount('chat')).toBe(3);
    });

    it('不同功能独立计数', () => {
      recordUse('chat');
      recordUse('terminal');
      expect(getUsageCount('chat')).toBe(1);
      expect(getUsageCount('terminal')).toBe(1);
    });
  });

  // ── 阈值解锁 ─────────────────────────────────────────────

  describe('threshold unlock', () => {
    it('basic 功能默认解锁', () => {
      expect(isUnlocked('chat')).toBe(true);
      expect(isUnlocked('terminal')).toBe(true);
      expect(isUnlocked('settings')).toBe(true);
    });

    it('intermediate 功能使用 5 次后解锁', () => {
      expect(isUnlocked('guided_mode')).toBe(false);

      for (let i = 0; i < 5; i++) {
        recordUse('guided_mode');
      }

      expect(isUnlocked('guided_mode')).toBe(true);
    });

    it('advanced 功能使用 20 次后解锁', () => {
      expect(isUnlocked('agent_canvas')).toBe(false);

      for (let i = 0; i < 20; i++) {
        recordUse('agent_canvas');
      }

      expect(isUnlocked('agent_canvas')).toBe(true);
    });

    it('expert 功能使用 50 次后解锁', () => {
      expect(isUnlocked('skill_editor')).toBe(false);

      for (let i = 0; i < 50; i++) {
        recordUse('skill_editor');
      }

      expect(isUnlocked('skill_editor')).toBe(true);
    });

    it('getFeatureState 返回正确状态', () => {
      recordUse('guided_mode');
      recordUse('guided_mode');

      const state = getFeatureState('guided_mode');
      expect(state).not.toBeNull();
      expect(state!.usageCount).toBe(2);
      expect(state!.isUnlocked).toBe(false);
      expect(state!.config.level).toBe('intermediate');
    });

    it('getAllFeatureStates 返回所有功能', () => {
      const states = getAllFeatureStates();
      expect(states.length).toBeGreaterThan(10);
      expect(states.some((s) => s.config.level === 'basic')).toBe(true);
      expect(states.some((s) => s.config.level === 'expert')).toBe(true);
    });
  });

  // ── 用户等级 ─────────────────────────────────────────────

  describe('getUserLevel', () => {
    it('默认 basic', () => {
      expect(getUserLevel()).toBe('basic');
    });

    it('intermediate 功能全解锁后为 intermediate', () => {
      for (const id of ['guided_mode', 'intent_panel', 'voice_input']) {
        for (let i = 0; i < 5; i++) recordUse(id);
      }
      expect(getUserLevel()).toBe('intermediate');
    });
  });

  // ── 下一个解锁目标 ───────────────────────────────────────

  describe('getNextUnlockTarget', () => {
    it('返回最近的解锁目标', () => {
      const target = getNextUnlockTarget();
      expect(target).not.toBeNull();
      expect(target!.feature.level).toBe('intermediate');
      expect(target!.remaining).toBe(5);
    });

    it('所有功能解锁后返回 null', () => {
      // 解锁所有功能
      const allFeatures = getAllFeatureStates();
      for (const f of allFeatures) {
        for (let i = 0; i < 100; i++) recordUse(f.config.id);
      }

      expect(getNextUnlockTarget()).toBeNull();
    });
  });

  // ── Unlock All 开关 ──────────────────────────────────────

  describe('Unlock All', () => {
    it('默认关闭', () => {
      expect(isUnlockAllEnabled()).toBe(false);
    });

    it('开启后所有功能解锁', () => {
      expect(isUnlocked('skill_editor')).toBe(false);
      setUnlockAll(true);
      expect(isUnlocked('skill_editor')).toBe(true);
      expect(isUnlocked('agent_canvas')).toBe(true);
    });

    it('关闭后恢复原状', () => {
      setUnlockAll(true);
      expect(isUnlocked('skill_editor')).toBe(true);
      setUnlockAll(false);
      expect(isUnlocked('skill_editor')).toBe(false);
    });
  });

  // ── 解锁事件 ─────────────────────────────────────────────

  describe('unlock events', () => {
    it('达到阈值时触发解锁事件', () => {
      const events: UnlockEvent[] = [];
      onUnlock((e) => events.push(e));

      for (let i = 0; i < 5; i++) {
        recordUse('guided_mode');
      }

      expect(events).toHaveLength(1);
      expect(events[0].featureId).toBe('guided_mode');
      expect(events[0].level).toBe('intermediate');
    });

    it('同一功能只触发一次解锁事件', () => {
      const events: UnlockEvent[] = [];
      onUnlock((e) => events.push(e));

      for (let i = 0; i < 10; i++) {
        recordUse('guided_mode');
      }

      expect(events).toHaveLength(1);
    });

    it('取消监听后不再收到事件', () => {
      const events: UnlockEvent[] = [];
      const unsub = onUnlock((e) => events.push(e));
      unsub();

      for (let i = 0; i < 5; i++) {
        recordUse('guided_mode');
      }

      expect(events).toHaveLength(0);
    });
  });

  // ── 配置 ─────────────────────────────────────────────────

  describe('config', () => {
    it('等级阈值符合预期', () => {
      const t = getLevelThresholds();
      expect(t.basic).toBe(0);
      expect(t.intermediate).toBe(5);
      expect(t.advanced).toBe(20);
      expect(t.expert).toBe(50);
    });
  });
});
