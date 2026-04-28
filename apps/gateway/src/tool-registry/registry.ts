import type { CatalogContract, CatalogToolDescriptor, ToolSource } from '@cwmb/protocol';
import type { GatewayConfig } from '../config.js';
import { createBuiltinTools } from '../builtin-tools/index.js';
import type { LocalTool } from '../tools/index.js';
import { runPwshTool } from '../tools/run-pwsh.js';
import { materializeCatalog, materializeCatalogTools, type MaterializeCatalogOptions, type ToolRegistryEntry } from './catalog.js';

export interface GatewayToolRegistry {
  entries: ToolRegistryEntry[];
  tools: Map<string, LocalTool>;
  materializeCatalog(options?: MaterializeCatalogOptions): CatalogContract;
  materializeCatalogTools(options?: Pick<MaterializeCatalogOptions, 'includeDisabled'>): CatalogToolDescriptor[];
}

export function createGatewayToolRegistry(config: GatewayConfig): GatewayToolRegistry {
  let entries: ToolRegistryEntry[] = [];
  const builtinTools = createBuiltinTools(config, {
    getCatalogTools: (options) => materializeCatalogTools(entries, options)
  });
  const baseEntries = createBuiltinEntries([...builtinTools, { ...runPwshTool, enabled: config.allowPwsh }]);

  entries = baseEntries;
  const tools = new Map(entries.map((entry) => [entry.name, entry.tool]));

  return {
    entries,
    tools,
    materializeCatalog: (options) => materializeCatalog(entries, config, options),
    materializeCatalogTools: (options) => materializeCatalogTools(entries, options)
  };
}

function createBuiltinEntries(tools: LocalTool[]): ToolRegistryEntry[] {
  return tools.map((tool) => createRegistryEntry('builtin', tool));
}

function createRegistryEntry(source: ToolSource, tool: LocalTool): ToolRegistryEntry {
  return {
    name: tool.name,
    source,
    schemaId: `${source}.${tool.name}.v1`,
    tool
  };
}
