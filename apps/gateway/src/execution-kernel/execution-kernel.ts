import {
  createBatchResultEnvelope,
  createExecuteRequestFromToolCallRequest,
  createExecuteResponse,
  createExecutionErrorEnvelopeFromLegacyResponse,
  createInlineToolResultEnvelopeFromLegacyResponse,
  createToolDecision,
  type BatchResultItem,
  type ExecuteRequest,
  type ExecuteResponse,
  type RiskLevel,
  type ToolCallFailure,
  type ToolCallLiveResponse,
  type ToolCallRequest,
  type ToolCallSuccess,
  type ToolDecision
} from '@cwmb/protocol';
import { AppError, truncateText } from '@cwmb/shared';
import type { GatewayConfig } from '../config.js';
import type { Logger } from '../logger.js';
import { createToolRegistry, type LocalTool } from '../tools/index.js';
import { failure } from '../utils/errors.js';

interface CreateExecutionKernelOptions {
  config: GatewayConfig;
  logger: Logger;
  now?: () => number;
  registry?: Map<string, LocalTool>;
}

export interface ExecuteCallsOptions {
  continueOnFailure?: boolean;
}

interface ExecutionKernelCallSuccess {
  kind: 'success';
  index: number;
  callId: string;
  tool: string;
  legacyResponse: ToolCallSuccess;
  decision: ToolDecision;
}

interface ExecutionKernelCallFailure {
  kind: 'failure';
  index: number;
  callId: string;
  tool: string;
  legacyResponse: ToolCallFailure;
  decision: ToolDecision;
}

interface ExecutionKernelCallSkipped {
  kind: 'skipped';
  index: number;
  callId: string;
  tool: string;
}

type ExecutionKernelCallOutcome =
  | ExecutionKernelCallSuccess
  | ExecutionKernelCallFailure
  | ExecutionKernelCallSkipped;

export interface ExecutionKernelResult {
  executeResponse: ExecuteResponse;
  callOutcomes: ExecutionKernelCallOutcome[];
}

export interface ExecutionKernel {
  execute(request: ExecuteRequest, options?: ExecuteCallsOptions): Promise<ExecutionKernelResult>;
  executeLegacyToolCall(request: ToolCallRequest): Promise<ToolCallLiveResponse>;
}

export function createExecutionKernel(options: CreateExecutionKernelOptions): ExecutionKernel {
  const now = options.now ?? Date.now;
  const registry = options.registry ?? createToolRegistry(options.config);
  const execute = async (request: ExecuteRequest, executeOptions: ExecuteCallsOptions = {}): Promise<ExecutionKernelResult> => {
    const started = now();
    const executionId = `${request.requestId}.${started}`;
    const continueOnFailure = executeOptions.continueOnFailure ?? false;
    const callOutcomes: ExecutionKernelCallOutcome[] = [];
    const batchWarnings = new Set<string>();

    for (const [index, call] of request.calls.entries()) {
      const outcome = await executeCall({
        index,
        call,
        config: options.config,
        logger: options.logger,
        registry,
        now
      });
      callOutcomes.push(outcome);

      for (const warning of outcome.legacyResponse.warnings) {
        batchWarnings.add(warning);
      }

      if (outcome.kind === 'failure' && !continueOnFailure) {
        for (const [offset, skippedCall] of request.calls.slice(index + 1).entries()) {
          callOutcomes.push({
            kind: 'skipped',
            index: index + offset + 1,
            callId: skippedCall.callId,
            tool: skippedCall.tool
          });
        }
        break;
      }
    }

    return {
      executeResponse: createExecuteResponse({
        requestId: request.requestId,
        executionId,
        decisions: callOutcomes.flatMap((outcome) => outcome.kind === 'skipped' ? [] : [outcome.decision]),
        result: buildResultEnvelope(request, executionId, callOutcomes, [...batchWarnings])
      }),
      callOutcomes
    };
  };

  return {
    execute,
    async executeLegacyToolCall(request) {
      const result = await execute(createExecuteRequestFromToolCallRequest(request));
      const firstOutcome = result.callOutcomes[0];
      if (!firstOutcome || firstOutcome.kind === 'skipped') {
        throw new AppError('INTERNAL_ERROR', 'Legacy /call-tool execution produced no callable outcome.');
      }

      return attachExecuteCompat(firstOutcome.legacyResponse, result.executeResponse);
    }
  };
}

interface ExecuteCallOptions {
  index: number;
  call: ExecuteRequest['calls'][number];
  config: GatewayConfig;
  logger: Logger;
  registry: Map<string, LocalTool>;
  now: () => number;
}

