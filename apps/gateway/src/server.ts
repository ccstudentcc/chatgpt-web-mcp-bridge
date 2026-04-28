import Fastify from 'fastify';
import type { GatewayConfig } from './config.js';
import type { Logger } from './logger.js';
import { registerHealthRoute } from './routes/health.js';
import { registerToolsRoute } from './routes/tools.js';
import { registerCallToolRoute } from './routes/call-tool.js';
import { assertAllowedOrigin } from './security/origin.js';

export async function createServer(config: GatewayConfig, token: string | undefined, logger: Logger) {
  const server = Fastify({ logger: false });

  server.addHook('onRequest', async (request) => {
    assertAllowedOrigin(request.headers);
  });

  await registerHealthRoute(server, config);
  await registerToolsRoute(server, config, token);
  await registerCallToolRoute(server, config, token, logger);
  return server;
}
