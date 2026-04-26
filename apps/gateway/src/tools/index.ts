import type { ZodType, ZodTypeDef } from 'zod';
import type { RiskLevel, ToolDescriptor } from '@cwmb/protocol';
import type { GatewayConfig } from '../config.js';
import type { Logger } from '../logger.js';
import { readFileTool } from './read-file.js';
import { listDirectoryTool } from './list-directory.js';
import { searchFilesTool } from './search-files.js';
import { grepFilesTool } from './grep-files.js';
import { createMcpListTool } from './mcp-list.js';
import { writeFileTool } from './write-file.js';
import { writeFileProposalTool } from './write-file-proposal.js';
import { runPwshTool } from './run-pwsh.js';

export interface ToolContext {
  config: GatewayConfig;
  logger: Logger;
}

export interface LocalTool<TArgs = unknown, TResult = unknown> extends ToolDescriptor {
  risk: RiskLevel;
  exampleArgs: Record<string, unknown>;
  argsSchema: ZodType<TArgs, ZodTypeDef, unknown>;
  run(args: TArgs, ctx: ToolContext): Promise<TResult>;
}

export function createToolRegistry(config: GatewayConfig): Map<string, LocalTool> {
  const baseTools: LocalTool[] = [
    readFileTool,
    listDirectoryTool,
    searchFilesTool,
    grepFilesTool,
    { ...writeFileTool, enabled: config.allowWrite },
    writeFileProposalTool,
    { ...runPwshTool, enabled: config.allowPwsh }
  ];
  let tools: LocalTool[] = [];
  const mcpListTool = createMcpListTool(() => tools);
  tools = [mcpListTool, ...baseTools];

  return new Map(tools.map((tool) => [tool.name, tool]));
}
