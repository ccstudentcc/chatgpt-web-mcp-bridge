import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import type { GatewayConfig } from '../config.js';
import { registerToolsRoute } from './tools.js';

describe('/tools route', () => {
  it('returns catalog metadata and materialized tool descriptors', async () => {
    const server = Fastify();
    await registerToolsRoute(server, createConfig());

    const response = await server.inject({
      method: 'GET',
      url: '/tools'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      catalogVersion: 'phase1.shared-contract-freeze.v1',
      workspaceRoot: '/workspace',
      generatedAt: expect.any(String),
      tools: expect.arrayContaining([
        expect.objectContaining({
          name: 'mcp_list',
          displayName: 'List MCP tools',
          source: 'builtin',
          schemaId: 'builtin.mcp_list.v1',
          availability: {
            legacy_auto: 'execute',
            reviewed: 'execute',
            yolo: 'execute'
          }
        })
      ])
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
