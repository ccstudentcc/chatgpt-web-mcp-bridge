import { describe, expect, it } from 'vitest';
import {
  getGatewayCatalogTools,
  hasLiveGatewayCatalog,
  withGatewayCatalog,
  withGatewayHealth,
  withoutGatewayCatalog
} from './runtime-snapshot.js';

describe('runtime snapshot compat helpers', () => {
  it('keeps validated health when live catalog sync is cleared', () => {
    const snapshotWithHealth = withGatewayHealth(undefined, {
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
    const snapshotWithCatalog = withGatewayCatalog(snapshotWithHealth, {
      catalogVersion: 'phase1.shared-contract-freeze.v1',
      generatedAt: '2026-04-27T12:00:00.000Z',
      workspaceRoot: '/workspace',
      tools: []
    }, 'live');

    const cleared = withoutGatewayCatalog(snapshotWithCatalog);

    expect(cleared).toMatchObject({
      health: {
        trustedLocalMode: false,
        maxToolRounds: 5
      }
    });
    expect(hasLiveGatewayCatalog(cleared)).toBe(false);
  });

  it('treats cached bootstrap catalog as not yet live', () => {
    const snapshot = withGatewayCatalog(undefined, {
      catalogVersion: 'phase1.shared-contract-freeze.v1',
      generatedAt: '2026-04-27T12:00:00.000Z',
      workspaceRoot: '/workspace',
      tools: []
    }, 'cache');

    expect(hasLiveGatewayCatalog(snapshot)).toBe(false);
    expect(getGatewayCatalogTools(snapshot)).toEqual([]);
  });
});