async function executeCall(options: ExecuteCallOptions): Promise<ExecutionKernelCallSuccess | ExecutionKernelCallFailure> {
  const { call, config, logger, registry, now } = options;
  const started = now();
  let toolRisk: RiskLevel = 'low';
  let executionAllowed = false;

  try {
    const resolvedTool = resolveToolCall(call, registry);
    toolRisk = resolvedTool.tool.risk;
    executionAllowed = true;

    const result = await resolvedTool.tool.run(resolvedTool.args, { config, logger });
    const safeResult = toSafeResult(result, config.maxGatewayResultChars);
    const warnings = collectWarnings(result, safeResult.truncationWarning);
    const durationMs = now() - started;

    await logger.write({
      ts: new Date().toISOString(),
      callId: call.callId,
      tool: call.tool,
      risk: resolvedTool.tool.risk,
      argsSummary: summarizeArgs(call.args),
      ok: true,
      durationMs,
      warnings
    });

    const legacyResponse: ToolCallSuccess = {
      ok: true,
      tool: call.tool,
      result: safeResult.output,
      warnings,
      durationMs
    };

    return {
      kind: 'success',
      index: options.index,
      callId: call.callId,
      tool: call.tool,
      legacyResponse,
      decision: createToolDecision({
        callId: call.callId,
        action: 'execute',
        reasonCode: 'ALLOWED_CURRENT_TOOL',
        risk: resolvedTool.tool.risk,
        message: 'Allowed by the current gateway policy.'
      })
    };
  } catch (error) {
    const durationMs = now() - started;
    const legacyResponse = failure(call.tool, error, durationMs);

    await logger.write({
      ts: new Date().toISOString(),
      callId: call.callId,
      tool: call.tool,
      ok: false,
      durationMs,
      warnings: legacyResponse.warnings,
      resultSummary: legacyResponse.error.code
    });

    return {
      kind: 'failure',
      index: options.index,
      callId: call.callId,
      tool: call.tool,
      legacyResponse,
      decision: createToolDecision({
        callId: call.callId,
        action: inferDecisionAction(legacyResponse.error.code, executionAllowed),
        reasonCode: legacyResponse.error.code,
        risk: toolRisk,
        message: legacyResponse.error.message
      })
    };
  }
}

function resolveToolCall(
  call: ExecuteRequest['calls'][number],
  registry: Map<string, LocalTool>
): { tool: LocalTool; args: unknown } {
  const tool = registry.get(call.tool);
  if (!tool) {
    throw new AppError('TOOL_NOT_FOUND', `Tool not found: ${call.tool}`);
  }
  if (!tool.enabled) {
    throw new AppError(tool.name === 'run_pwsh' ? 'PWSH_DISABLED' : 'TOOL_DISABLED', `Tool disabled: ${call.tool}`);
  }

  return {
    tool,
    args: tool.argsSchema.parse(call.args)
  };
}

function buildResultEnvelope(
  request: ExecuteRequest,
  executionId: string,
  callOutcomes: ExecutionKernelCallOutcome[],
  warnings: string[]
): ExecuteResponse['result'] {
  if (request.calls.length === 1) {
    const firstOutcome = callOutcomes[0];
    if (!firstOutcome || firstOutcome.kind === 'skipped') {
      throw new AppError('INTERNAL_ERROR', 'Single-call execution produced an invalid kernel outcome.');
    }

    return firstOutcome.kind === 'success'
      ? createInlineToolResultEnvelopeFromLegacyResponse(firstOutcome.legacyResponse, firstOutcome.callId)
      : createExecutionErrorEnvelopeFromLegacyResponse(firstOutcome.legacyResponse);
  }

  return createBatchResultEnvelope({
    batchId: executionId,
    messageId: request.turnContext.source.assistantTurnId,
    stoppedOnFailure: callOutcomes.some((outcome) => outcome.kind === 'skipped'),
    warnings,
    items: callOutcomes.map(toBatchResultItem)
  });
}

function toBatchResultItem(outcome: ExecutionKernelCallOutcome): BatchResultItem {
  if (outcome.kind === 'success') {
    return {
      index: outcome.index,
      tool: outcome.tool,
      callId: outcome.callId,
      ok: true,
      result: outcome.legacyResponse.result,
      warnings: outcome.legacyResponse.warnings,
      durationMs: outcome.legacyResponse.durationMs
    };
  }

  if (outcome.kind === 'failure') {
    return {
      index: outcome.index,
      tool: outcome.tool,
      callId: outcome.callId,
      ok: false,
      error: outcome.legacyResponse.error,
      warnings: outcome.legacyResponse.warnings,
      durationMs: outcome.legacyResponse.durationMs
    };
  }

  return {
    index: outcome.index,
    tool: outcome.tool,
    callId: outcome.callId,
    status: 'skipped',
    reason: 'SKIPPED_AFTER_BATCH_FAILURE'
  };
}

function attachExecuteCompat(
  legacyResponse: ToolCallSuccess | ToolCallFailure,
  executeResponse: ExecuteResponse
): ToolCallLiveResponse {
  return {
    ...legacyResponse,
    execute: executeResponse
  };
}

function summarizeArgs(args: Record<string, unknown>): Record<string, unknown> {
  const summary: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    if (key.toLowerCase().includes('content')) {
      summary[key] = `[${String(value).length} chars]`;
      continue;
    }

    summary[key] = value;
  }
  return summary;
}

function collectWarnings(result: unknown, truncationWarning?: string): string[] {
  const warnings = extractWarnings(result);
  return truncationWarning ? [...warnings, truncationWarning] : warnings;
}

function extractWarnings(result: unknown): string[] {
  if (!result || typeof result !== 'object' || !('warnings' in result)) {
    return [];
  }

  const maybeWarnings = (result as { warnings?: unknown }).warnings;
  return Array.isArray(maybeWarnings) ? maybeWarnings.filter((item): item is string => typeof item === 'string') : [];
}

function toSafeResult(
  result: unknown,
  maxGatewayResultChars: number
): { output: unknown; truncationWarning?: string } {
  const serialized = JSON.stringify(result);
  const truncated = truncateText(serialized, maxGatewayResultChars);
  if (!truncated.truncated) {
    return { output: result };
  }

  return {
    output: {
      truncated: true,
      originalSizeChars: truncated.originalSizeChars,
      preview: truncated.text
    },
    truncationWarning: `Result truncated from ${truncated.originalSizeChars} chars.`
  };
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
    'WORKSPACE_NOT_CONFIGURED'
  ].includes(errorCode);
}
