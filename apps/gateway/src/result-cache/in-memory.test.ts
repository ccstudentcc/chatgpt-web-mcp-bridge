import { describe, expect, expectTypeOf, it } from 'vitest';
import { createInMemoryResultCache, serializeCacheKey } from './in-memory.js';
import type { ResultCache } from './types.js';

describe('in-memory result cache', () => {
  it('stores typed entries with TTL and hit tracking', async () => {
    let now = 0;
    const cache = createInMemoryResultCache({
      defaultTtlMs: 10,
      now: () => now
    });

    expectTypeOf(cache).toMatchTypeOf<ResultCache>();

    const key = { scope: 'execution' as const, id: 'req-1' };
    await cache.set(key, {
      type: 'inline_tool_result',
      callId: 'call-1',
      tool: 'list_directory',
      ok: true,
      output: { entries: [] },
      summary: 'Listed directory.'
    });

    now = 5;
    const firstHit = await cache.get(key);
    expect(firstHit?.hitCount).toBe(1);

    now = 11;
    await expect(cache.get(key)).resolves.toBeUndefined();
    await expect(cache.entries()).resolves.toEqual([]);
  });

  it('enforces a max-entry cap with oldest-entry eviction', async () => {
    let now = 100;
    const cache = createInMemoryResultCache({
      maxEntries: 2,
      now: () => now
    });

    await cache.set({ scope: 'execution', id: 'one' }, {
      type: 'inline_tool_result',
      callId: 'call-1',
      tool: 'read_file',
      ok: true,
      output: 'one',
      summary: 'one'
    });
    now += 1;
    await cache.set({ scope: 'execution', id: 'two' }, {
      type: 'inline_tool_result',
      callId: 'call-2',
      tool: 'read_file',
      ok: true,
      output: 'two',
      summary: 'two'
    });
    now += 1;
    await cache.set({ scope: 'execution', id: 'three' }, {
      type: 'inline_tool_result',
      callId: 'call-3',
      tool: 'read_file',
      ok: true,
      output: 'three',
      summary: 'three'
    });

    expect(serializeCacheKey({ scope: 'execution', id: 'three' })).toBe('execution:three');
    await expect(cache.get({ scope: 'execution', id: 'one' })).resolves.toBeUndefined();
    await expect(cache.entries()).resolves.toHaveLength(2);
  });
});
