import type { FastifyInstance } from 'fastify';
import type { GatewayHealthContract } from '@cwmb/protocol';
import { detectShell } from '../shell-runtime/index.js';
import type { GatewayConfig } from '../config.js';

export async function registerHealthRoute(server: FastifyInstance, config: GatewayConfig): Promise<void> {
  server.get('/health', async () => {
    const response: GatewayHealthContract = {
      ok: true,
      version: '0.1.0',
      platform: process.platform,
      host: config.host,
      port: config.port,
      workspaceRoot: config.workspaceRoot,
      trustedLocalMode: config.trustedLocalMode,
      autoExecuteLowRisk: config.autoExecuteLowRisk,
      autoInsertResult: config.autoInsertResult,
      autoSendResult: config.autoSendResult,
      maxToolRounds: config.maxToolRounds,
      shell: await detectShell()
    };

    return response;
  });
}
