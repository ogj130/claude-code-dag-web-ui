import { getDefaultConfig } from '@/stores/embeddingConfigStorage';
import type { EmbeddingConfig } from '@/stores/embeddingConfigStorage';

export interface EmbedResult {
  vector: number[];
  dimension: number;
  latencyMs: number;
}

async function fetchEmbedding(text: string, config: EmbeddingConfig): Promise<EmbedResult> {
  const start = Date.now();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;

  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ input: text, model: config.model }),
  });

  if (!response.ok) throw new Error(`Embedding API error: ${response.status}`);
  const data = await response.json() as { data: Array<{ embedding: number[] }> };
  const vector = data.data[0]?.embedding ?? [];
  return { vector, dimension: vector.length, latencyMs: Date.now() - start };
}

export async function testConnection(config: EmbeddingConfig): Promise<{ success: boolean; latency?: number; dimension?: number; error?: string }> {
  try {
    const result = await fetchEmbedding('connection test', config);
    return { success: true, latency: result.latencyMs, dimension: result.dimension };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function embedText(text: string): Promise<number[]> {
  const config = await getDefaultConfig();
  if (!config) throw new Error('No embedding config found');
  return (await fetchEmbedding(text, config)).vector;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const config = await getDefaultConfig();
  if (!config) throw new Error('No embedding config found');
  return Promise.all(texts.map(text => fetchEmbedding(text, config).then(r => r.vector)));
}
