import Fastify from 'fastify';
import type { GatewayHealthContract } from '@cwmb/tool-contracts';
import { describe, expect, it, vi } from 'vitest';
import { registerGatewayHealthRoute } from './health.js';

describe('gateway api /health', () => {
  it('delegates health shaping to diagnostics owner', async () => {
    const createHealthSnapshot = vi.fn(async (): Promise<GatewayHealthContract> => ({
      ok: true as const,
      version: '0.1.0-test',
      platform: 'linux',
      host: '127.0.0.1',
      port: 8024,
      workspaceRoot: '/workspace',
      trustedLocalMode: true,
      autoExecuteLowRisk: true,
      autoInsertResult: true,
      autoSendResult: true,
      maxToolRounds: 3,
      shell: {
        preferred: 'pwsh',
        resolved: 'pwsh',
        available: true
      }
    }));
    const server = Fastify();
    await registerGatewayHealthRoute(server, { createHealthSnapshot });

    const response = await server.inject({
      method: 'GET',
      url: '/health'
    });

    expect(response.statusCode).toBe(200);
    expect(createHealthSnapshot).toHaveBeenCalledTimes(1);
    expect(response.json()).toMatchObject({
      ok: true,
      workspaceRoot: '/workspace'
    });

    await server.close();
  });
});
