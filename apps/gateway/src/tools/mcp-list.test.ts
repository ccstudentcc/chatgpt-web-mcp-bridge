import type { McpListResult } from './mcp-list.js';
import { describe, expect, it } from 'vitest';
import type { GatewayConfig } from '../config.js';
import { createGatewayToolRegistry } from '../tool-registry/index.js';

describe('mcp_list tool', () => {
  it('returns the same materialized descriptors as the live catalog owner', async () => {
    const registry = createGatewayToolRegistry(createConfig());
    const tool = registry.tools.get('mcp_list');

    expect(tool).toBeDefined();
    const result = await tool!.run({ includeDisabled: true }, { config: createConfig(), logger: createLogger() }) as McpListResult;
    const liveCatalog = registry.materializeCatalog({ generatedAt: new Date('2026-04-28T00:00:00.000Z') });

    expect(result.tools).toEqual(liveCatalog.tools);
    expect(result.tools.find((item) => item.name === 'read_file')?.exampleArgs).toEqual({ path: 'README.md' });
    expect(result.total).toBe(8);
    expect(result.enabled).toBe(5);
    expect(result.disabled).toBe(3);
  });

  it('can omit disabled descriptors without changing enabled-state counts', async () => {
    const registry = createGatewayToolRegistry(createConfig());
    const tool = registry.tools.get('mcp_list');

    const result = await tool!.run({ includeDisabled: false }, { config: createConfig(), logger: createLogger() }) as McpListResult;

    expect(result.tools.every((item) => item.enabled)).toBe(true);
    expect(result.tools.some((item) => item.name === 'write_file')).toBe(false);
    expect(result.total).toBe(5);
    expect(result.enabled).toBe(5);
    expect(result.disabled).toBe(0);
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

function createLogger() {
  return {
    async write() {}
  };
}
