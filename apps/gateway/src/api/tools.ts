import type { CatalogContract } from '@cwmb/tool-contracts';
import type { FastifyInstance } from 'fastify';
import { assertAuthorized } from './auth.js';

export interface GatewayRouteAuthContext {
  expectedToken?: string;
  trustedLocalMode: boolean;
}

export interface GatewayToolCatalogOwner {
  materializeCatalog: () => CatalogContract;
}

export interface GatewayToolsRouteDeps {
  auth: GatewayRouteAuthContext;
  toolRegistry: GatewayToolCatalogOwner;
}

export async function registerGatewayToolsRoute(
  server: FastifyInstance,
  deps: GatewayToolsRouteDeps
): Promise<void> {
  server.get('/tools', async (request) => {
    assertAuthorized(request.headers, deps.auth);
    return deps.toolRegistry.materializeCatalog();
  });
}
