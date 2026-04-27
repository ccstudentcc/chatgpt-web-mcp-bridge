import { z } from 'zod';
import type { CatalogToolDescriptor } from '@cwmb/protocol';
import type { LocalTool } from './index.js';

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

export function createMcpListTool(getTools: () => LocalTool[]): LocalTool<McpListArgs, McpListResult> {
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
      const tools = getTools()
        .filter((tool) => args.includeDisabled || tool.enabled)
        .map(toToolDescriptor);

      return {
        tools,
        total: tools.length,
        enabled: tools.filter((tool) => tool.enabled).length,
        disabled: tools.filter((tool) => !tool.enabled).length
      };
    }
  };
}

export function toToolDescriptor(tool: Pick<LocalTool, 'name' | 'title' | 'description' | 'risk' | 'requiresConfirmation' | 'enabled' | 'exampleArgs'>): CatalogToolDescriptor {
  return {
    name: tool.name,
    title: tool.title,
    displayName: tool.title,
    description: tool.description,
    source: 'builtin',
    risk: tool.risk,
    requiresConfirmation: tool.requiresConfirmation,
    enabled: tool.enabled,
    schemaId: `builtin.${tool.name}.v1`,
    availability: tool.enabled
      ? {
          legacy_auto: tool.requiresConfirmation ? 'confirmation_required' : 'execute',
          reviewed: tool.requiresConfirmation ? 'confirmation_required' : 'execute',
          yolo: 'execute'
        }
      : {
          legacy_auto: 'deny',
          reviewed: 'deny',
          yolo: 'deny'
        },
    exampleArgs: tool.exampleArgs
  };
}
