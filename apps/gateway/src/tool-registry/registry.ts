import type { CatalogContract, CatalogToolDescriptor, ToolSource } from '@cwmb/protocol';
import type { GatewayConfig } from '../config.js';
import type { LocalTool } from '../tools/index.js';
import { listDirectoryTool } from '../tools/list-directory.js';
import { createMcpListTool } from '../tools/mcp-list.js';
import { grepFilesTool } from '../tools/grep-files.js';
import { readFileTool } from '../tools/read-file.js';
import { runPwshTool } from '../tools/run-pwsh.js';
import { searchFilesTool } from '../tools/search-files.js';
import { writeFileProposalTool } from '../tools/write-file-proposal.js';
import { writeFileTool } from '../tools/write-file.js';
import { materializeCatalog, materializeCatalogTools, type MaterializeCatalogOptions, type ToolRegistryEntry } from './catalog.js';

export interface GatewayToolRegistry {
  entries: ToolRegistryEntry[];
  tools: Map<string, LocalTool>;
  materializeCatalog(options?: MaterializeCatalogOptions): CatalogContract;
  materializeCatalogTools(options?: Pick<MaterializeCatalogOptions, 'includeDisabled'>): CatalogToolDescriptor[];
}

export function createGatewayToolRegistry(config: GatewayConfig): GatewayToolRegistry {
  const baseEntries = createBuiltinEntries(config);
  let entries: ToolRegistryEntry[] = [];
  const mcpListTool = createMcpListTool({
    getCatalogTools: (options) => materializeCatalogTools(entries, options)
  });

  entries = [createRegistryEntry('builtin', mcpListTool), ...baseEntries];
  const tools = new Map(entries.map((entry) => [entry.name, entry.tool]));

  return {
    entries,
    tools,
    materializeCatalog: (options) => materializeCatalog(entries, config, options),
    materializeCatalogTools: (options) => materializeCatalogTools(entries, options)
  };
}

function createBuiltinEntries(config: GatewayConfig): ToolRegistryEntry[] {
  const builtinTools: LocalTool[] = [
    readFileTool,
    listDirectoryTool,
    searchFilesTool,
    grepFilesTool,
    { ...writeFileTool, enabled: config.allowWrite },
    writeFileProposalTool,
    { ...runPwshTool, enabled: config.allowPwsh }
  ];

  return builtinTools.map((tool) => createRegistryEntry('builtin', tool));
}

function createRegistryEntry(source: ToolSource, tool: LocalTool): ToolRegistryEntry {
  return {
    name: tool.name,
    source,
    schemaId: `${source}.${tool.name}.v1`,
    tool
  };
}
