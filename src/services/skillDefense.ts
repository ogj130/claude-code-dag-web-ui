/**
 * skillDefense — Skill 防爆炸三层防线
 *
 * 当自进化闭环产生大量候选 Skill 时，防止 Skill 数量失控。
 *
 * L1 合并: 高相似度 Skill 合并为单一 Skill
 * L2 淘汰: 低置信度 / 低使用率 Skill 自动淘汰
 * L3 人工审查: 超过阈值时暂停，等待人工审查
 *
 * 使用方式：
 *   import { runDefense } from '@/services/skillDefense';
 *   const result = runDefense(candidateSkills);
 */

import type { CandidateSkill } from './evolutionLoop';

// ── 类型定义 ────────────────────────────────────────────────

export interface DefenseResult {
  /** 原始数量 */
  originalCount: number;
  /** L1 合并结果 */
  l1Merge: {
    merged: number;
    surviving: number;
  };
  /** L2 淘汰结果 */
  l2Eliminate: {
    eliminated: number;
    surviving: number;
  };
  /** L3 审查标记 */
  l3Review: {
    needsReview: boolean;
    reviewCount: number;
    threshold: number;
  };
  /** 最终存活 Skill */
  survivingSkills: CandidateSkill[];
  /** 被合并的 Skill（合并目标 → 合并来源） */
  mergedPairs: Array<{ into: string; from: string }>;
  /** 被淘汰的 Skill IDs */
  eliminatedIds: string[];
}

// ── 配置 ────────────────────────────────────────────────────

const DEFENSE_CONFIG = {
  /** L1: 合并阈值（工具组合重叠度 > 此值时合并） */
  l1MergeOverlap: 0.7,
  /** L2: 最低置信度 */
  l2MinConfidence: 0.2,
  /** L2: 最低使用次数（基于 traces 数量） */
  l2MinTraces: 1,
  /** L3: 审查阈值（Skill 总数超过此值触发审查） */
  l3ReviewThreshold: 50,
} as const;

// ── L1: 合并 ────────────────────────────────────────────────

/**
 * 计算两个 Skill 工具集的重叠度
 */
function toolOverlap(a: CandidateSkill, b: CandidateSkill): number {
  try {
    const toolsA: string[] = JSON.parse(a.content).tools ?? [];
    const toolsB: string[] = JSON.parse(b.content).tools ?? [];

    if (toolsA.length === 0 && toolsB.length === 0) return 1;
    if (toolsA.length === 0 || toolsB.length === 0) return 0;

    const setA = new Set(toolsA);
    const intersection = toolsB.filter((t) => setA.has(t)).length;
    const union = new Set([...toolsA, ...toolsB]).size;

    return intersection / union;
  } catch {
    return 0;
  }
}

/**
 * 合并两个 Skill（保留置信度较高的）
 */
function mergeSkills(a: CandidateSkill, b: CandidateSkill): CandidateSkill {
  const [keep, merge] = a.confidence >= b.confidence ? [a, b] : [b, a];

  const keepContent = JSON.parse(keep.content);
  const mergeContent = JSON.parse(merge.content);

  // 合并 traces
  const mergedTraces = [...new Set([...keep.traces, ...merge.traces])];
  const mergedExamples = [
    ...(keepContent.examples ?? []),
    ...(mergeContent.examples ?? []),
  ].slice(0, 5);

  return {
    ...keep,
    description: `${keep.description}（已合并 ${merge.name}）`,
    content: JSON.stringify({
      ...keepContent,
      examples: mergedExamples,
    }),
    confidence: Math.max(keep.confidence, merge.confidence),
    traces: mergedTraces,
  };
}

/**
 * L1: 合并高相似度 Skill
 */
function runL1Merge(skills: CandidateSkill[]): {
  surviving: CandidateSkill[];
  mergedPairs: Array<{ into: string; from: string }>;
  mergeCount: number;
} {
  const surviving: CandidateSkill[] = [];
  const mergedIds = new Set<string>();
  const mergedPairs: Array<{ into: string; from: string }> = [];
  let mergeCount = 0;

  for (let i = 0; i < skills.length; i++) {
    if (mergedIds.has(skills[i].id)) continue;

    let current = skills[i];

    for (let j = i + 1; j < skills.length; j++) {
      if (mergedIds.has(skills[j].id)) continue;

      const overlap = toolOverlap(current, skills[j]);
      if (overlap >= DEFENSE_CONFIG.l1MergeOverlap) {
        mergedPairs.push({ into: current.id, from: skills[j].id });
        current = mergeSkills(current, skills[j]);
        mergedIds.add(skills[j].id);
        mergeCount++;
      }
    }

    surviving.push(current);
  }

  return { surviving, mergedPairs, mergeCount };
}

// ── L2: 淘汰 ───────────────────────────────────────────────

/**
 * L2: 淘汰低置信度 / 低使用率 Skill
 */
function runL2Eliminate(skills: CandidateSkill[]): {
  surviving: CandidateSkill[];
  eliminatedIds: string[];
  eliminateCount: number;
} {
  const surviving: CandidateSkill[] = [];
  const eliminatedIds: string[] = [];

  for (const skill of skills) {
    const meetsConfidence = skill.confidence >= DEFENSE_CONFIG.l2MinConfidence;
    const meetsTraces = skill.traces.length >= DEFENSE_CONFIG.l2MinTraces;

    if (meetsConfidence && meetsTraces) {
      surviving.push(skill);
    } else {
      eliminatedIds.push(skill.id);
    }
  }

  return { surviving, eliminatedIds, eliminateCount: eliminatedIds.length };
}

// ── L3: 审查 ───────────────────────────────────────────────

/**
 * L3: 检查是否需要人工审查
 */
function checkL3Review(skills: CandidateSkill[]): {
  needsReview: boolean;
  reviewCount: number;
  threshold: number;
} {
  return {
    needsReview: skills.length > DEFENSE_CONFIG.l3ReviewThreshold,
    reviewCount: skills.length > DEFENSE_CONFIG.l3ReviewThreshold ? skills.length : 0,
    threshold: DEFENSE_CONFIG.l3ReviewThreshold,
  };
}

// ── 主函数 ──────────────────────────────────────────────────

/**
 * 执行三层防线
 *
 * 按顺序：L1 合并 → L2 淘汰 → L3 审查
 */
export function runDefense(skills: CandidateSkill[]): DefenseResult {
  const originalCount = skills.length;

  // L1
  const l1Result = runL1Merge(skills);

  // L2
  const l2Result = runL2Eliminate(l1Result.surviving);

  // L3
  const l3Result = checkL3Review(l2Result.surviving);

  return {
    originalCount,
    l1Merge: {
      merged: l1Result.mergeCount,
      surviving: l1Result.surviving.length,
    },
    l2Eliminate: {
      eliminated: l2Result.eliminateCount,
      surviving: l2Result.surviving.length,
    },
    l3Review: l3Result,
    survivingSkills: l2Result.surviving,
    mergedPairs: l1Result.mergedPairs,
    eliminatedIds: l2Result.eliminatedIds,
  };
}

/**
 * 获取防线配置（只读）
 */
export function getDefenseConfig() {
  return { ...DEFENSE_CONFIG };
}
