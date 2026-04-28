import type { ResultEnvelope } from '@cwmb/result-model';

export type CacheScope = 'execution' | 'proposal' | 'external_mcp';

export interface CacheKey {
  scope: CacheScope;
  id: string;
}

export interface CacheEntry {
  cacheId: string;
  key: CacheKey;
  result: ResultEnvelope;
  createdAt: string;
  expiresAt: string;
  sizeChars: number;
  hitCount: number;
}

export interface SetCacheEntryOptions {
  ttlMs?: number;
}

export interface ResultCache {
  get(key: CacheKey): Promise<CacheEntry | undefined>;
  set(key: CacheKey, result: ResultEnvelope, options?: SetCacheEntryOptions): Promise<CacheEntry>;
  delete(key: CacheKey): Promise<boolean>;
  clear(): Promise<void>;
  entries(): Promise<CacheEntry[]>;
}
