import type { SkillRef } from '@/types/multi-agent/skill';
import { getSkillStore } from './SkillStore';

/**
 * SkillRetriever - Handles automatic skill retrieval based on trigger modes
 */
export class SkillRetriever {
  /**
   * Retrieve skills for a given query and context
   */
  async retrieve(
    query: string,
    options?: { triggerMode?: 'on_dispatch' | 'on_struggle' | 'on_reflection' | 'on_request' }
  ): Promise<SkillRef[]> {
    const store = getSkillStore();
    const results = await store.search(query, {
      topK: 5,
      ...options,
    });
    return results.map(r => r.ref);
  }

  /**
   * Retrieve skills for dispatch - auto-selects ON_DISPATCH skills
   */
  async retrieveForDispatch(context: string): Promise<SkillRef[]> {
    return this.retrieve(context, { triggerMode: 'on_dispatch' });
  }

  /**
   * Retrieve skills for struggle - selects ON_STRUGGLE skills
   */
  async retrieveForStruggle(context: string): Promise<SkillRef[]> {
    return this.retrieve(context, { triggerMode: 'on_struggle' });
  }

  /**
   * Retrieve skills on reflection - selects ON_REFLECTION skills
   */
  async retrieveOnReflection(context: string): Promise<SkillRef[]> {
    return this.retrieve(context, { triggerMode: 'on_reflection' });
  }
}

// Singleton
let retrieverInstance: SkillRetriever | null = null;

export function getSkillRetriever(): SkillRetriever {
  if (!retrieverInstance) {
    retrieverInstance = new SkillRetriever();
  }
  return retrieverInstance;
}
