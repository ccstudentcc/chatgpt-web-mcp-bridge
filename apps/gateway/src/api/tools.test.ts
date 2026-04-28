import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { TOKEN_HEADER } from '@cwmb/tool-contracts';
import { registerGatewayToolsRoute } from './tools.js';

describe('gateway api /tools', () => {
  it('delegates catalog materialization to registry owner after auth', async () => {
    const materializeCatalog = vi.fn(() => ({
      catalogVersion: 'stage20.test',
      generatedAt: '2026-04-28T00:00:00.000Z',
      workspaceRoot: '/workspace',
      tools: []
    }));
    const server = Fastify();
    await registerGatewayToolsRoute(server, {
      auth: {
        expectedToken: 'secret',
        trustedLocalMode: false
      },
      toolRegistry: { materializeCatalog }
    });

    const response = await server.inject({
      method: 'GET',
      url: '/tools',
      headers: {
        [TOKEN_HEADER]: 'secret'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(materializeCatalog).toHaveBeenCalledTimes(1);

    await server.close();
  });

  it('rejects unauthorized requests before calling the registry owner', async () => {
    const materializeCatalog = vi.fn(() => ({
      catalogVersion: 'stage20.test',
      generatedAt: '2026-04-28T00:00:00.000Z',
      tools: []
    }));
    const server = Fastify();
    await registerGatewayToolsRoute(server, {
      auth: {
        expectedToken: 'secret',
        trustedLocalMode: false
      },
      toolRegistry: { materializeCatalog }
    });

    const response = await server.inject({
      method: 'GET',
      url: '/tools'
    });

    expect(response.statusCode).toBe(500);
    expect(materializeCatalog).not.toHaveBeenCalled();

    await server.close();
  });
});
