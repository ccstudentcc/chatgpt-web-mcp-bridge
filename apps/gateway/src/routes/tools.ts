import type { FastifyInstance } from 'fastify';
import type { ToolDescriptor } from '@cwmb/protocol';
import { assertAuthorized } from '../security/token.js';
import { createToolRegistry } from '../tools/index.js';
import { toToolDescriptor } from '../tools/mcp-list.js';
import type { GatewayConfig } from '../config.js';

export async function registerToolsRoute(server: FastifyInstance, config: GatewayConfig, token?: string): Promise<void> {
  server.get('/tools', async (request) => {
    assertAuthorized(request.headers, { expectedToken: token, trustedLocalMode: config.trustedLocalMode });
    const tools: ToolDescriptor[] = [...createToolRegistry(config).values()].map(toToolDescriptor);
    return { tools };
  });
}
