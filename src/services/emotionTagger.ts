/**
 * emotionTagger — 情绪标签附加服务
 *
 * 根据任务执行结果自动附加情绪标签：
 * - success: 任务成功完成
 * - failure: 任务执行失败
 * - confusion: 执行过程中遇到不确定情况
 * - satisfaction: 用户明确表达满意
 *
 * 使用简单的规则匹配，不需要 LLM 调用。
 */

export type EmotionTag = 'success' | 'failure' | 'confusion' | 'satisfaction';

export interface EmotionContext {
  /** 任务是否成功完成 */
  isSuccess?: boolean;
  /** 是否有错误信息 */
  hasError?: boolean;
  /** 错误信息内容 */
  errorMessage?: string;
  /** 用户反馈（正面/负面关键词） */
  userFeedback?: string;
  /** 重试次数 */
  retryCount?: number;
  /** 执行时长（ms） */
  durationMs?: number;
}

// ── 情绪检测规则 ──────────────────────────────────────────

const POSITIVE_KEYWORDS = [
  '很好', '不错', '完美', '谢谢', '感谢', '厉害', '棒', '赞',
  'perfect', 'great', 'thanks', 'excellent', 'awesome', 'good job', 'well done',
];

const CONFUSION_KEYWORDS = [
  '不确定', '困惑', '奇怪', '为什么', '不太对', '重试', '再试',
  'not sure', 'confused', 'weird', 'why', 'retry', 'try again', 'unclear',
];

/**
 * 根据上下文推断情绪标签
 */
export function inferEmotionTag(context: EmotionContext): EmotionTag {
  const {
    isSuccess,
    hasError,
    errorMessage,
    userFeedback,
    retryCount = 0,
  } = context;

  // 1. 用户明确表达满意
  if (userFeedback) {
    const lower = userFeedback.toLowerCase();
    if (POSITIVE_KEYWORDS.some((kw) => lower.includes(kw))) {
      return 'satisfaction';
    }
    if (CONFUSION_KEYWORDS.some((kw) => lower.includes(kw))) {
      return 'confusion';
    }
  }

  // 2. 有错误 → failure
  if (hasError || errorMessage) {
    return 'failure';
  }

  // 3. 多次重试 → confusion
  if (retryCount > 1) {
    return 'confusion';
  }

  // 4. 任务成功
  if (isSuccess) {
    return 'success';
  }

  // 5. 默认：成功（乐观推断）
  return 'success';
}

/**
 * 情绪标签元数据（用于 UI 展示）
 */
export const EMOTION_META: Record<EmotionTag, { label: string; icon: string; color: string }> = {
  success: { label: '成功', icon: '✓', color: 'text-green-400' },
  failure: { label: '失败', icon: '✗', color: 'text-red-400' },
  confusion: { label: '困惑', icon: '?', color: 'text-yellow-400' },
  satisfaction: { label: '满意', icon: '★', color: 'text-blue-400' },
};
