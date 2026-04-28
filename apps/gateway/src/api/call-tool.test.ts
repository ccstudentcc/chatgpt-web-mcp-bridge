import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { TOKEN_HEADER } from '@cwmb/tool-contracts';
import { registerGatewayCallToolRoute } from './call-tool.js';

describe('gateway api /call-tool', () => {
  it('validates and delegates legacy execution to the kernel owner', async () => {
    const executeLegacyToolCall = vi.fn(async () => ({
      ok: true as const,
      tool: 'list_directory',
      result: { entries: [] },
      warnings: [],
      durationMs: 3,
      execute: {
        requestId: 'legacy-call-1',
        executionId: 'legacy-call-1.123',
        decisions: [],
        result: {
          type: 'inline_tool_result' as const,
          callId: 'call-0001',
          tool: 'list_directory',
          ok: true,
          output: { entries: [] },
          summary: 'Listed directory.'
        }
      }
    }));
    const server = Fastify();
    await registerGatewayCallToolRoute(server, {
      auth: {
        expectedToken: 'secret',
        trustedLocalMode: false
      },
      executionKernel: { executeLegacyToolCall }
    });

    const response = await server.inject({
      method: 'POST',
      url: '/call-tool',
      headers: {
        [TOKEN_HEADER]: 'secret'
      },
      payload: {
        tool: 'list_directory',
        args: { path: '.' },
        source: {
          page: 'chatgpt',
          callId: 'call-0001'
        }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(executeLegacyToolCall).toHaveBeenCalledWith({
      tool: 'list_directory',
      args: { path: '.' },
      source: {
        page: 'chatgpt',
        callId: 'call-0001'
      }
    });

    await server.close();
  });

  it('rejects invalid payloads before calling the kernel owner', async () => {
    const executeLegacyToolCall = vi.fn();
    const server = Fastify();
    await registerGatewayCallToolRoute(server, {
      auth: {
        trustedLocalMode: true
      },
      executionKernel: { executeLegacyToolCall }
    });

    const response = await server.inject({
      method: 'POST',
      url: '/call-tool',
      payload: {
        tool: '',
        args: 'bad'
      }
    });

    expect(response.statusCode).toBe(500);
    expect(executeLegacyToolCall).not.toHaveBeenCalled();

    await server.close();
  });
});
