/**
 * IntentEngine — 意图理解引擎
 *
 * 调用 LLM API 将自然语言解析为结构化 IntentResult。
 * 降级方案：LLM 不可用时使用关键词匹配。
 */

import type { IntentResult } from '../components/v3/IntentPanel';

// LLM 调用配置
interface LLMConfig {
  provider: 'openai' | 'anthropic';
  model: string;
  apiKey?: string;
}

// 意图类型关键词映射（降级方案）
const KEYWORD_MAP: Record<string, string[]> = {
  create: ['创建', '新建', '搭建', '开发', '做一个', 'create', 'build', 'new', 'make'],
  fix: ['修复', '修复', '解决', '改', 'fix', 'repair', 'debug', 'solve', 'bug'],
  refactor: ['重构', '优化', '重写', '改进', 'refactor', 'optimize', 'improve', 'rewrite'],
  deploy: ['部署', '发布', '上线', '打包', 'deploy', 'publish', 'release', 'ship'],
  query: ['查询', '搜索', '找', '看看', 'search', 'find', 'query', 'look', 'show'],
};

/**
 * 解析用户输入为 IntentResult
 *
 * 优先使用 LLM API，失败时降级为关键词匹配。
 */
export async function parseIntent(
  input: string,
  llmConfig?: LLMConfig
): Promise<IntentResult> {
  // 优先尝试 LLM 解析
  if (llmConfig?.apiKey) {
    try {
      return await parseWithLLM(input, llmConfig);
    } catch (err) {
      console.warn('[IntentEngine] LLM parse failed, falling back to keywords:', err);
    }
  }

  // 降级：关键词匹配
  return parseWithKeywords(input);
}

/**
 * LLM 解析（OpenAI / Anthropic）
 */
async function parseWithLLM(input: string, config: LLMConfig): Promise<IntentResult> {
  const systemPrompt = `你是一个意图解析引擎。分析用户的自然语言输入，输出 JSON 格式的意图解析结果。
输出格式：
{
  "type": "create|fix|refactor|deploy|query",
  "confidence": 0.0-1.0,
  "entities": { "file": "...", "module": "...", "framework": "...", "error": "..." },
  "suggestions": ["..."]
}
仅输出 JSON，不要其他内容。`;

  // 这里实际调用 LLM API（通过现有的 OpenAI/Anthropic SDK）
  // 简化实现：使用 fetch 通过现有的 embedding proxy 或直接调用
  const response = await fetch('/api/intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: input },
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) throw new Error(`LLM API error: ${response.status}`);

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? '';
  return JSON.parse(content);
}

/**
 * 关键词降级解析
 */
function parseWithKeywords(input: string): IntentResult {
  const lower = input.toLowerCase();
  let bestType = 'query';
  let bestScore = 0;

  for (const [type, keywords] of Object.entries(KEYWORD_MAP)) {
    const score = keywords.filter((kw) => lower.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  }

  const confidence = Math.min(0.3 + bestScore * 0.2, 0.8);

  // 提取文件名实体
  const fileMatch = input.match(/[\w-]+\.(tsx|ts|jsx|js|py|go|rs|vue|css|html)/);
  const entities: Record<string, string> = {};
  if (fileMatch) entities.file = fileMatch[0];

  return {
    type: bestType,
    confidence,
    entities,
    suggestions: [],
    source: input,
  };
}
