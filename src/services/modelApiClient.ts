/**
 * 模型 API 调用封装
 *
 * 支持:
 * - Claude 系列模型: Anthropic Messages API (/v1/messages)
 * - 其他模型: OpenAI-compatible (/v1/chat/completions)
 */

import { getDefaultConfig } from '@/stores/modelConfigStorage';
import type { ModelConfig } from '@/types/models';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  messages: ChatMessage[];
  model: string;
  baseUrl?: string;
  apiKey?: string;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

export interface ChatCompletionResponse {
  content: string;
  usage?: { inputTokens: number; outputTokens: number };
  latencyMs: number;
}

// ── Implementation ────────────────────────────────────────────────────────────

/**
 * 调用聊天完成 API
 * - claude-* 模型走 Anthropic Messages API (/v1/messages)
 * - 其他走 OpenAI-compatible (/v1/chat/completions)
 */
export async function callChatCompletion(
  opts: ChatCompletionOptions,
  timeoutMs = 30000,
): Promise<ChatCompletionResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const signal = opts.signal
      ? mergeAbortSignals(opts.signal, controller.signal)
      : controller.signal;

    const { model, messages, baseUrl, apiKey, maxTokens = 4096, temperature = 0.3 } = opts;

    const isClaude = model.toLowerCase().startsWith('claude');

    let url: string;
    let headers: Record<string, string>;
    let body: Record<string, unknown>;

    if (isClaude) {
      // Anthropic Messages API
      url = `${baseUrl ?? 'https://api.anthropic.com'}/v1/messages`;
      headers = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey ?? '',
        'anthropic-version': '2023-06-01',
      };
      // Anthropic 不支持 system 角色，合并到首条 user 消息
      const systemMsgs = messages.filter(m => m.role === 'system');
      const otherMsgs = messages.filter(m => m.role !== 'system');
      const mergedMessages: ChatMessage[] =
        systemMsgs.length > 0
          ? [{ role: 'user' as const, content: systemMsgs.map(s => s.content).join('\n\n') + '\n\n' + (otherMsgs[0]?.content ?? '') }, ...otherMsgs.slice(1)]
          : otherMsgs;
      body = {
        model,
        messages: mergedMessages.map(m => ({ role: m.role, content: m.content })),
        max_tokens: maxTokens,
        temperature,
      };
    } else {
      // OpenAI-compatible
      url = `${baseUrl ?? 'https://api.openai.com'}/v1/chat/completions`;
      headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey ?? ''}`,
      };
      body = {
        model,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        max_tokens: maxTokens,
        temperature,
      };
    }

    const start = Date.now();
    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    });
    clearTimeout(timer);

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`API error ${resp.status}: ${text}`);
    }

    const data = await resp.json() as Record<string, unknown>;
    const latencyMs = Date.now() - start;

    let content: string;
    let usage: { inputTokens: number; outputTokens: number } | undefined;

    if (isClaude) {
      // Anthropic: { content: [{ type: 'text', text: '...' }], usage: {...} }
      const contentArr = (data.content as Array<{ type: string; text?: string }>) ?? [];
      content = contentArr.find(c => c.type === 'text')?.text ?? '';
      const usageData = data.usage as { input_tokens?: number; output_tokens?: number } | undefined;
      if (usageData) {
        usage = { inputTokens: usageData.input_tokens ?? 0, outputTokens: usageData.output_tokens ?? 0 };
      }
    } else {
      // OpenAI: { choices: [{ message: { content: '...' } }], usage: {...} }
      const choices = data.choices as Array<{ message?: { content?: string } }> ?? [];
      content = choices[0]?.message?.content ?? '';
      const usageData = data.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;
      if (usageData) {
        usage = { inputTokens: usageData.prompt_tokens ?? 0, outputTokens: usageData.completion_tokens ?? 0 };
      }
    }

    return { content, usage, latencyMs };
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

/**
 * 合并两个 AbortSignal
 */
function mergeAbortSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  const controller = new AbortController();
  a.addEventListener('abort', () => controller.abort());
  b.addEventListener('abort', () => controller.abort());
  return controller.signal;
}

// ── Default config helper ─────────────────────────────────────────────────────

/**
 * 获取默认模型的配置
 * 直接返回（加密在存储层处理，API 调用时直接用存储的值）
 */
export async function getDefaultModelConfig(): Promise<ModelConfig | undefined> {
  return getDefaultConfig();
}
