import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('state runtime snapshot helpers', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.stubGlobal('GM_getValue', vi.fn((_key: string, defaultValue = '') => defaultValue));
    vi.stubGlobal('GM_setValue', vi.fn());
  });

  it('keeps validated health when live catalog sync is cleared', async () => {
    const {
      clearGatewayCatalog,
      hasLiveCatalog,
      setGatewayCatalog,
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
    setGatewayCatalog({
      catalogVersion: 'phase1.shared-contract-freeze.v1',
      generatedAt: '2026-04-27T12:00:00.000Z',
      workspaceRoot: '/workspace',
      tools: []
    }, 'live');

    clearGatewayCatalog();

    expect(state.gatewayRuntime).toMatchObject({
      health: {
        trustedLocalMode: false,
        maxToolRounds: 5
      }
    });
    expect(hasLiveCatalog()).toBe(false);
    expect(state.trustedLocalMode).toBe(false);
    expect(state.maxToolRounds).toBe(5);
  });

  it('treats cached bootstrap catalog as not yet live', async () => {
    const { hasLiveCatalog, setGatewayCatalog } = await import('./state.js');

    setGatewayCatalog({
      catalogVersion: 'phase1.shared-contract-freeze.v1',
      generatedAt: '2026-04-27T12:00:00.000Z',
      workspaceRoot: '/workspace',
      tools: []
    }, 'cache');

    expect(hasLiveCatalog()).toBe(false);
  });
});
