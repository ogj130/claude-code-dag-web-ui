/**
 * Session sharding utilities for handling oversized sessions.
 *
 * Sharding strategy:
 * - Sessions exceeding 10MB are automatically sharded
 * - Each shard is limited to 5MB (compressed)
 * - Shards are stored separately in IndexedDB and reassembled on read
 */

import { compress, decompress } from './compression';

/** Maximum size in bytes before a session is sharded */
export const SHARD_THRESHOLD = 10 * 1024 * 1024; // 10 MB

/** Maximum size per shard in bytes */
export const MAX_SHARD_SIZE = 5 * 1024 * 1024; // 5 MB

export interface ShardManifest {
  sessionId: string;
  totalShards: number;
  originalSize: number;
  shardIds: string[];
  createdAt: number;
}

/**
 * Generate a shard ID.
 */
export function makeShardId(sessionId: string, shardIndex: number): string {
  return `${sessionId}_shard_${String(shardIndex).padStart(4, '0')}`;
}

/**
 * Calculate the number of shards needed for a given byte size.
 */
export function calculateShardCount(byteSize: number): number {
  if (byteSize <= SHARD_THRESHOLD) return 1;
  return Math.ceil(byteSize / MAX_SHARD_SIZE);
}

/**
 * Check if content size exceeds the sharding threshold.
 */
export function shouldShard(byteSize: number): boolean {
  return byteSize > SHARD_THRESHOLD;
}

/**
 * Shard a session object into multiple chunks.
 * Each shard contains a subset of the session's queries (with tool calls).
 * Returns both the shards and a manifest for reassembly.
 */
export interface ShardData {
  id: string;
  sessionId: string;
  shardIndex: number;
  data: string;   // Compressed JSON string of the shard content
  originalSize: number;
  createdAt: number;
}

export interface SessionChunk {
  queries: ShardQuery[];
  dagData: string;
}

export interface ShardQuery {
  id: string;
  question: string;
  answer: string;
  toolCalls: ShardToolCall[];
  tokenUsage: number;
  duration: number;
  createdAt: number;
  status: 'success' | 'error' | 'partial';
  errorMessage?: string;
}

export interface ShardToolCall {
  id: string;
  toolName: string;
  arguments: string;
  result: string;
  startTime: number;
  endTime: number;
  status: 'success' | 'error';
}

/**
 * Create shards from session data.
 * The session data is split into chunks, each compressed and stored separately.
 */
export function createShards(
  sessionId: string,
  queries: ShardQuery[],
  dagData: string
): { shards: ShardData[]; manifest: ShardManifest } {
  const now = Date.now();

  // Serialize the entire session content
  const rawContent = JSON.stringify({ queries, dagData });
  const originalSize = new Blob([rawContent]).size;

  // If below threshold, create a single shard
  if (!shouldShard(originalSize)) {
    const shardId = makeShardId(sessionId, 0);
    const shard: ShardData = {
      id: shardId,
      sessionId,
      shardIndex: 0,
      data: compress(rawContent),
      originalSize,
      createdAt: now,
    };

    return {
      shards: [shard],
      manifest: {
        sessionId,
        totalShards: 1,
        originalSize,
        shardIds: [shardId],
        createdAt: now,
      },
    };
  }

  // Split queries evenly across shards to stay within MAX_SHARD_SIZE
  const totalShards = Math.ceil(originalSize / MAX_SHARD_SIZE);
  const queriesPerShard = Math.ceil(queries.length / totalShards);

  const shards: ShardData[] = [];
  const shardIds: string[] = [];

  for (let i = 0; i < totalShards; i++) {
    const chunkQueries = queries.slice(i * queriesPerShard, (i + 1) * queriesPerShard);
    const chunk: SessionChunk = { queries: chunkQueries, dagData };
    const chunkJson = JSON.stringify(chunk);
    const chunkOriginalSize = new Blob([chunkJson]).size;
    const shardId = makeShardId(sessionId, i);

    shards.push({
      id: shardId,
      sessionId,
      shardIndex: i,
      data: compress(chunkJson),
      originalSize: chunkOriginalSize,
      createdAt: now,
    });

    shardIds.push(shardId);
  }

  return {
    shards,
    manifest: {
      sessionId,
      totalShards,
      originalSize,
      shardIds,
      createdAt: now,
    },
  };
}

/**
 * Reassemble a session from its shards.
 * Shards are decompressed and merged back into a single session object.
 */
export interface ReassembledSession {
  queries: ShardQuery[];
  dagData: string;
  originalSize: number;
}

/**
 * Reassemble session data from a list of shards.
 * Shards are expected to be sorted by shardIndex.
 */
export function reassembleSession(shards: ShardData[]): ReassembledSession | null {
  if (shards.length === 0) return null;

  // Sort by shard index
  const sorted = [...shards].sort((a, b) => a.shardIndex - b.shardIndex);

  if (sorted.length === 1 && sorted[0].shardIndex === 0) {
    // Single shard — no need to reassemble, just decompress
    const decompressed = decompress(sorted[0].data);
    try {
      const chunk: SessionChunk = JSON.parse(decompressed);
      return {
        queries: chunk.queries,
        dagData: chunk.dagData,
        originalSize: sorted[0].originalSize,
      };
    } catch {
      return null;
    }
  }

  // Multiple shards — need to merge
  const allQueries: ShardQuery[] = [];
  let dagData = '';

  for (const shard of sorted) {
    const decompressed = decompress(shard.data);
    try {
      const chunk: SessionChunk = JSON.parse(decompressed);
      allQueries.push(...chunk.queries);
      // DAG data is the same in all shards (the full DAG), take the last one
      dagData = chunk.dagData;
    } catch {
      // Skip corrupted shards
      continue;
    }
  }

  const originalSize = sorted.reduce((sum, s) => sum + s.originalSize, 0);

  return { queries: allQueries, dagData, originalSize };
}
