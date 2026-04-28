import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CatalogContract } from '@cwmb/protocol';
import { readStoredToolCatalog, writeStoredToolCatalog } from '../../extension/src/injection-runtime/catalog-cache.js';

const sampleCatalog: CatalogContract = {
  catalogVersion: 'phase1.shared-contract-freeze.v1',
  generatedAt: '2026-04-27T12:00:00.000Z',
  workspaceRoot: '/workspace',
  tools: [
    {
      name: 'mcp_list',
      title: 'MCP List',
      description: 'Return the current gateway catalog.',
      risk: 'low',
      requiresConfirmation: false,
      enabled: true,
      exampleArgs: {},
      displayName: 'MCP List',
      source: 'builtin'
    }
  ]
};

describe('catalog cache', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns an empty catalog when storage is blank or invalid', () => {
    vi.stubGlobal('GM_getValue', vi.fn().mockReturnValue(''));
    expect(readStoredToolCatalog()).toBeNull();

    vi.stubGlobal('GM_getValue', vi.fn().mockReturnValue('not-json'));
    expect(readStoredToolCatalog()).toBeNull();
  });

  it('rehydrates a legacy cached tool array into a catalog contract', () => {
    vi.stubGlobal('GM_getValue', vi.fn().mockReturnValue(JSON.stringify([
      sampleCatalog.tools[0]
    ])));

    expect(readStoredToolCatalog()).toMatchObject({
      catalogVersion: 'legacy-userscript-cache',
      tools: sampleCatalog.tools
    });
  });

  it('writes the latest catalog contract snapshot', () => {
    const setValue = vi.fn();
    vi.stubGlobal('GM_setValue', setValue);

    writeStoredToolCatalog(sampleCatalog);

    expect(setValue).toHaveBeenCalledWith('cwmb_tool_catalog_cache', JSON.stringify(sampleCatalog));
  });
});
