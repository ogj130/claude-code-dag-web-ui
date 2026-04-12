/**
 * 向量化服务 — 基于 OpenAI SDK + Vite 代理
 *
 * 调用链路：
 *   Vite dev（浏览器）  → /v1/embeddings → Vite 中间件 → Embedding API（CORS 绕过）
 *   生产 / 非 Electron  → OpenAI SDK 直调
 *
 * Vite 中间件（vite.config.ts）拦截 /v1/embeddings，
 * 通过 x-embedding-target 头动态路由到配置的外部 API。
 */

import OpenAI from 'openai';
import type { EmbeddingConfig, EmbeddingProvider } from '@/stores/embeddingConfigStorage';

export interface EmbedResult {
  vector: number[];
  dimension: number;
  latencyMs: number;
}

// ── Dev 模式：走 Vite 中间件代理（绕过 CORS） ────────────────────────────

async function fetchViaProxy(
  texts: string[],
  config: EmbeddingConfig
): Promise<number[][]> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-embedding-target': config.endpoint,
  };
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }

  // input: 单条用字符串（兼容阿里 DashScope 等），多条用数组
  const body: Record<string, unknown> = {
    model: config.model,
    input: texts.length === 1 ? texts[0] : texts,
  };

  const response = await fetch('/v1/embeddings', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(`Embedding API error: ${response.status} ${response.statusText}${errBody ? ` — ${errBody}` : ''}`);
  }

  const data = await response.json() as { data: Array<{ embedding: number[] }> };
  if (!data.data?.length) throw new Error('Embedding API 返回格式异常：无 embedding 数据');
  return data.data.map(d => d.embedding ?? []);
}

// ── 非 Dev：SDK 直调（生产环境 / 非 Vite） ──────────────────────────────

let _client: OpenAI | null = null;
let _cachedConfigId: string | null = null;

function getClient(config: EmbeddingConfig): OpenAI {
  if (_client && _cachedConfigId === config.id) return _client;

  const baseURL = config.provider === 'ollama'
    ? `${config.endpoint}/v1`
    : config.endpoint;

  _client = new OpenAI({
    apiKey: config.apiKey ?? 'unused',
    baseURL,
    dangerouslyAllowBrowser: true,
  });

  _cachedConfigId = config.id;
  return _client;
}

async function callWithProvider(
  client: OpenAI,
  provider: EmbeddingProvider,
  texts: string[],
  model: string
): Promise<number[][]> {
  switch (provider) {
    case 'ollama': {
      // Ollama /v1/embeddings 不支持批量，逐条调用
      const vectors = await Promise.all(
        texts.map(text =>
          client.embeddings.create({ input: text, model })
            .then(r => r.data[0].embedding as number[])
        )
      );
      return vectors;
    }
    case 'cohere':
    case 'openai':
    case 'local':
    default: {
      // input: 单条用字符串（兼容阿里 DashScope），多条用数组
      const input = texts.length === 1 ? texts[0] : texts;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await client.embeddings.create({ input, model } as any);
      return response.data.map(d => d.embedding as number[]);
    }
  }
}

async function fetchDirect(
  texts: string[],
  config: EmbeddingConfig
): Promise<number[][]> {
  const client = getClient(config);
  return callWithProvider(client, config.provider, texts, config.model);
}

// ── 核心 API ───────────────────────────────────────────────────────────────

/**
 * 计算单条文本的 embedding 向量
 */
export async function computeEmbedding(
  text: string,
  config: EmbeddingConfig
): Promise<EmbedResult> {
  const start = Date.now();
  const vectors = await computeEmbeddings([text], config);
  return { vector: vectors[0], dimension: vectors[0].length, latencyMs: Date.now() - start };
}

/**
 * 批量计算多条文本的 embedding 向量
 *
 * Vite dev：走 Vite 中间件代理绕过 CORS
 * 其他环境：SDK 直调
 */
export async function computeEmbeddings(
  texts: string[],
  config: EmbeddingConfig
): Promise<number[][]> {
  if (!texts.length) return [];

  // Vite dev 走代理（非 Electron、无 IPC 桥接）
  const isDev = import.meta.env.DEV;
  const useProxy = isDev && typeof window !== 'undefined' && !window.electronAPI?.embeddingApi;

  if (useProxy) {
    return fetchViaProxy(texts, config);
  }
  return fetchDirect(texts, config);
}
