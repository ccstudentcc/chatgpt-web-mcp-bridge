import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import type { GatewayConfig } from '../config.js';
import type { Logger } from '../logger.js';
import { registerCallToolRoute } from './call-tool.js';

describe('/call-tool route', () => {
  it('preserves the legacy success payload while adding execute-response metadata', async () => {
    const server = Fastify();
    await registerCallToolRoute(server, createConfig(), undefined, createLogger());

    const response = await server.inject({
      method: 'POST',
      url: '/call-tool',
      payload: {
        tool: 'list_directory',
        args: { path: '.', maxDepth: 1 },
        source: {
          page: 'chatgpt',
          conversationId: 'conv-1',
          callId: 'call-0001'
        }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      tool: 'list_directory',
      requestId: 'legacy-call-0001',
      executionId: expect.stringContaining('legacy-call-0001.'),
      decisions: [
        expect.objectContaining({
          callId: 'call-0001',
          action: 'execute'
        })
      ],
      result: {
        type: 'inline_tool_result',
        tool: 'list_directory'
      }
    });

    await server.close();
  });

  it('surfaces explicit deny metadata when the current gateway blocks a disabled tool', async () => {
    const server = Fastify();
    await registerCallToolRoute(server, createConfig(), undefined, createLogger());

    const response = await server.inject({
      method: 'POST',
      url: '/call-tool',
      payload: {
        tool: 'write_file',
        args: { path: 'docs/example.md', content: 'hello', mode: 'replace' },
        source: {
          page: 'chatgpt',
          conversationId: 'conv-1',
          callId: 'call-0002'
        }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: false,
      tool: 'write_file',
      error: {
        code: 'TOOL_DISABLED'
      },
      requestId: 'legacy-call-0002',
      decisions: [
        expect.objectContaining({
          callId: 'call-0002',
          action: 'deny',
          reasonCode: 'TOOL_DISABLED'
        })
      ],
      result: {
        type: 'execution_error',
        error: {
          code: 'TOOL_DISABLED',
          retryable: false
        }
      }
    });

    await server.close();
  });
});

function createConfig(): GatewayConfig {
  return {
    host: '127.0.0.1',
    port: 8024,
    workspaceRoot: '/home/chenpeng/coding/repo/chatgpt-web-mcp-bridge',
    shell: 'pwsh',
    trustedLocalMode: true,
    allowPwsh: false,
    allowWrite: false,
    autoExecuteLowRisk: true,
    autoInsertResult: true,
    autoSendResult: true,
    maxToolRounds: 3,
    maxFileSizeBytes: 1_048_576,
    maxInsertedChars: 60_000,
    maxGatewayResultChars: 200_000,
    logRetentionDays: 14,
    blockedPaths: []
  };
}

function createLogger(): Logger {
  return {
    write: vi.fn(async () => undefined)
  };
}
