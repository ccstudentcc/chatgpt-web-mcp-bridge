import type { FastifyInstance } from 'fastify';
import type { GatewayConfig } from '../config.js';
import { createExecutionKernel } from '../execution-kernel/index.js';
import type { Logger } from '../logger.js';
import { createGatewayToolRegistry } from '../tool-registry/index.js';
import { registerGatewayCallToolRoute } from '../api/call-tool.js';

export async function registerCallToolRoute(server: FastifyInstance, config: GatewayConfig, token: string | undefined, logger: Logger): Promise<void> {
  const registry = createGatewayToolRegistry(config);
  const executionKernel = createExecutionKernel({ config, logger, registry: registry.tools });

  await registerGatewayCallToolRoute(server, {
    auth: {
      expectedToken: token,
      trustedLocalMode: config.trustedLocalMode
    },
    executionKernel
  });
}
