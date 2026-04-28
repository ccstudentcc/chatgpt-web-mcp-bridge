import type { CatalogToolDescriptor } from '@cwmb/protocol';
import type { GatewayConfig } from '../config.js';
import type { LocalTool } from '../tools/index.js';
import { grepFilesTool } from './grep-files.js';
import { listDirectoryTool } from './list-directory.js';
import { createMcpListTool } from './mcp-list.js';
import { readFileTool } from './read-file.js';
import { searchFilesTool } from './search-files.js';
import { writeFileProposalTool } from './write-file-proposal.js';
import { writeFileTool } from './write-file.js';

interface BuiltinToolCatalogSource {
  getCatalogTools(options?: { includeDisabled?: boolean }): CatalogToolDescriptor[];
}

export function createBuiltinTools(
  config: GatewayConfig,
  source: BuiltinToolCatalogSource
): LocalTool[] {
  return [
    createMcpListTool(source),
    readFileTool,
    listDirectoryTool,
    searchFilesTool,
    grepFilesTool,
    { ...writeFileTool, enabled: config.allowWrite },
    writeFileProposalTool
  ];
}
