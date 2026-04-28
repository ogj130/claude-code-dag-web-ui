/**
 * progressiveUnlock — 渐进式解锁系统
 *
 * 追踪功能使用次数，根据阈值自动解锁高级功能。
 * 四级解锁：basic → intermediate → advanced → expert
 *
 * 使用方式：
 *   import { unlockSystem } from '@/services/progressiveUnlock';
 *   unlockSystem.recordUse('agent_canvas');
 *   const level = unlockSystem.getLevel('agent_canvas');
 */

// ── 类型定义 ────────────────────────────────────────────────

export type UnlockLevel = 'basic' | 'intermediate' | 'advanced' | 'expert';

export interface FeatureConfig {
  /** 功能 ID */
  id: string;
  /** 功能名称 */
  name: string;
  /** 所属解锁等级 */
  level: UnlockLevel;
  /** 解锁所需使用次数（继承自上一级功能） */
  unlockThreshold: number;
  /** 是否为专家功能（需要全部解锁开关） */
  isExpert?: boolean;
}

export interface FeatureState {
  config: FeatureConfig;
  usageCount: number;
  isUnlocked: boolean;
  unlockedAt?: number;
}

export interface UnlockEvent {
  featureId: string;
  featureName: string;
  level: UnlockLevel;
  timestamp: number;
}

// ── 解锁等级阈值 ────────────────────────────────────────────

const LEVEL_THRESHOLDS: Record<UnlockLevel, number> = {
  basic: 0,         // 基础功能默认解锁
  intermediate: 5,  // 使用 5 次后解锁
  advanced: 20,     // 使用 20 次后解锁
  expert: 50,       // 使用 50 次后解锁
};

// ── 功能注册表 ──────────────────────────────────────────────

const FEATURES: FeatureConfig[] = [
  // basic（默认解锁）
  { id: 'chat', name: '对话', level: 'basic', unlockThreshold: 0 },
  { id: 'terminal', name: '终端', level: 'basic', unlockThreshold: 0 },
  { id: 'file_browser', name: '文件浏览', level: 'basic', unlockThreshold: 0 },
  { id: 'settings', name: '设置', level: 'basic', unlockThreshold: 0 },

  // intermediate
  { id: 'guided_mode', name: '引导模式', level: 'intermediate', unlockThreshold: 5 },
  { id: 'intent_panel', name: '意图面板', level: 'intermediate', unlockThreshold: 5 },
  { id: 'voice_input', name: '语音输入', level: 'intermediate', unlockThreshold: 5 },

  // advanced
  { id: 'agent_canvas', name: 'Agent 画布', level: 'advanced', unlockThreshold: 20 },
  { id: 'flow_builder', name: '流程编排', level: 'advanced', unlockThreshold: 20 },
  { id: 'kanban', name: '任务看板', level: 'advanced', unlockThreshold: 20 },
  { id: 'knowledge_graph', name: '知识图谱', level: 'advanced', unlockThreshold: 20 },

  // expert
  { id: 'skill_editor', name: 'Skill 编辑器', level: 'expert', unlockThreshold: 50, isExpert: true },
  { id: 'hook_engine', name: 'Hook 引擎', level: 'expert', unlockThreshold: 50, isExpert: true },
  { id: 'evolution_view', name: '进化视图', level: 'expert', unlockThreshold: 50, isExpert: true },
];

// ── 状态 ────────────────────────────────────────────────────

const _usageCounts: Map<string, number> = new Map();
const _unlockedAt: Map<string, number> = new Map();
let _unlockAll = false;
const _unlockListeners: Array<(event: UnlockEvent) => void> = [];

// ── 核心 API ────────────────────────────────────────────────

/**
 * 记录功能使用
 */
export function recordUse(featureId: string): void {
  const current = _usageCounts.get(featureId) ?? 0;
  _usageCounts.set(featureId, current + 1);

  // 检查是否解锁了新功能
  checkNewUnlocks();
}

/**
 * 获取功能使用次数
 */
