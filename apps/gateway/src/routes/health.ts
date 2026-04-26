import type { FastifyInstance } from 'fastify';
import { detectShell } from '../shell/detect-shell.js';
import type { GatewayConfig } from '../config.js';

export async function registerHealthRoute(server: FastifyInstance, config: GatewayConfig): Promise<void> {
  server.get('/health', async () => ({
    ok: true,
    version: '0.1.0',
    platform: process.platform,
    host: config.host,
    port: config.port,
    workspaceRoot: config.workspaceRoot,
    autoExecuteLowRisk: config.autoExecuteLowRisk,
    autoInsertResult: config.autoInsertResult,
    autoSendResult: config.autoSendResult,
    shell: await detectShell()
  }));
}
