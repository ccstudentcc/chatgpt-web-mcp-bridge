import { describe, expect, it } from 'vitest';
import type { GatewayHealthContract } from '@cwmb/tool-contracts';
import type { AuditLogEntry } from '../audit-log/index.js';
import type { GatewayConfig } from '../config.js';
import { createGatewayDiagnosticsBundle } from './bundle.js';

describe('diagnostics bundle', () => {
  it('aggregates runtime facts and redacted audit truth without exposing execution payloads', async () => {
    const bundle = await createGatewayDiagnosticsBundle(createConfig(), {
      generatedAt: '2026-04-28T12:00:00.000Z',
      health: createHealth(),
      appHomeOverride: '/tmp/cwmb-home',
      readAuditEntriesImpl: async () => createAuditEntries()
    });

    expect(bundle).toMatchObject({
      generatedAt: '2026-04-28T12:00:00.000Z',
      redacted: true,
      health: {
        workspaceRoot: '/workspace',
        trustedLocalMode: true
      },
      runtime: {
        authMode: 'trusted_local',
        configuredShell: 'pwsh',
        allowPwsh: false,
        allowWrite: false,
        blockedPathCount: 2,
        logRetentionDays: 14,
        configPath: '/tmp/cwmb-home/config.json',
        logsDir: '/tmp/cwmb-home/logs'
      },
      audit: {
        redacted: true,
        totalEntries: 2,
        warningEventCount: 1,
        categories: {
          execution: 1,
          policy: 0,
          lifecycle: 1
        },
        events: {
          callCompleted: 1,
          callFailed: 0,
          callDenied: 0,
          executionFinished: 1
        },
        latestEventAt: '2026-04-28T12:00:01.000Z',
        latestLifecycle: {
          totalCalls: 1,
          completedCalls: 1,
          failedCalls: 0,
          deniedCalls: 0,
          skippedCalls: 0,
          continueOnFailure: false,
          stoppedOnFailure: false,
          warningCount: 1
        }
      }
    });

    const json = JSON.stringify(bundle);
    expect(json).not.toContain('hunter2');
    expect(json).not.toContain('password=');
  });
});

function createConfig(): GatewayConfig {
  return {
    host: '127.0.0.1',
    port: 8024,
    workspaceRoot: '/workspace',
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
    blockedPaths: ['.env', '.git/config']
  };
}

function createHealth(): GatewayHealthContract {
  return {
    ok: true,
    version: '0.1.0',
    platform: 'linux',
    host: '127.0.0.1',
    port: 8024,
    workspaceRoot: '/workspace',
    trustedLocalMode: true,
    autoExecuteLowRisk: true,
    autoInsertResult: true,
    autoSendResult: true,
    maxToolRounds: 3,
    shell: {
      preferred: 'pwsh',
      resolved: 'pwsh',
      available: true,
      version: '7.5.0'
    }
  };
}

function createAuditEntries(): AuditLogEntry[] {
  return [
    {
      ts: '2026-04-28T12:00:00.000Z',
      category: 'execution',
      event: 'call_completed',
      request: {
        requestId: 'req-1',
        executionId: 'exec-1',
        operatorIntent: 'auto_flow',
        detectionSource: 'assistant_message_scan',
        executionProfile: 'legacy_auto',
        requestInjection: {
          channel: 'hidden_request_prompt',
          promptVersion: 'bridge-v1'
        },
        source: {
          page: 'chatgpt',
          conversationId: 'conv-1',
          assistantTurnId: 'assistant-1'
        }
      },
      call: {
        index: 0,
        callId: 'call-1',
        tool: 'read_file',
        risk: 'low'
      },
      decision: {
        action: 'execute',
        reasonCode: 'ALLOWED_CURRENT_TOOL',
        risk: 'low'
      },
      argsSummary: {
        type: 'object',
        keys: ['path'],
        entries: {
          path: {
            type: 'string',
            chars: 12,
            value: 'README.md'
          }
        }
      },
      outcome: {
        status: 'completed',
        durationMs: 3,
        warnings: [],
        warningCount: 0,
        resultSummary: {
          type: 'object',
          keys: ['text'],
          entries: {
            text: {
              type: 'string',
              chars: 16,
              redacted: true
            }
          }
        }
      }
    },
    {
      ts: '2026-04-28T12:00:01.000Z',
      category: 'lifecycle',
      event: 'execution_finished',
      request: {
        requestId: 'req-1',
        executionId: 'exec-1',
        operatorIntent: 'auto_flow',
        detectionSource: 'assistant_message_scan',
        executionProfile: 'legacy_auto',
        requestInjection: {
          channel: 'hidden_request_prompt',
          promptVersion: 'bridge-v1'
        },
        source: {
          page: 'chatgpt',
          conversationId: 'conv-1',
          assistantTurnId: 'assistant-1'
        }
      },
      summary: {
        totalCalls: 1,
        completedCalls: 1,
        failedCalls: 0,
        deniedCalls: 0,
        skippedCalls: 0,
        stoppedOnFailure: false,
        continueOnFailure: false,
        warnings: ['Result truncated from 200000 chars.'],
        warningCount: 1
      },
      calls: [
        {
          index: 0,
          callId: 'call-1',
          tool: 'read_file',
          status: 'completed'
        }
      ]
    }
  ];
}
