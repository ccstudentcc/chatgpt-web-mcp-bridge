import type { ToolDecision } from '@cwmb/policy-model';
import type { ExecutionProfile, OperatorIntent } from '@cwmb/shared-utils';
import type { RequestInjectionContext } from '@cwmb/turn-model';
import type {
  ExecuteRequest,
  ExecuteResponse,
  ToolCallRequest,
  ToolCallResponse
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

export function createExecuteResponse(options: CreateExecuteResponseOptions): ExecuteResponse {
  return {
    requestId: options.requestId,
    executionId: options.executionId,
    decisions: options.decisions,
    result: options.result
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
