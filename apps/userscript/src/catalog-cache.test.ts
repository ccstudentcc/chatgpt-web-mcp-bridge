import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ToolDescriptor } from '@cwmb/protocol';
import { readStoredToolCatalog, writeStoredToolCatalog } from './catalog-cache.js';

const sampleTools: ToolDescriptor[] = [
  {
    name: 'mcp_list',
    title: 'MCP List',
    description: 'Return the current gateway catalog.',
    risk: 'low',
    requiresConfirmation: false,
    enabled: true,
    exampleArgs: {}
  }
];

describe('catalog cache', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns an empty catalog when storage is blank or invalid', () => {
    vi.stubGlobal('GM_getValue', vi.fn().mockReturnValue(''));
    expect(readStoredToolCatalog()).toEqual([]);

    vi.stubGlobal('GM_getValue', vi.fn().mockReturnValue('not-json'));
    expect(readStoredToolCatalog()).toEqual([]);
  });

  it('filters out malformed cached entries', () => {
    vi.stubGlobal('GM_getValue', vi.fn().mockReturnValue(JSON.stringify([
      sampleTools[0],
      { name: 'broken' }
    ])));

    expect(readStoredToolCatalog()).toEqual(sampleTools);
  });

  it('writes the latest tool catalog snapshot', () => {
    const setValue = vi.fn();
    vi.stubGlobal('GM_setValue', setValue);

    writeStoredToolCatalog(sampleTools);

    expect(setValue).toHaveBeenCalledWith('cwmb_tool_catalog_cache', JSON.stringify(sampleTools));
  });
});
