import type { FastifyInstance } from 'fastify';
import type { GatewayConfig } from '../config.js';
import { createGatewayToolRegistry } from '../tool-registry/index.js';
import { registerGatewayToolsRoute } from '../api/tools.js';

export async function registerToolsRoute(server: FastifyInstance, config: GatewayConfig, token?: string): Promise<void> {
  const registry = createGatewayToolRegistry(config);

  await registerGatewayToolsRoute(server, {
    auth: {
      expectedToken: token,
      trustedLocalMode: config.trustedLocalMode
    },
    toolRegistry: registry
  });
}
