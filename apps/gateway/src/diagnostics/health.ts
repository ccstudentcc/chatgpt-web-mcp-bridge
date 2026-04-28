import type { GatewayHealthContract } from '@cwmb/tool-contracts';
import type { GatewayShellInfo } from '@cwmb/shared-utils';
import type { GatewayConfig } from '../config.js';
import { detectShell } from '../shell-runtime/index.js';

export const GATEWAY_VERSION = '0.1.0';

interface CreateGatewayHealthSnapshotOptions {
  version?: string;
  platform?: string;
  detectShellImpl?: () => Promise<GatewayShellInfo>;
}

export async function createGatewayHealthSnapshot(
  config: GatewayConfig,
  options: CreateGatewayHealthSnapshotOptions = {}
): Promise<GatewayHealthContract> {
  const shell = await (options.detectShellImpl ?? detectShell)();

  return {
    ok: true,
    version: options.version ?? GATEWAY_VERSION,
    platform: options.platform ?? process.platform,
    host: config.host,
    port: config.port,
    workspaceRoot: config.workspaceRoot,
    trustedLocalMode: config.trustedLocalMode,
    autoExecuteLowRisk: config.autoExecuteLowRisk,
    autoInsertResult: config.autoInsertResult,
    autoSendResult: config.autoSendResult,
    maxToolRounds: config.maxToolRounds,
    shell
  };
}
