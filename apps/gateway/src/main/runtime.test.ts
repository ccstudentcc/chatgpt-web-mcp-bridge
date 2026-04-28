import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GatewayConfig } from '../config.js';
import type { Logger } from '../logger.js';
import { createGatewayRuntime } from './runtime.js';

describe('gateway main runtime', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts a server with all Stage 20 owners wired through the main composition root', async () => {
    const runtime = await createGatewayRuntime({
      config: createConfig(),
      logger: createLogger(),
      createHealthSnapshot: async () => ({
        ok: true,
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
      })
    });

    const address = await runtime.server.listen({
      host: '127.0.0.1',
      port: 0
    });

    expect(address).toContain('127.0.0.1');
    expect(await runtime.owners.proposalEngine.listProposals()).toEqual([]);
    expect(await runtime.owners.externalMcpRegistry.listServers()).toEqual([]);

    await runtime.owners.resultCache.set({ scope: 'execution', id: 'runtime-test' }, {
      type: 'inline_tool_result',
      callId: 'call-1',
      tool: 'list_directory',
      ok: true,
      output: { entries: [] },
      summary: 'Listed directory.'
    });
    expect(await runtime.owners.resultCache.get({ scope: 'execution', id: 'runtime-test' })).toMatchObject({
      cacheId: 'execution:runtime-test'
    });

    const health = await runtime.server.inject({
      method: 'GET',
      url: '/health'
    });
    const tools = await runtime.server.inject({
      method: 'GET',
      url: '/tools'
    });

    expect(health.statusCode).toBe(200);
    expect(tools.statusCode).toBe(200);
    expect(tools.json()).toMatchObject({
      workspaceRoot: '/workspace',
      tools: expect.any(Array)
    });

    await runtime.server.close();
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

function createLogger(): Logger {
  return {
    write: vi.fn(async () => undefined)
  };
}
