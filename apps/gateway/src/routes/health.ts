import type { FastifyInstance } from 'fastify';
import type { GatewayConfig } from '../config.js';
import { createGatewayHealthSnapshot } from '../diagnostics/index.js';
import { registerGatewayHealthRoute } from '../api/health.js';

export async function registerHealthRoute(server: FastifyInstance, config: GatewayConfig): Promise<void> {
  await registerGatewayHealthRoute(server, {
    createHealthSnapshot: () => createGatewayHealthSnapshot(config)
  });
}
