// Skill domain categories
export type SkillDomain = 'performance' | 'refactor' | 'bugfix' | 'architecture' | 'testing' | 'security' | 'database';

// Skill trigger mode - when to auto-load
export type SkillTriggerMode = 'on_dispatch' | 'on_struggle' | 'on_reflection' | 'on_request';

// Trigger condition for skill
export interface SkillTrigger {
  keywords: string[];
  contextPatterns: string[];
  toolPatterns?: string[];
}

// Skill metadata - lightweight, stored in registry
export interface SkillMetadata {
  id: string;
  name: string;
  domain: SkillDomain;
  trigger: SkillTrigger;
  summary: string;           // Brief description for context injection
  stepsHint: string[];       // Key solution steps (not full content)
  meta: {
    successRate: number;     // 0-1
    usageCount: number;
    createdAt: number;
    lastUsed?: number;
  };
}

// Skill reference - injected into context (lightweight)
export interface SkillRef {
  id: string;
  name: string;
  score: number;             // Similarity score from retrieval
  summary: string;           // Only summary, not full content
  domain: SkillDomain;
  triggerMode: SkillTriggerMode;  // When to load
  _loaded?: SkillDetail;      // Filled when loaded on-demand
}

// Skill step detail
export interface SkillStep {
  order: number;
  description: string;
  rationale: string;
  codeTemplate?: string;
  tools?: string[];
  fallback?: string;
}

// Skill example
export interface SkillExample {
  problem: string;
  solution: string;
  outcome?: string;
}

// Skill verification method
export interface SkillVerification {
  method: string;
  expectedOutcome: string;
}

// Skill detail - loaded on-demand
export interface SkillDetail {
  id: string;
  steps: SkillStep[];
  examples: SkillExample[];
  verification?: SkillVerification;
}

// Skill match result
export interface SkillMatch {
  ref: SkillRef;
  relevanceScore: number;
  lastUsed?: number;
}

// Search options for skill retrieval
export interface SkillSearchOptions {
  topK?: number;
  domain?: SkillDomain;
  minScore?: number;
  triggerMode?: SkillTriggerMode;
}

// Skill creation input
export interface CreateSkillInput {
  name: string;
  domain: SkillDomain;
  trigger: SkillTrigger;
  summary: string;
  stepsHint: string[];
  detail: SkillDetail;
}

// LRU cache entry
export interface LRUCacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  accessCount: number;
}
