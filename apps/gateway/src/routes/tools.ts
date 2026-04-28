import type { FastifyInstance } from 'fastify';
import { assertAuthorized } from '../security/token.js';
import type { GatewayConfig } from '../config.js';
import { createGatewayToolRegistry } from '../tool-registry/index.js';

export async function registerToolsRoute(server: FastifyInstance, config: GatewayConfig, token?: string): Promise<void> {
  const registry = createGatewayToolRegistry(config);

  server.get('/tools', async (request) => {
    assertAuthorized(request.headers, { expectedToken: token, trustedLocalMode: config.trustedLocalMode });
    return registry.materializeCatalog();
  });
}
