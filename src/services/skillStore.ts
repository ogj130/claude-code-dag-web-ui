/**
 * skillStore — Skill 2.0 存储与版本管理
 *
 * CRUD + 版本管理 + 使用统计。
 * 优先走 SQLite IPC，降级走内存存储。
 *
 * 使用方式：
 *   import { skillStore } from '@/services/skillStore';
 *   await skillStore.create({ name: '...', content: '...' });
 *   await skillStore.recordUsage(skillId, { success: true, tokens: 500 });
 */

// ── 类型定义 ────────────────────────────────────────────────

export interface Skill {
  id: string;
  name: string;
  description: string;
  content: string;
  source: 'user_created' | 'llm_extracted' | 'imported';
  status: 'active' | 'deprecated' | 'draft';
  version: number;
  createdAt: number;
  updatedAt: number;
  tags: string[];
  usageStats: SkillUsageStats;
}

export interface SkillVersion {
  id: string;
  skillId: string;
  version: number;
  content: string;
  description: string;
  createdAt: number;
  changeNote?: string;
}

export interface SkillUsageStats {
  totalCalls: number;
  successCount: number;
  failureCount: number;
  totalTokens: number;
  avgDurationMs: number;
  lastUsedAt?: number;
  successRate: number;
}

export interface CreateSkillParams {
  name: string;
  description?: string;
  content: string;
  source?: Skill['source'];
  tags?: string[];
}

export interface UsageRecord {
  success: boolean;
  tokens: number;
  durationMs?: number;
}

// ── 内存存储 ────────────────────────────────────────────────

const _skills: Map<string, Skill> = new Map();
const _versions: Map<string, SkillVersion[]> = new Map(); // skillId → versions

