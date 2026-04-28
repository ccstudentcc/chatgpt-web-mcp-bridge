import { describe, expect, it } from 'vitest';
import {
  hasStartupRecoveryComposerText,
  restorePersistedUndeliveredResultSessionOnStartup
} from '../../extension/src/result-delivery/index.js';

describe('restorePersistedUndeliveredResultSessionOnStartup', () => {
  it('keeps probing until hydration restores the persisted composer text', async () => {
    let currentTime = 0;
    const composerStates = ['', '', 'tool-result'];
    const restoreCalls: Array<{ currentComposerText: string; clearOnMismatch: boolean }> = [];

    const restored = await restorePersistedUndeliveredResultSessionOnStartup({
      readCurrentComposerText: () => composerStates[Math.min(Math.floor(currentTime / 100), composerStates.length - 1)] ?? '',
      restorePersistedSession: ({ currentComposerText, clearOnMismatch }) => {
        restoreCalls.push({ currentComposerText, clearOnMismatch });
        return currentComposerText === 'tool-result';
      },
      wait: async (ms) => {
        currentTime += ms;
      },
      now: () => currentTime,
      timeoutMs: 400,
      pollIntervalMs: 100
    });

    expect(restored).toBe(true);
    expect(restoreCalls).toEqual([
      { currentComposerText: '', clearOnMismatch: false },
      { currentComposerText: '', clearOnMismatch: false },
      { currentComposerText: 'tool-result', clearOnMismatch: false }
    ]);
  });

  it('keeps the final mismatch probe non-destructive while the composer is still empty', async () => {
    let currentTime = 0;
    const restoreCalls: Array<{ currentComposerText: string; clearOnMismatch: boolean }> = [];

    const restored = await restorePersistedUndeliveredResultSessionOnStartup({
      readCurrentComposerText: () => '',
      restorePersistedSession: ({ currentComposerText, clearOnMismatch }) => {
        restoreCalls.push({ currentComposerText, clearOnMismatch });
        return false;
      },
      wait: async (ms) => {
        currentTime += ms;
      },
      now: () => currentTime,
      timeoutMs: 200,
      pollIntervalMs: 100
    });

    expect(restored).toBe(false);
    expect(restoreCalls.at(-1)).toEqual({ currentComposerText: '', clearOnMismatch: false });
  });

  it('clears on the final mismatch probe once hydration has produced a non-empty divergent draft', async () => {
    let currentTime = 0;
    const restoreCalls: Array<{ currentComposerText: string; clearOnMismatch: boolean }> = [];

    const restored = await restorePersistedUndeliveredResultSessionOnStartup({
      readCurrentComposerText: () => 'user kept draft',
      restorePersistedSession: ({ currentComposerText, clearOnMismatch }) => {
        restoreCalls.push({ currentComposerText, clearOnMismatch });
        return false;
      },
      wait: async (ms) => {
        currentTime += ms;
      },
      now: () => currentTime,
      timeoutMs: 200,
      pollIntervalMs: 100
    });

    expect(restored).toBe(false);
    expect(restoreCalls.at(-1)).toEqual({ currentComposerText: 'user kept draft', clearOnMismatch: true });
  });
});

describe('hasStartupRecoveryComposerText', () => {
  it('treats trimmed visible text as meaningful and empty whitespace as absent', () => {
    expect(hasStartupRecoveryComposerText(' \u00a0 tool-result \n')).toBe(true);
    expect(hasStartupRecoveryComposerText(' \u00a0 \n')).toBe(false);
  });
});
