import { createToolDecision, type ExecuteRequest, type RiskLevel, type ToolDecision } from '@cwmb/protocol';
import { AppError } from '@cwmb/shared';
import type { LocalTool } from '../tools/index.js';
import { failure } from '../utils/errors.js';

export interface AllowedToolCall {
  kind: 'allow';
  tool: LocalTool;
  args: unknown;
  risk: RiskLevel;
}

export interface DeniedToolCall {
  kind: 'deny';
  error: unknown;
  risk: RiskLevel;
}

export type ToolCallAssessment = AllowedToolCall | DeniedToolCall;

export function assessToolCall(
  call: ExecuteRequest['calls'][number],
  registry: Map<string, LocalTool>
): ToolCallAssessment {
  const tool = registry.get(call.tool);
  if (!tool) {
    return {
      kind: 'deny',
      error: new AppError('TOOL_NOT_FOUND', `Tool not found: ${call.tool}`),
      risk: 'low'
    };
  }

  if (!tool.enabled) {
    return {
      kind: 'deny',
      error: new AppError(tool.name === 'run_pwsh' ? 'PWSH_DISABLED' : 'TOOL_DISABLED', `Tool disabled: ${call.tool}`),
      risk: tool.risk
    };
  }

  try {
    return {
      kind: 'allow',
      tool,
      args: tool.argsSchema.parse(call.args),
      risk: tool.risk
    };
  } catch (error) {
    return {
      kind: 'deny',
      error,
      risk: tool.risk
    };
  }
}

export function createSuccessDecision(callId: string, risk: RiskLevel): ToolDecision {
  return createToolDecision({
    callId,
    action: 'execute',
    reasonCode: 'ALLOWED_CURRENT_TOOL',
    risk,
    message: 'Allowed by the current gateway policy.'
  });
}

export function createFailureDecision(
  callId: string,
  risk: RiskLevel,
  error: unknown,
  executionAllowed: boolean
): ToolDecision {
  const errorPayload = failure('policy', error, 0).error;
  return createToolDecision({
    callId,
    action: inferDecisionAction(errorPayload.code, executionAllowed),
    reasonCode: errorPayload.code,
    risk,
    message: errorPayload.message
  });
}

export function assertWriteEnabled(allowWrite: boolean): void {
  if (!allowWrite) {
    throw new AppError('TOOL_DISABLED', 'write_file requires allowWrite=true in gateway config.');
  }
}

function inferDecisionAction(errorCode: string, executionAllowed: boolean): 'execute' | 'deny' {
  if (isPolicyDeniedErrorCode(errorCode)) {
    return 'deny';
  }

  return executionAllowed ? 'execute' : 'deny';
}

function isPolicyDeniedErrorCode(errorCode: string): boolean {
  return [
    'BINARY_FILE_REJECTED',
    'BLOCKED_PATH',
    'FILE_TOO_LARGE',
    'INVALID_PATH',
    'PATH_OUTSIDE_WORKSPACE',
    'PWSH_DISABLED',
    'SENSITIVE_CONTENT_BLOCKED',
    'TOOL_DISABLED',
    'TOOL_NOT_FOUND',
    'WORKSPACE_NOT_CONFIGURED'
  ].includes(errorCode);
}
