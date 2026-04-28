import type { GatewayHealthContract } from '@cwmb/tool-contracts';
import type { FastifyInstance } from 'fastify';

export interface GatewayHealthRouteDeps {
  createHealthSnapshot: () => Promise<GatewayHealthContract>;
}

export async function registerGatewayHealthRoute(
  server: FastifyInstance,
  deps: GatewayHealthRouteDeps
): Promise<void> {
  server.get('/health', async () => deps.createHealthSnapshot());
}
