/**
 * Simple LRU Cache with max size limit
 */
export class LRUCache<T> {
  private cache: Map<string, { value: T; timestamp: number; accessCount: number }> = new Map();
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (entry) {
      // Update access
      entry.accessCount++;
      return entry.value;
    }
    return undefined;
  }

  set(key: string, value: T): void {
    // Evict if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      accessCount: 0,
    });
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  private evictLRU(): void {
    let oldest: string | null = null;
    let oldestTime = Infinity;

    this.cache.forEach((entry, key) => {
      if (entry.accessCount === 0 && entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldest = key;
      }
    });

    // If all have been accessed, evict least recently used by timestamp
    if (oldest === null) {
      this.cache.forEach((entry, key) => {
        if (entry.timestamp < oldestTime) {
          oldestTime = entry.timestamp;
          oldest = key;
        }
      });
    }

    if (oldest) {
      this.cache.delete(oldest);
    }
  }

  get size(): number {
    return this.cache.size;
  }
}
