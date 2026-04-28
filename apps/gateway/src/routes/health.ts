import type { FastifyInstance } from 'fastify';
import type { GatewayConfig } from '../config.js';
import { createGatewayHealthSnapshot } from '../diagnostics/index.js';

export async function registerHealthRoute(server: FastifyInstance, config: GatewayConfig): Promise<void> {
  server.get('/health', async () => {
    return createGatewayHealthSnapshot(config);
  });
}