export function getUsageCount(featureId: string): number {
  return _usageCounts.get(featureId) ?? 0;
}

/**
 * 检查功能是否已解锁
 */
export function isUnlocked(featureId: string): boolean {
  if (_unlockAll) return true;

  const feature = FEATURES.find((f) => f.id === featureId);
  if (!feature) return true; // 未知功能默认解锁

  if (feature.level === 'basic') return true;

  return (_usageCounts.get(featureId) ?? 0) >= feature.unlockThreshold;
}

/**
 * 获取功能的解锁状态
 */
export function getFeatureState(featureId: string): FeatureState | null {
  const config = FEATURES.find((f) => f.id === featureId);
  if (!config) return null;

  return {
    config,
    usageCount: _usageCounts.get(featureId) ?? 0,
    isUnlocked: isUnlocked(featureId),
    unlockedAt: _unlockedAt.get(featureId),
  };
}

/**
 * 获取所有功能的解锁状态
 */
export function getAllFeatureStates(): FeatureState[] {
  return FEATURES.map((config) => ({
    config,
    usageCount: _usageCounts.get(config.id) ?? 0,
    isUnlocked: isUnlocked(config.id),
    unlockedAt: _unlockedAt.get(config.id),
  }));
}

/**
 * 获取用户当前解锁等级
 */
export function getUserLevel(): UnlockLevel {
  const allUnlocked = (level: UnlockLevel) =>
    FEATURES.filter((f) => f.level === level).every((f) => isUnlocked(f.id));

  if (allUnlocked('expert')) return 'expert';
  if (allUnlocked('advanced')) return 'advanced';
  if (allUnlocked('intermediate')) return 'intermediate';
  return 'basic';
}

/**
 * 获取下一个解锁目标
 */
export function getNextUnlockTarget(): { feature: FeatureConfig; remaining: number } | null {
  const locked = FEATURES
    .filter((f) => f.level !== 'basic' && !isUnlocked(f.id))
    .sort((a, b) => {
      const remainA = a.unlockThreshold - (_usageCounts.get(a.id) ?? 0);
      const remainB = b.unlockThreshold - (_usageCounts.get(b.id) ?? 0);
      return remainA - remainB;
    });

  if (locked.length === 0) return null;

  const target = locked[0];
  return {
    feature: target,
    remaining: target.unlockThreshold - (_usageCounts.get(target.id) ?? 0),
  };
}

// ── Unlock All 开关 ─────────────────────────────────────────

/**
 * 设置全局解锁开关
 */
export function setUnlockAll(enabled: boolean): void {
  _unlockAll = enabled;
}

/**
 * 获取全局解锁开关状态
 */
export function isUnlockAllEnabled(): boolean {
  return _unlockAll;
}

// ── 解锁事件 ────────────────────────────────────────────────

function checkNewUnlocks(): void {
  for (const feature of FEATURES) {
    if (feature.level === 'basic') continue;
    if (_unlockedAt.has(feature.id)) continue;

    if ((_usageCounts.get(feature.id) ?? 0) >= feature.unlockThreshold) {
      _unlockedAt.set(feature.id, Date.now());

      const event: UnlockEvent = {
        featureId: feature.id,
        featureName: feature.name,
        level: feature.level,
        timestamp: Date.now(),
      };

      for (const listener of _unlockListeners) {
        listener(event);
      }
    }
  }
}

/**
 * 监听解锁事件
 */
export function onUnlock(listener: (event: UnlockEvent) => void): () => void {
  _unlockListeners.push(listener);
  return () => {
    const idx = _unlockListeners.indexOf(listener);
    if (idx >= 0) _unlockListeners.splice(idx, 1);
  };
}

/**
 * 重置状态（测试用）
 */
export function resetUnlockState(): void {
  _usageCounts.clear();
  _unlockedAt.clear();
  _unlockAll = false;
  _unlockListeners.length = 0;
}

/**
 * 获取等级阈值（只读）
 */
export function getLevelThresholds(): Record<UnlockLevel, number> {
  return { ...LEVEL_THRESHOLDS };
}
