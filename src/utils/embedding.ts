/**
 * 统一向量化接口
 * 支持 OpenAI / Ollama / Cohere API，以及本地 WebAssembly
 *
 * 调用链路：
 *   Electron 渲染进程 → IPC 桥接 → 主进程（使用 embeddingService）
 *   Vite dev / 生产浏览器 → OpenAI SDK 直调
 */

import { getDefaultConfig } from '@/stores/embeddingConfigStorage';
import type { EmbeddingConfig } from '@/stores/embeddingConfigStorage';
import { computeEmbedding, computeEmbeddings } from '@/utils/embeddingService';

export interface EmbedResult {
  vector: number[];
  dimension: number;
  latencyMs: number;
}

export type TestResult = { success: true; latency: number; dimension: number }
  | { success: false; error: string };

/** 检测是否在 Electron 渲染进程中（IPC 桥接可用） */
function isElectronEnv(): boolean {
  return typeof window !== 'undefined' && typeof window.electron?.embeddingApi !== 'undefined';
}

// ── Electron IPC 路径（主进程使用 embeddingService） ─────────────────────

async function fetchViaIpc(config: Parameters<typeof window.electron.embeddingApi.call>[0]): Promise<EmbedResult> {
  const start = Date.now();
  const result = await window.electron.embeddingApi.call(config);

  if (!result.success || !result.vector) {
    throw new Error(result.error ?? 'Embedding 调用失败');
  }
  return {
    vector: result.vector,
    dimension: result.dimension ?? result.vector.length,
    latencyMs: Date.now() - start,
  };
}

// ── 主入口：获取配置后分发到正确路径 ───────────────────────────────────

export async function testConnection(config: EmbeddingConfig): Promise<TestResult> {
  try {
    const result = await computeEmbedding('connection test', config);
    return { success: true, latency: result.latencyMs, dimension: result.dimension };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function embedText(text: string): Promise<number[]> {
  if (!text.trim()) throw new Error('文本不能为空');
  const config = await getDefaultConfig();
  if (!config) throw new Error('未配置 embedding，请先在设置中添加配置');

  // Electron 环境：走 IPC，主进程内部使用 embeddingService + OpenAI SDK
  if (isElectronEnv()) {
    return (await fetchViaIpc({
      endpoint: config.endpoint,
      provider: config.provider,
      apiKey: config.apiKey,
      model: config.model,
      text,
    })).vector;
  }

  // 非 Electron（Vite dev / 生产浏览器）：OpenAI SDK 直调
  return (await computeEmbedding(text, config)).vector;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!texts.length) return [];
  const config = await getDefaultConfig();
  if (!config) throw new Error('未配置 embedding，请先在设置中添加配置');

  // Electron 环境：走 IPC
  if (isElectronEnv()) {
    const results: number[][] = [];
    for (const text of texts) {
      results.push(await fetchViaIpc({
        endpoint: config.endpoint,
        provider: config.provider,
        apiKey: config.apiKey,
        model: config.model,
        text,
      }).then(r => r.vector));
    }
    return results;
  }

  // 非 Electron：批量 SDK 调用
  return computeEmbeddings(texts, config);
}
