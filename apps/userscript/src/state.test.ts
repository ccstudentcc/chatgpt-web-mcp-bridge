import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('state runtime snapshot helpers', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.stubGlobal('GM_getValue', vi.fn((_key: string, defaultValue = '') => defaultValue));
    vi.stubGlobal('GM_setValue', vi.fn());
  });

  it('applies gateway automation defaults when health is stored', async () => {
    const {
      setGatewayHealth,
      state
    } = await import('./state.js');

    setGatewayHealth({
      ok: true,
      version: '0.1.0',
      platform: 'linux',
      host: '127.0.0.1',
      port: 8024,
      workspaceRoot: '/workspace',
      shell: {
        preferred: 'pwsh',
        resolved: 'pwsh',
        available: true,
        version: '7.5.0'
      },
      trustedLocalMode: false,
      autoExecuteLowRisk: true,
      autoInsertResult: true,
      autoSendResult: false,
      maxToolRounds: 5
    });

    expect(state.gatewayRuntime).toMatchObject({
      health: {
        trustedLocalMode: false,
        maxToolRounds: 5
      }
    });
    expect(state.trustedLocalMode).toBe(false);
    expect(state.maxToolRounds).toBe(5);
    expect(state.autoSendResult).toBe(false);
  });

  it('restores an undelivered inserted result only when the same composer text survived refresh', async () => {
    const storedValues = new Map<string, string>([
      ['cwmb_undelivered_result_session', JSON.stringify({
        conversationPath: '/c/test-thread',
        status: 'inserted',
        lastResult: 'tool-result',
        lastError: undefined,
        lastDeliveryRecovery: {
          kind: 'send_button_missing',
          message: 'Tool result is still preserved in the ChatGPT composer.'
        },
        executedCallIds: ['call-1'],
        executedBatchIds: []
      })]
    ]);
    vi.stubGlobal('GM_getValue', vi.fn((key: string, defaultValue = '') => storedValues.get(key) ?? defaultValue));
    vi.stubGlobal('GM_setValue', vi.fn((key: string, value: string) => {
      storedValues.set(key, value);
    }));

    const {
      restorePersistedUndeliveredResultSession,
      state
    } = await import('./state.js');

    const restored = restorePersistedUndeliveredResultSession({
      conversationPath: '/c/test-thread',
      currentComposerText: 'tool-result'
    });

    expect(restored).toBe(true);
    expect(state.status).toBe('inserted');
    expect(state.lastResult).toBe('tool-result');
    expect([...state.executedCallIds]).toEqual(['call-1']);
  });

  it('clears a stale undelivered result snapshot when the composer no longer matches after refresh', async () => {
    const setValue = vi.fn();
    vi.stubGlobal('GM_getValue', vi.fn((key: string, defaultValue = '') => {
      if (key === 'cwmb_undelivered_result_session') {
        return JSON.stringify({
          conversationPath: '/c/test-thread',
          status: 'inserted',
          lastResult: 'tool-result',
          executedCallIds: ['call-1'],
          executedBatchIds: []
        });
      }
      return defaultValue;
    }));
    vi.stubGlobal('GM_setValue', setValue);

    const {
      restorePersistedUndeliveredResultSession
    } = await import('./state.js');

    const restored = restorePersistedUndeliveredResultSession({
      conversationPath: '/c/test-thread',
      currentComposerText: ''
    });

    expect(restored).toBe(false);
    expect(setValue).toHaveBeenCalledWith('cwmb_undelivered_result_session', '');
  });
});
