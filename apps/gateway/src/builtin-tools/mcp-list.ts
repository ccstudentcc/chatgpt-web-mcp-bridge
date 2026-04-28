import { z } from 'zod';
import type { CatalogToolDescriptor } from '@cwmb/tool-contracts';
import type { LocalTool } from '../tools/index.js';
import type { MaterializeCatalogOptions } from '../tool-registry/catalog.js';

const McpListArgsSchema = z.object({
  includeDisabled: z.boolean().default(true)
});

type McpListArgs = z.infer<typeof McpListArgsSchema>;

export interface McpListResult {
  tools: CatalogToolDescriptor[];
  total: number;
  enabled: number;
  disabled: number;
}

interface McpListCatalogSource {
  getCatalogTools(options?: Pick<MaterializeCatalogOptions, 'includeDisabled'>): CatalogToolDescriptor[];
}

export function createMcpListTool(source: McpListCatalogSource): LocalTool<McpListArgs, McpListResult> {
  return {
    name: 'mcp_list',
    title: 'List MCP tools',
    description: 'List the current gateway tools, including enabled state and example arguments.',
    risk: 'low',
    requiresConfirmation: false,
    enabled: true,
    exampleArgs: {},
    argsSchema: McpListArgsSchema,
    async run(args) {
      const tools = source.getCatalogTools({ includeDisabled: args.includeDisabled });

      return {
        tools,
        total: tools.length,
        enabled: tools.filter((tool) => tool.enabled).length,
        disabled: tools.filter((tool) => !tool.enabled).length
      };
    }
  };
}
