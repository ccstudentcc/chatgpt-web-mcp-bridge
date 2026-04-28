import { describe, expect, expectTypeOf, it } from 'vitest';
import { createNoopExternalMcpRegistry } from './noop.js';
import type { ExternalMcpRegistry } from './types.js';

describe('noop external mcp registry', () => {
  it('exposes a consumable typed stub without live integration behavior', async () => {
    const registry = createNoopExternalMcpRegistry();

    expectTypeOf(registry).toMatchTypeOf<ExternalMcpRegistry>();
    await expect(registry.listServers()).resolves.toEqual([]);
    await expect(registry.listTools()).resolves.toEqual([]);
    await expect(registry.getServer('endpoint-1')).resolves.toBeUndefined();
    await expect(registry.upsertEndpoint({
      endpointId: 'endpoint-1',
      displayName: 'Demo endpoint',
      transport: 'stdio',
      status: 'disconnected',
      command: 'node'
    })).resolves.toMatchObject({
      endpointId: 'endpoint-1'
    });
  });
});
