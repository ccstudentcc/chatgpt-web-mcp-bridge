import { describe, expect, it } from 'vitest';
import {
  CatalogContractSchema,
  ExecuteRequestSchema,
  ExecuteResponseSchema,
  GatewayHealthContractSchema,
  GatewayRuntimeSnapshotSchema,
  ToolDescriptorSchema
} from './schemas.js';

describe('ToolDescriptorSchema', () => {
  it('defaults exampleArgs to an empty object', () => {
    expect(ToolDescriptorSchema.parse({
      name: 'read_file',
      title: 'Read file',
      description: 'Read a file.',
      risk: 'low',
      requiresConfirmation: false,
      enabled: true
    })).toMatchObject({ exampleArgs: {} });
  });
});

describe('CatalogContractSchema', () => {
  it('accepts materialized catalog metadata and v0.9 descriptor fields', () => {
    expect(CatalogContractSchema.parse({
      catalogVersion: '2026-04-27.phase1',
      generatedAt: '2026-04-27T12:00:00.000Z',
      workspaceRoot: '/workspace',
      tools: [
        {
          name: 'read_file',
          title: 'Read file',
          displayName: 'Read file',
          description: 'Read a file.',
          source: 'builtin',
          risk: 'low',
          requiresConfirmation: false,
          enabled: true,
          schemaId: 'builtin.read_file.v1',
          availability: {
            legacy_auto: 'execute',
            reviewed: 'execute',
            yolo: 'execute'
          },
          exampleArgs: {}
        }
      ]
    })).toMatchObject({
      catalogVersion: '2026-04-27.phase1',
      tools: [{ source: 'builtin', displayName: 'Read file' }]
    });
  });
});

describe('GatewayHealthContractSchema', () => {
  it('accepts the live /health contract with shell details', () => {
    expect(GatewayHealthContractSchema.parse({
      ok: true,
      version: '0.1.0',
      platform: 'linux',
      host: '127.0.0.1',
      port: 8024,
      workspaceRoot: '/workspace',
      shell: {
        preferred: 'pwsh',
        resolved: 'pwsh',
        available: true,
        version: '7.5.0'
      },
      trustedLocalMode: true,
      autoExecuteLowRisk: true,
      autoInsertResult: true,
      autoSendResult: true,
      maxToolRounds: 3
    })).toMatchObject({
      shell: {
        resolved: 'pwsh',
        available: true
      }
    });
  });
});

describe('GatewayRuntimeSnapshotSchema', () => {
  it('accepts a cached-bootstrap snapshot before live health sync', () => {
    expect(GatewayRuntimeSnapshotSchema.parse({
      catalogSource: 'cache',
      catalog: {
        catalogVersion: '2026-04-27.phase1',
        generatedAt: '2026-04-27T12:00:00.000Z',
        workspaceRoot: '/workspace',
        tools: []
      }
    })).toMatchObject({
      catalogSource: 'cache',
      catalog: {
        workspaceRoot: '/workspace'
      }
    });
  });
});

describe('ExecuteRequestSchema', () => {
  it('requires a batch-first request with turn context and operator intent', () => {
    expect(ExecuteRequestSchema.parse({
      requestId: 'req-1',
      turnContext: {
        source: { page: 'chatgpt', conversationId: 'conv-1', assistantTurnId: 'msg-1' },
        detectionSource: 'assistant_message_scan',
        requestInjection: { channel: 'hidden_request_prompt', promptVersion: 'bridge-v1' },
        executionProfile: 'legacy_auto'
      },
      operatorIntent: 'auto_flow',
      calls: [
        {
          callId: 'call-1',
          tool: 'read_file',
          args: { path: 'README.md' },
          duplicateGuardKey: 'dup-1'
        }
      ]
    })).toMatchObject({
      operatorIntent: 'auto_flow',
      calls: [{ tool: 'read_file' }]
    });
  });
});

describe('ExecuteResponseSchema', () => {
  it('accepts explicit decisions and a result envelope', () => {
    expect(ExecuteResponseSchema.parse({
      requestId: 'req-1',
      executionId: 'exec-1',
      decisions: [
        {
          callId: 'call-1',
          action: 'execute',
          reasonCode: 'ALLOWED_LOW_RISK',
          risk: 'low',
          message: 'Allowed by current workspace policy.'
        }
      ],
      result: {
        type: 'tool_result_batch',
        ok: true,
        batchId: 'batch-1',
        source: {
          messageId: 'assistant-1'
        },
        summary: {
          total: 1,
          completed: 1,
          failed: 0,
          skipped: 0,
          stoppedOnFailure: false
        },
        items: [
          {
            index: 0,
            tool: 'read_file',
            callId: 'call-1',
            ok: true,
            result: { text: 'hello' },
            warnings: [],
            durationMs: 2
          }
        ],
        warnings: []
      }
    })).toMatchObject({
      decisions: [{ action: 'execute' }],
      result: { type: 'tool_result_batch' }
    });
  });
});
