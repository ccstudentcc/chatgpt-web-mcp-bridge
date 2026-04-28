import { GatewayHealthContractSchema } from '@cwmb/protocol';
import { describe, expect, it } from 'vitest';
import type { GatewayConfig } from '../config.js';
import { createGatewayHealthSnapshot } from './health.js';

describe('diagnostics health snapshot', () => {
  it('shapes the live /health contract from gateway config and shell facts', async () => {
    const health = await createGatewayHealthSnapshot(createConfig(), {
      platform: 'linux',
      detectShellImpl: async () => ({
        preferred: 'pwsh',
        resolved: 'pwsh',
        available: true,
        version: '7.5.0'
      })
    });

    expect(GatewayHealthContractSchema.parse(health)).toMatchObject({
      ok: true,
      host: '127.0.0.1',
      port: 8024,
      workspaceRoot: '/workspace',
      trustedLocalMode: false,
      autoExecuteLowRisk: true,
      autoInsertResult: true,
      autoSendResult: false,
      maxToolRounds: 3,
      shell: {
        preferred: 'pwsh',
        resolved: 'pwsh',
        available: true
      }
    });
  });
});

function createConfig(): GatewayConfig {
  return {
    host: '127.0.0.1',
    port: 8024,
    workspaceRoot: '/workspace',
    shell: 'powershell.exe',
    trustedLocalMode: false,
    allowPwsh: true,
    allowWrite: false,
    autoExecuteLowRisk: true,
    autoInsertResult: true,
    autoSendResult: false,
    maxToolRounds: 3,
    maxFileSizeBytes: 1_048_576,
    maxInsertedChars: 60_000,
    maxGatewayResultChars: 200_000,
    logRetentionDays: 14,
    blockedPaths: ['.env']
  };
}
