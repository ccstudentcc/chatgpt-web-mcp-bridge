import { beforeAll, describe, expect, it, vi } from 'vitest';

let computeRestoredLogScrollTop: typeof import('./ui.js').computeRestoredLogScrollTop;

beforeAll(async () => {
  vi.stubGlobal('GM_getValue', (_key: string, fallback: string) => fallback);
  vi.stubGlobal('GM_setValue', vi.fn());
  vi.stubGlobal('GM_setClipboard', vi.fn());
  ({ computeRestoredLogScrollTop } = await import('./ui.js'));
});

describe('computeRestoredLogScrollTop', () => {
  it('keeps the log pinned to the newest entries when the user was near the top', () => {
    expect(computeRestoredLogScrollTop(0, 220, 340, true)).toBe(0);
    expect(computeRestoredLogScrollTop(6, 220, 340, true)).toBe(0);
  });

  it('preserves the viewed older log region when new entries prepend above it', () => {
    expect(computeRestoredLogScrollTop(96, 240, 312, false)).toBe(168);
  });

  it('does not move backwards when the new log height is smaller', () => {
    expect(computeRestoredLogScrollTop(120, 320, 280, false)).toBe(120);
  });
});
