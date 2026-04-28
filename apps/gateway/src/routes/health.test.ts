import Fastify from 'fastify';
import { GatewayHealthContractSchema } from '@cwmb/protocol';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GatewayConfig } from '../config.js';
import { registerHealthRoute } from './health.js';

vi.mock('../shell-runtime/index.js', () => ({
  detectShell: vi.fn(async () => ({
    preferred: 'pwsh',
    resolved: 'pwsh',
    available: true,
    version: '7.5.0'
  }))
}));

describe('/health route', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns automation defaults and maxToolRounds', async () => {
    const server = Fastify();
    await registerHealthRoute(server, createConfig());

    const response = await server.inject({
      method: 'GET',
      url: '/health'
    });

    expect(response.statusCode).toBe(200);
    expect(GatewayHealthContractSchema.parse(response.json())).toMatchObject({
      ok: true,
      autoExecuteLowRisk: true,
      autoInsertResult: true,
      autoSendResult: true,
      maxToolRounds: 3,
      shell: {
        preferred: 'pwsh',
        resolved: 'pwsh',
        available: true,
        version: '7.5.0'
      }
    });

    await server.close();
  });
});

function createConfig(): GatewayConfig {
  return {
    host: '127.0.0.1',
    port: 8024,
    workspaceRoot: '/workspace',
    shell: 'pwsh',
    trustedLocalMode: true,
    allowPwsh: false,
    allowWrite: false,
    autoExecuteLowRisk: true,
    autoInsertResult: true,
    autoSendResult: true,
    maxToolRounds: 3,
    maxFileSizeBytes: 1_048_576,
    maxInsertedChars: 60_000,
    maxGatewayResultChars: 200_000,
    logRetentionDays: 14,
    blockedPaths: []
  };
}
