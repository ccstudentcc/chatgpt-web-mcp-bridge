import type { CacheEntry, CacheKey, ResultCache, SetCacheEntryOptions } from './types.js';

export interface InMemoryResultCacheOptions {
  defaultTtlMs?: number;
  maxEntries?: number;
  now?: () => number;
}

const DEFAULT_TTL_MS = 5 * 60_000;
const DEFAULT_MAX_ENTRIES = 128;

export function createInMemoryResultCache(options: InMemoryResultCacheOptions = {}): ResultCache {
  const defaultTtlMs = options.defaultTtlMs ?? DEFAULT_TTL_MS;
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const now = options.now ?? Date.now;
  const store = new Map<string, CacheEntry>();

  const pruneExpired = (currentTime = now()): void => {
    for (const [cacheId, entry] of store.entries()) {
      if (Date.parse(entry.expiresAt) <= currentTime) {
        store.delete(cacheId);
      }
    }
  };

  const trimToCap = (): void => {
    while (store.size > maxEntries) {
      const oldest = store.keys().next().value;
      if (!oldest) {
        break;
      }
      store.delete(oldest);
    }
  };

  return {
    async get(key: CacheKey) {
      pruneExpired();
      const cacheId = serializeCacheKey(key);
      const current = store.get(cacheId);
      if (!current) {
        return undefined;
      }

      const hit = {
        ...current,
        hitCount: current.hitCount + 1
      };
      store.delete(cacheId);
      store.set(cacheId, hit);
      return hit;
    },
    async set(key: CacheKey, result, setOptions: SetCacheEntryOptions = {}) {
      const currentTime = now();
      pruneExpired(currentTime);

      const cacheId = serializeCacheKey(key);
      const ttlMs = setOptions.ttlMs ?? defaultTtlMs;
      const entry: CacheEntry = {
        cacheId,
        key,
        result,
        createdAt: new Date(currentTime).toISOString(),
        expiresAt: new Date(currentTime + ttlMs).toISOString(),
        sizeChars: JSON.stringify(result).length,
        hitCount: 0
      };

      store.delete(cacheId);
      store.set(cacheId, entry);
      trimToCap();
      return entry;
    },
    async delete(key: CacheKey) {
      pruneExpired();
      return store.delete(serializeCacheKey(key));
    },
    async clear() {
      store.clear();
    },
    async entries() {
      pruneExpired();
      return [...store.values()];
    }
  };
}

export function serializeCacheKey(key: CacheKey): string {
  return `${key.scope}:${key.id}`;
}
