import type { GatewayConfig } from './config.js';
import type { Logger } from './logger.js';
import { createGatewayServer } from './main/index.js';

export async function createServer(config: GatewayConfig, token: string | undefined, logger: Logger) {
  return createGatewayServer({
    config,
    token,
    logger
  });
}
