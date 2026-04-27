import type {
  BatchResultEnvelope,
  BatchResultItem,
  ExecuteRequest,
  ExecuteResponse,
  ExecutionErrorEnvelope,
  ExecutionProfile,
  InlineToolResultEnvelope,
  OperatorIntent,
  RequestInjectionContext,
  RiskLevel,
  ToolCallRequest,
  ToolCallResponse,
  ToolDecision
} from './types.js';

interface CreateLegacyToolCallRequestOptions {
  tool: string;
  args: Record<string, unknown>;
  callId: string;
  conversationId?: string;
}

interface CreateExecuteRequestFromToolCallOptions {
  assistantTurnId?: string;
  detectionSource?: ExecuteRequest['turnContext']['detectionSource'];
  executionProfile?: ExecutionProfile;
  operatorIntent?: OperatorIntent;
  requestId?: string;
  requestInjection?: RequestInjectionContext;
}

interface CreateExecuteResponseOptions {
  requestId: string;
  executionId: string;
  decisions: ToolDecision[];
  result: ExecuteResponse['result'];
}

interface CreateBatchResultEnvelopeOptions {
  batchId: string;
  messageId?: string;
  items: BatchResultItem[];
  warnings?: string[];
  stoppedOnFailure: boolean;
}

interface CreateToolDecisionOptions {
  callId: string;
  action: ToolDecision['action'];
  reasonCode: string;
  risk: RiskLevel;
  message: string;
}

export type ToolCallCompatResponse<TResult = unknown> =
  ToolCallResponse<TResult>
  & { execute?: unknown };

export function createLegacyToolCallRequest(options: CreateLegacyToolCallRequestOptions): ToolCallRequest {
  return {
    tool: options.tool,
    args: options.args,
    source: {
      page: 'chatgpt',
      conversationId: options.conversationId,
      callId: options.callId
    }
  };
}

export function createExecuteRequestFromToolCallRequest(
  request: ToolCallRequest,
  options: CreateExecuteRequestFromToolCallOptions = {}
): ExecuteRequest {
  return {
    requestId: options.requestId ?? `legacy-${request.source.callId}`,
    turnContext: {
      source: {
        page: request.source.page,
        conversationId: request.source.conversationId,
        assistantTurnId: options.assistantTurnId
      },
      detectionSource: options.detectionSource ?? 'assistant_message_scan',
      requestInjection: options.requestInjection ?? { channel: 'hidden_request_prompt', promptVersion: 'legacy-v0.1' },
      executionProfile: options.executionProfile ?? 'legacy_auto'
    },
    operatorIntent: options.operatorIntent ?? 'auto_flow',
    calls: [
      {
        callId: request.source.callId,
        tool: request.tool,
        args: request.args,
        duplicateGuardKey: `legacy-${request.source.callId}`
      }
    ]
  };
}

export function createToolDecision(options: CreateToolDecisionOptions): ToolDecision {
  return {
    callId: options.callId,
    action: options.action,
    reasonCode: options.reasonCode,
    risk: options.risk,
    message: options.message
  };
}

export function createInlineToolResultEnvelopeFromLegacyResponse(
  response: Extract<ToolCallResponse, { ok: true }>,
  callId: string
): InlineToolResultEnvelope {
  return {
    type: 'inline_tool_result',
    callId,
    tool: response.tool,
    ok: true,
    output: response.result,
    summary: `Tool ${response.tool} completed successfully.`,
    warnings: response.warnings
  };
}

export function createExecutionErrorEnvelopeFromLegacyResponse(
  response: Extract<ToolCallResponse, { ok: false }>
): ExecutionErrorEnvelope {
  return {
    type: 'execution_error',
    error: {
      code: response.error.code,
      summary: response.error.message,
      retryable: !NON_RETRYABLE_ERROR_CODES.has(response.error.code),
      details: response.error.details
    }
  };
}

export function createExecuteResponse(options: CreateExecuteResponseOptions): ExecuteResponse {
  return {
    requestId: options.requestId,
    executionId: options.executionId,
    decisions: options.decisions,
    result: options.result
  };
}

export function createBatchResultEnvelope(options: CreateBatchResultEnvelopeOptions): BatchResultEnvelope {
  const completed = options.items.filter((item): item is Extract<BatchResultItem, { ok: true }> => 'ok' in item && item.ok === true).length;
  const failed = options.items.filter((item): item is Extract<BatchResultItem, { ok: false }> => 'ok' in item && item.ok === false).length;
  const skipped = options.items.filter((item): item is Extract<BatchResultItem, { status: 'skipped' }> => 'status' in item && item.status === 'skipped').length;

  return {
    type: 'tool_result_batch',
    ok: failed === 0,
    batchId: options.batchId,
    source: options.messageId ? { messageId: options.messageId } : undefined,
    summary: {
      total: options.items.length,
      completed,
      failed,
      skipped,
      stoppedOnFailure: options.stoppedOnFailure
    },
    items: options.items,
    warnings: options.warnings ?? []
  };
}

export function getExecuteResponseCompat(value: unknown): ExecuteResponse | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const nestedExecute = getObjectField(value, 'execute');
  if (nestedExecute) {
    const requestId = getStringField(nestedExecute, 'requestId');
    const executionId = getStringField(nestedExecute, 'executionId');
    const decisions = getArrayField(nestedExecute, 'decisions');
    const result = getObjectField(nestedExecute, 'result');
    const resultType = result ? getStringField(result, 'type') : undefined;

    if (requestId && executionId && decisions && result && resultType) {
      return {
        requestId,
        executionId,
        decisions: decisions as ToolDecision[],
        result: result as unknown as ExecuteResponse['result']
      };
    }
  }

  return null;
}

const NON_RETRYABLE_ERROR_CODES = new Set([
  'INVALID_ARGS',
  'TOOL_NOT_FOUND',
  'TOOL_DISABLED',
  'PWSH_DISABLED',
  'BLOCKED_PATH',
  'PATH_OUTSIDE_WORKSPACE',
  'UNAUTHORIZED'
]);

function getStringField(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== 'object' || !(key in value)) {
    return undefined;
  }

  const field = (value as Record<string, unknown>)[key];
  return typeof field === 'string' ? field : undefined;
}

function getArrayField(value: unknown, key: string): unknown[] | undefined {
  if (!value || typeof value !== 'object' || !(key in value)) {
    return undefined;
  }

  const field = (value as Record<string, unknown>)[key];
  return Array.isArray(field) ? field : undefined;
}

function getObjectField(value: unknown, key: string): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || !(key in value)) {
    return undefined;
  }

  const field = (value as Record<string, unknown>)[key];
  return field && typeof field === 'object' ? field as Record<string, unknown> : undefined;
}
