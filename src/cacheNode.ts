export interface CacheItem<T> {
  value: T;
  expiresAt: number;
}

export class CacheNode {
  public readonly id: string;
  private store: Map<string, CacheItem<any>>;

  constructor(id: string) {
    this.id = id;
    this.store = new Map();
  }

  /**
   * Retrieves a value from the cache. If expired or not present, returns null.
   */
  public get<T>(key: string): T | null {
    const item = this.store.get(key);
    if (!item) {
      return null;
    }

    if (Date.now() > item.expiresAt) {
      this.store.delete(key); // Evict expired item
      return null;
    }

    return item.value as T;
  }

  /**
   * Sets a value in the cache with a Time-To-Live in milliseconds.
   */
  public set<T>(key: string, value: T, ttlMs: number): void {
    const expiresAt = Date.now() + ttlMs;
    this.store.set(key, { value, expiresAt });
  }

  /**
   * Evicts a key from the cache.
   */
  public delete(key: string): void {
    this.store.delete(key);
  }

  /**
   * Clears all cached items on this node.
   */
  public clear(): void {
    this.store.clear();
  }

  /**
   * Returns keys present in the cache for debugging.
   */
  public getKeys(): string[] {
    // Return all non-expired keys
    const now = Date.now();
    const activeKeys: string[] = [];
    for (const [key, item] of this.store.entries()) {
      if (now <= item.expiresAt) {
        activeKeys.push(key);
      }
    }
    return activeKeys;
  }
}
