import type {
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

interface CreateToolDecisionOptions {
  callId: string;
  action: ToolDecision['action'];
  reasonCode: string;
  risk: RiskLevel;
  message: string;
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

const NON_RETRYABLE_ERROR_CODES = new Set([
  'INVALID_ARGS',
  'TOOL_NOT_FOUND',
  'TOOL_DISABLED',
  'PWSH_DISABLED',
  'BLOCKED_PATH',
  'PATH_OUTSIDE_WORKSPACE',
  'UNAUTHORIZED'
]);
