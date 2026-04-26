import Fastify from 'fastify';
import type { GatewayConfig } from './config.js';
import type { Logger } from './logger.js';
import { registerHealthRoute } from './routes/health.js';
import { registerToolsRoute } from './routes/tools.js';
import { registerCallToolRoute } from './routes/call-tool.js';

export async function createServer(config: GatewayConfig, token: string, logger: Logger) {
  const server = Fastify({ logger: false });

  server.addHook('onRequest', async (request) => {
    const origin = request.headers.origin;
    if (origin && origin !== 'https://chatgpt.com' && origin !== 'https://chat.openai.com') {
      throw Object.assign(new Error('Origin is not allowed.'), { code: 'ORIGIN_NOT_ALLOWED' });
    }
  });

  await registerHealthRoute(server, config);
  await registerToolsRoute(server, config, token);
  await registerCallToolRoute(server, config, token, logger);
  return server;
}
