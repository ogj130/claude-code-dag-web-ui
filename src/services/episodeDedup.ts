/**
 * episodeDedup — 情景记忆相似度去重
 *
 * 创建新 episode 前，检查是否有高度相似的已有记录（cosine > 0.95）。
 * 如果存在，合并更新而非创建新条目。
 *
 * 相似度算法：基于字符 bigram 的 Jaccard 相似度（轻量级，无需向量化）。
 */

import { episodeStore, type Episode } from '../stores/memoryStore';

// ── 相似度计算 ────────────────────────────────────────────

/**
 * 将文本转为 bigram 集合
 */
function toBigrams(text: string): Set<string> {
  const cleaned = text
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  const bigrams = new Set<string>();
  for (let i = 0; i < cleaned.length - 1; i++) {
    bigrams.add(cleaned[i] + cleaned[i + 1]);
  }
  return bigrams;
}

/**
 * 计算两个文本的 Jaccard 相似度
 */
export function calculateSimilarity(text1: string, text2: string): number {
  const bg1 = toBigrams(text1);
  const bg2 = toBigrams(text2);

  if (bg1.size === 0 && bg2.size === 0) return 1.0;
  if (bg1.size === 0 || bg2.size === 0) return 0.0;

  let intersection = 0;
  for (const bg of bg1) {
    if (bg2.has(bg)) intersection++;
  }

  const union = bg1.size + bg2.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// ── 去重检查 ──────────────────────────────────────────────

export interface DedupResult {
  /** 是否有重复 */
  isDuplicate: boolean;
  /** 最相似的已有 episode（如果有） */
  existingEpisode?: Episode;
  /** 相似度分数 */
  similarity?: number;
}

/**
 * 检查新内容是否与已有 episode 重复
 *
 * @param workspaceId - 工作区 ID
 * @param newContent - 新 episode 内容
 * @param threshold - 相似度阈值（默认 0.95）
 */
export async function checkDuplicate(
  workspaceId: string,
  newContent: string,
  threshold = 0.95
): Promise<DedupResult> {
  // 搜索可能相似的记录（用关键词快速缩小范围）
  const keywords = extractKeywords(newContent);
  let candidates: Episode[] = [];

  for (const keyword of keywords.slice(0, 3)) {
    const results = await episodeStore.search(keyword, workspaceId);
    candidates.push(...results);
  }

  // 去重
  const seen = new Set<string>();
  candidates = candidates.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });

  // 逐个比较相似度
  let bestMatch: Episode | undefined;
  let bestScore = 0;

  for (const candidate of candidates) {
    const score = calculateSimilarity(newContent, candidate.content);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = candidate;
    }
  }

  return {
    isDuplicate: bestScore >= threshold,
    existingEpisode: bestScore >= threshold ? bestMatch : undefined,
    similarity: bestScore,
  };
}

/**
 * 从文本中提取关键词（用于快速搜索缩小范围）
 */
function extractKeywords(text: string): string[] {
  // 提取英文单词（≥ 3 字符）
  const englishWords = text.match(/[a-zA-Z]{3,}/g) ?? [];

  // 提取中文词组（简单切分：连续中文字符）
  const chinesePhrases = text.match(/[\u4e00-\u9fff]{2,}/g) ?? [];

  // 合并去重，按长度降序（长词更有区分度）
  const all = [...new Set([...englishWords, ...chinesePhrases])];
  return all.sort((a, b) => b.length - a.length);
}

// ── 合并更新 ──────────────────────────────────────────────

/**
 * 合并新内容到已有 episode（更新内容 + 刷新时间戳）
 *
 * 简单策略：用新内容替换旧内容，保留旧标签并追加新标签。
 */
export async function mergeEpisode(
  existingId: string,
  _newContent: string,
  newTags: string[] = []
): Promise<void> {
  // TODO: 通过 IPC 更新 episode 内容（需要 SQLite UPDATE 支持）
  // 降级策略：不合并，创建新条目
  console.info(`[Dedup] Would merge into episode ${existingId}, tags: ${newTags.join(', ')}`);
}
