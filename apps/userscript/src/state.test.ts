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
});
