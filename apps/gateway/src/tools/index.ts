import type { ZodType, ZodTypeDef } from 'zod';
import type { RiskLevel } from '@cwmb/shared-utils';
import type { ToolDescriptor } from '@cwmb/tool-contracts';
import type { GatewayConfig } from '../config.js';
import type { Logger } from '../logger.js';
import { createGatewayToolRegistry } from '../tool-registry/index.js';

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
  return createGatewayToolRegistry(config).tools;
}
