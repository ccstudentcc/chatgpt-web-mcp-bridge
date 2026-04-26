import type { McpListResult } from './mcp-list.js';
import { describe, expect, it } from 'vitest';
import type { GatewayConfig } from '../config.js';
import { createToolRegistry } from './index.js';

describe('mcp_list tool', () => {
  it('returns current tools with example arguments', async () => {
    const registry = createToolRegistry(createConfig());
    const tool = registry.get('mcp_list');

    expect(tool).toBeDefined();
    const result = await tool!.run({ includeDisabled: true }, { config: createConfig(), logger: createLogger() }) as McpListResult;

    expect(result.tools.some((item) => item.name === 'mcp_list')).toBe(true);
    expect(result.tools.some((item) => item.name === 'read_file')).toBe(true);
    expect(result.tools.some((item) => item.name === 'run_pwsh')).toBe(true);
    expect(result.tools.find((item) => item.name === 'read_file')?.exampleArgs).toEqual({ path: 'README.md' });
    expect(result.total).toBe(7);
    expect(result.enabled).toBe(5);
    expect(result.disabled).toBe(2);
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
