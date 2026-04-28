import type { ToolDecision } from '@cwmb/policy-model';
import type { BatchResultEnvelope, InlineToolResultEnvelope } from '@cwmb/result-model';
import type { RiskLevel } from '@cwmb/shared-utils';
import type { TurnContext } from '@cwmb/turn-model';
import type {
  CatalogContract,
  CatalogToolDescriptor,
  ExecuteRequest,
  GatewayHealthContract
} from '@cwmb/tool-contracts';

export function createCatalogToolDescriptor(
  overrides: Partial<CatalogToolDescriptor> = {}
): CatalogToolDescriptor {
  return {
    name: 'read_file',
    title: 'Read file',
    displayName: 'Read file',
    description: 'Read a file.',
    source: 'builtin',
    risk: 'low',
    requiresConfirmation: false,
    enabled: true,
    exampleArgs: {},
    ...overrides
  };
}

export function createCatalogContract(
  overrides: Partial<CatalogContract> = {}
): CatalogContract {
  return {
    catalogVersion: '2026-04-28.stage18',
    generatedAt: '2026-04-28T00:00:00.000Z',
    workspaceRoot: '/workspace',
    tools: [createCatalogToolDescriptor()],
    ...overrides
  };
}

export function createGatewayHealthContract(
  overrides: Partial<GatewayHealthContract> = {}
): GatewayHealthContract {
  return {
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
    maxToolRounds: 3,
    ...overrides
  };
}

export function createTurnContext(
  overrides: Partial<TurnContext> = {}
): TurnContext {
  return {
    source: {
      page: 'chatgpt',
      conversationId: 'conv-1',
      assistantTurnId: 'assistant-1'
    },
    detectionSource: 'assistant_message_scan',
    requestInjection: {
      channel: 'hidden_request_prompt',
      promptVersion: 'bridge-v1'
    },
    executionProfile: 'legacy_auto',
    ...overrides
  };
}

export function createExecuteRequest(
  overrides: Partial<ExecuteRequest> = {}
): ExecuteRequest {
  return {
    requestId: 'req-1',
    turnContext: createTurnContext(),
    operatorIntent: 'auto_flow',
    calls: [
      {
        callId: 'call-1',
        tool: 'read_file',
        args: { path: 'README.md' },
        duplicateGuardKey: 'dup-1'
      }
    ],
    ...overrides
  };
}

export function createToolDecisionFixture(
  overrides: Partial<ToolDecision> = {}
): ToolDecision {
  const risk = (overrides.risk ?? 'low') as RiskLevel;

  return {
    callId: 'call-1',
    action: 'execute',
    reasonCode: 'ALLOWED_CURRENT_TOOL',
    risk,
    message: 'Allowed by the current gateway policy.',
    ...overrides
  };
}

export function createInlineToolResultEnvelopeFixture(
  overrides: Partial<InlineToolResultEnvelope> = {}
): InlineToolResultEnvelope {
  return {
    type: 'inline_tool_result',
    callId: 'call-1',
    tool: 'read_file',
    ok: true,
    output: { text: 'hello' },
    summary: 'Tool read_file completed successfully.',
    warnings: [],
    ...overrides
  };
}

export function createBatchResultEnvelopeFixture(
  overrides: Partial<BatchResultEnvelope> = {}
): BatchResultEnvelope {
  return {
    type: 'tool_result_batch',
    ok: true,
    batchId: 'batch-1',
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
    warnings: [],
    ...overrides
  };
}
