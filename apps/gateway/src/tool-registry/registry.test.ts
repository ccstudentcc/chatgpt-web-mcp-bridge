import { describe, expect, it } from 'vitest';
import type { GatewayConfig } from '../config.js';
import { createGatewayToolRegistry } from './registry.js';

describe('tool-registry owner', () => {
  it('materializes catalog metadata and tool descriptors from one owner seam', () => {
    const registry = createGatewayToolRegistry(createConfig());

    expect(registry.materializeCatalog({
      generatedAt: new Date('2026-04-28T00:00:00.000Z')
    })).toEqual({
      catalogVersion: 'phase1.shared-contract-freeze.v1',
      generatedAt: '2026-04-28T00:00:00.000Z',
      workspaceRoot: '/workspace',
      tools: registry.materializeCatalogTools()
    });
  });

  it('keeps enabled-state alignment between the full catalog and enabled-only materialization', () => {
    const registry = createGatewayToolRegistry(createConfig());
    const allTools = registry.materializeCatalogTools();
    const enabledTools = registry.materializeCatalogTools({ includeDisabled: false });

    expect(allTools.find((tool) => tool.name === 'mcp_list')).toMatchObject({
      schemaId: 'builtin.mcp_list.v1',
      source: 'builtin',
      enabled: true
    });
    expect(allTools.find((tool) => tool.name === 'write_file')).toMatchObject({
      enabled: false,
      availability: {
        legacy_auto: 'deny',
        reviewed: 'deny',
        yolo: 'deny'
      }
    });
    expect(enabledTools.every((tool) => tool.enabled)).toBe(true);
    expect(enabledTools.length).toBe(allTools.filter((tool) => tool.enabled).length);
  });
});

function createConfig(overrides: Partial<GatewayConfig> = {}): GatewayConfig {
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
    blockedPaths: [],
    ...overrides
  };
}