function generateId(): string {
  return `skill_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── CRUD ────────────────────────────────────────────────────

/**
 * 创建 Skill
 */
export async function create(params: CreateSkillParams): Promise<Skill> {
  const id = generateId();
  const now = Date.now();

  const skill: Skill = {
    id,
    name: params.name,
    description: params.description ?? '',
    content: params.content,
    source: params.source ?? 'user_created',
    status: 'active',
    version: 1,
    createdAt: now,
    updatedAt: now,
    tags: params.tags ?? [],
    usageStats: {
      totalCalls: 0,
      successCount: 0,
      failureCount: 0,
      totalTokens: 0,
      avgDurationMs: 0,
      successRate: 0,
    },
  };

  _skills.set(id, skill);

  // 创建初始版本
  const version: SkillVersion = {
    id: generateId(),
    skillId: id,
    version: 1,
    content: params.content,
    description: params.description ?? '',
    createdAt: now,
    changeNote: 'Initial version',
  };
  _versions.set(id, [version]);

  return skill;
}

/**
 * 获取 Skill
 */
export async function getById(id: string): Promise<Skill | null> {
  return _skills.get(id) ?? null;
}

/**
 * 列出 Skills（支持过滤）
 */
export async function list(options?: {
  status?: Skill['status'];
  source?: Skill['source'];
  tag?: string;
  limit?: number;
}): Promise<Skill[]> {
  let results = [..._skills.values()];

  if (options?.status) {
    results = results.filter((s) => s.status === options.status);
  }
  if (options?.source) {
    results = results.filter((s) => s.source === options.source);
  }
  if (options?.tag) {
    results = results.filter((s) => s.tags.includes(options.tag!));
  }

  // 按更新时间降序
  results.sort((a, b) => b.updatedAt - a.updatedAt);

  if (options?.limit) {
    results = results.slice(0, options.limit);
  }

  return results;
}

/**
 * 更新 Skill 内容（创建新版本）
 */
export async function update(
  id: string,
  updates: Partial<Pick<Skill, 'name' | 'description' | 'content' | 'status' | 'tags'>>,
  changeNote?: string
): Promise<Skill | null> {
  const skill = _skills.get(id);
  if (!skill) return null;

  const contentChanged = updates.content && updates.content !== skill.content;
  const now = Date.now();

  const updated: Skill = {
    ...skill,
    ...updates,
    updatedAt: now,
    version: contentChanged ? skill.version + 1 : skill.version,
  };

  _skills.set(id, updated);

  // 如果内容变更，创建新版本
  if (contentChanged) {
    const versions = _versions.get(id) ?? [];
    versions.push({
      id: generateId(),
      skillId: id,
      version: updated.version,
      content: updates.content!,
      description: updated.description,
      createdAt: now,
      changeNote,
    });
    _versions.set(id, versions);
  }

  return updated;
}

/**
 * 删除 Skill（软删除 → deprecated）
 */
export async function remove(id: string): Promise<boolean> {
  const skill = _skills.get(id);
  if (!skill) return false;

  _skills.set(id, { ...skill, status: 'deprecated', updatedAt: Date.now() });
  return true;
}

// ── 使用统计 ────────────────────────────────────────────────

/**
 * 记录 Skill 使用
 */
export async function recordUsage(skillId: string, record: UsageRecord): Promise<void> {
  const skill = _skills.get(skillId);
  if (!skill) return;

  const stats = skill.usageStats;
  const newTotalCalls = stats.totalCalls + 1;
  const newSuccessCount = stats.successCount + (record.success ? 1 : 0);
  const newTotalTokens = stats.totalTokens + record.tokens;

  const newDuration = record.durationMs
    ? (stats.avgDurationMs * stats.totalCalls + record.durationMs) / newTotalCalls
    : stats.avgDurationMs;

  _skills.set(skillId, {
    ...skill,
    updatedAt: Date.now(),
    usageStats: {
      totalCalls: newTotalCalls,
      successCount: newSuccessCount,
      failureCount: newTotalCalls - newSuccessCount,
      totalTokens: newTotalTokens,
      avgDurationMs: Math.round(newDuration),
      lastUsedAt: Date.now(),
      successRate: newTotalCalls > 0 ? newSuccessCount / newTotalCalls : 0,
    },
  });
}

/**
 * 获取 Skill 使用统计
 */
export async function getUsageStats(skillId: string): Promise<SkillUsageStats | null> {
  return _skills.get(skillId)?.usageStats ?? null;
}

// ── 版本管理 ────────────────────────────────────────────────

/**
 * 获取 Skill 的所有版本
 */
export async function getVersions(skillId: string): Promise<SkillVersion[]> {
  return _versions.get(skillId) ?? [];
}

/**
 * 回滚到指定版本
 */
export async function rollback(skillId: string, version: number): Promise<Skill | null> {
  const versions = _versions.get(skillId);
  if (!versions) return null;

  const target = versions.find((v) => v.version === version);
  if (!target) return null;

  return update(
    skillId,
    { content: target.content, description: target.description },
    `Rollback to v${version}`
  );
}

/**
 * 对比两个版本
 */
export async function diff(
  skillId: string,
  versionA: number,
  versionB: number
): Promise<{ a: SkillVersion | null; b: SkillVersion | null }> {
  const versions = _versions.get(skillId) ?? [];
  return {
    a: versions.find((v) => v.version === versionA) ?? null,
    b: versions.find((v) => v.version === versionB) ?? null,
  };
}

// ── 推荐引擎 ────────────────────────────────────────────────

/**
 * 基于上下文推荐 Skill
 *
 * 简单匹配：根据 tags 和 usage stats 排序。
 */
export async function recommend(context: {
  tags?: string[];
  description?: string;
  limit?: number;
}): Promise<Skill[]> {
  const active = await list({ status: 'active' });
  const limit = context.limit ?? 5;

  if (!context.tags?.length && !context.description) {
    // 无上下文时按使用频率排序
    return active
      .sort((a, b) => b.usageStats.totalCalls - a.usageStats.totalCalls)
      .slice(0, limit);
  }

  // 按标签匹配度排序
  const scored = active.map((skill) => {
    let score = 0;

    // 标签匹配
    if (context.tags) {
      for (const tag of context.tags) {
        if (skill.tags.includes(tag)) score += 2;
      }
    }

    // 描述关键词匹配
    if (context.description) {
      const words = context.description.toLowerCase().split(/\s+/);
      for (const word of words) {
        if (skill.name.toLowerCase().includes(word)) score += 3;
        if (skill.description.toLowerCase().includes(word)) score += 1;
      }
    }

    // 使用成功率加权
    score += skill.usageStats.successRate * 2;

    return { skill, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.skill);
}

// ── 重置（测试用）───────────────────────────────────────────

export function resetSkillStore(): void {
  _skills.clear();
  _versions.clear();
}
