import type {
  SkillMetadata,
  SkillRef,
  SkillDetail,
  SkillSearchOptions,
  SkillMatch,
  CreateSkillInput,
} from '@/types/multi-agent/skill';
import { LRUCache } from './LRUCache';

/**
 * SkillStore - Manages skill metadata and content with lazy loading
 */
export class SkillStore {
  private registry: Map<string, SkillMetadata> = new Map();
  private contentCache: LRUCache<SkillDetail>;
  private vectorIndex: Map<string, number[]> = new Map(); // id -> embedding

  constructor(cacheSize: number = 50) {
    this.contentCache = new LRUCache<SkillDetail>(cacheSize);
  }

  /**
   * Register a new skill
   */
  async register(input: CreateSkillInput): Promise<string> {
    const id = `skill-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    
    const metadata: SkillMetadata = {
      id,
      name: input.name,
      domain: input.domain,
      trigger: input.trigger,
      summary: input.summary,
      stepsHint: input.stepsHint,
      meta: {
        successRate: 0,
        usageCount: 0,
        createdAt: Date.now(),
      },
    };

    this.registry.set(id, metadata);
    
    // Generate simple vector (in production, use actual embedding)
    this.vectorIndex.set(id, this.generateSimpleVector(input.summary));

    return id;
  }

  /**
   * Get skill metadata
   */
  async getMetadata(id: string): Promise<SkillMetadata | null> {
    return this.registry.get(id) || null;
  }

  /**
   * Get full skill detail (loads from cache or generates)
   */
  async getDetail(id: string): Promise<SkillDetail | null> {
    // Check cache first
    const cached = this.contentCache.get(id);
    if (cached) {
      return cached;
    }

    // Get metadata
    const meta = this.registry.get(id);
    if (!meta) {
      return null;
    }

    // Generate detail (in production, this would load from storage)
    const detail: SkillDetail = {
      id,
      steps: meta.stepsHint.map((hint, i) => ({
        order: i + 1,
        description: hint,
        rationale: `Step ${i + 1} for ${meta.name}`,
      })),
      examples: [],
    };

    this.contentCache.set(id, detail);
    return detail;
  }

  /**
   * Search skills by query
   */
  async search(query: string, options?: SkillSearchOptions): Promise<SkillMatch[]> {
    const topK = options?.topK ?? 5;
    const queryVector = this.generateSimpleVector(query);

    // Calculate similarities
    const scores: { id: string; score: number }[] = [];
    const entries = Array.from(this.vectorIndex.entries());
    
    for (let i = 0; i < entries.length; i++) {
      const [id, vector] = entries[i];
      const meta = this.registry.get(id);
      if (!meta) continue;

      // Filter by domain
      if (options?.domain && meta.domain !== options.domain) {
        continue;
      }

      // Filter by trigger mode
      if (options?.triggerMode) {
        const hasKeyword = meta.trigger.keywords.some(k => 
          query.toLowerCase().includes(k.toLowerCase())
        );
        if (!hasKeyword) continue;
      }

      // Calculate cosine similarity
      const similarity = this.cosineSimilarity(queryVector, vector);
      
      if (options?.minScore && similarity < options.minScore) {
        continue;
      }

      scores.push({ id, score: similarity });
    }

    // Sort and return top K
    scores.sort((a, b) => b.score - a.score);
    
    return scores.slice(0, topK).map(({ id, score }) => {
      const meta = this.registry.get(id)!;
      const ref: SkillRef = {
        id: meta.id,
        name: meta.name,
        score,
        summary: meta.summary,
        domain: meta.domain,
        triggerMode: meta.trigger.keywords.length > 0 ? 'on_dispatch' : 'on_request',
      };
      return {
        ref,
        relevanceScore: score,
      };
    });
  }

  /**
   * Get all registered skills
   */
  async getAll(): Promise<SkillMetadata[]> {
    return Array.from(this.registry.values());
  }

  /**
   * Update skill statistics
   */
  async updateStats(id: string, success: boolean): Promise<void> {
    const meta = this.registry.get(id);
    if (!meta) return;

    const total = meta.meta.usageCount + 1;
    const successes = success ? meta.meta.successRate * (total - 1) + 1 : meta.meta.successRate * (total - 1);
    
    meta.meta.usageCount = total;
    meta.meta.successRate = successes / total;
    meta.meta.lastUsed = Date.now();
  }

  /**
   * Delete a skill
   */
  async delete(id: string): Promise<boolean> {
    this.contentCache.delete(id);
    this.vectorIndex.delete(id);
    return this.registry.delete(id);
  }

  // Simple vector generation (in production, use actual embeddings)
  private generateSimpleVector(text: string): number[] {
    const dim = 128;
    const vec = new Array(dim).fill(0);
    const words = text.toLowerCase().split(/\s+/);
    
    for (let i = 0; i < words.length; i++) {
      const hash = this.hashString(words[i]);
      vec[hash % dim] += 1;
    }

    // Normalize
    const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
    return vec.map(v => v / (norm || 1));
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
  }
}

// Singleton
let storeInstance: SkillStore | null = null;

export function getSkillStore(): SkillStore {
  if (!storeInstance) {
    storeInstance = new SkillStore();
  }
  return storeInstance;
}

export function resetSkillStore(): void {
  storeInstance = null;
}
