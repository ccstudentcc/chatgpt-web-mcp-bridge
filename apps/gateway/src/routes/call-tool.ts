import type { FastifyInstance } from 'fastify';
import {
  ToolCallRequestSchema,
  createExecuteRequestFromToolCallRequest,
  createExecuteResponse,
  createExecutionErrorEnvelopeFromLegacyResponse,
  createInlineToolResultEnvelopeFromLegacyResponse,
  createToolDecision,
  type ExecuteRequest,
  type ExecuteResponse,
  type RiskLevel,
  type ToolCallFailure,
  type ToolCallLiveFailure,
  type ToolCallLiveResponse,
  type ToolCallLiveSuccess,
  type ToolCallSuccess
} from '@cwmb/protocol';
import { AppError, truncateText } from '@cwmb/shared';
import type { GatewayConfig } from '../config.js';
import type { Logger } from '../logger.js';
import { assertAuthorized } from '../security/token.js';
import { createToolRegistry } from '../tools/index.js';
import { failure } from '../utils/errors.js';

export async function registerCallToolRoute(server: FastifyInstance, config: GatewayConfig, token: string | undefined, logger: Logger): Promise<void> {
  server.post('/call-tool', async (request) => {
    const started = Date.now();
    let toolName = 'unknown';
    let callId: string | undefined;
    let toolRisk: RiskLevel = 'low';
    let executeRequest: ExecuteRequest | null = null;
    let executionAllowed = false;
    try {
      assertAuthorized(request.headers, { expectedToken: token, trustedLocalMode: config.trustedLocalMode });
      const parsed = ToolCallRequestSchema.safeParse(request.body);
      if (!parsed.success) throw new AppError('INVALID_ARGS', 'Invalid tool call request.', parsed.error.flatten());
      const req = parsed.data;
      toolName = req.tool;
      callId = req.source.callId;
      executeRequest = createExecuteRequestFromToolCallRequest(req);

      const registry = createToolRegistry(config);
      const tool = registry.get(req.tool);
      if (!tool) throw new AppError('TOOL_NOT_FOUND', `Tool not found: ${req.tool}`);
      toolRisk = tool.risk;
      if (!tool.enabled) throw new AppError(tool.name === 'run_pwsh' ? 'PWSH_DISABLED' : 'TOOL_DISABLED', `Tool disabled: ${req.tool}`);

      const args = tool.argsSchema.parse(req.args);
      executionAllowed = true;
      const result = await tool.run(args, { config, logger });
      const serialized = JSON.stringify(result);
      const truncated = truncateText(serialized, config.maxGatewayResultChars);
      const safeResult = truncated.truncated
        ? { truncated: true, originalSizeChars: truncated.originalSizeChars, preview: truncated.text }
        : result;
      const toolWarnings = extractWarnings(result);
      const warnings = truncated.truncated
        ? [...toolWarnings, `Result truncated from ${truncated.originalSizeChars} chars.`]
        : toolWarnings;
      const durationMs = Date.now() - started;
      await logger.write({ ts: new Date().toISOString(), callId, tool: req.tool, risk: tool.risk, argsSummary: summarizeArgs(req.args), ok: true, durationMs, warnings });
      const legacyResponse: ToolCallSuccess = { ok: true, tool: req.tool, result: safeResult, warnings, durationMs };
      return attachExecuteCompat(legacyResponse, createExecuteResponse({
        requestId: executeRequest.requestId,
        executionId: `${executeRequest.requestId}.${started}`,
        decisions: [
          createToolDecision({
            callId: req.source.callId,
            action: 'execute',
            reasonCode: 'ALLOWED_CURRENT_TOOL',
            risk: tool.risk,
            message: 'Allowed by the current gateway policy.'
          })
        ],
        result: createInlineToolResultEnvelopeFromLegacyResponse(legacyResponse, req.source.callId)
      }));
    } catch (err) {
      const durationMs = Date.now() - started;
      const response = failure(toolName, err, durationMs);
      await logger.write({ ts: new Date().toISOString(), callId, tool: toolName, ok: false, durationMs, warnings: response.warnings, resultSummary: response.error.code });
      return attachExecuteCompat(response, createExecuteResponse({
        requestId: executeRequest?.requestId ?? `legacy-invalid-${started}`,
        executionId: `${executeRequest?.requestId ?? 'legacy-invalid'}.${started}`,
        decisions: callId
          ? [
              createToolDecision({
                callId,
                action: inferDecisionAction(response.error.code, executionAllowed),
                reasonCode: response.error.code,
                risk: toolRisk,
                message: response.error.message
              })
            ]
          : [],
        result: createExecutionErrorEnvelopeFromLegacyResponse(response)
      }));
    }
  });
}

function attachExecuteCompat(
  legacyResponse: ToolCallSuccess,
  executeResponse: ExecuteResponse
): ToolCallLiveSuccess;
function attachExecuteCompat(
  legacyResponse: ToolCallFailure,
  executeResponse: ExecuteResponse
): ToolCallLiveFailure;
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
    if (key.toLowerCase().includes('content')) summary[key] = `[${String(value).length} chars]`;
    else summary[key] = value;
  }
  return summary;
}

function extractWarnings(result: unknown): string[] {
  if (!result || typeof result !== 'object' || !('warnings' in result)) {
    return [];
  }

  const maybeWarnings = (result as { warnings?: unknown }).warnings;
  return Array.isArray(maybeWarnings) ? maybeWarnings.filter((item): item is string => typeof item === 'string') : [];
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
