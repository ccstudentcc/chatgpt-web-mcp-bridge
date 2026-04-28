import type { ToolCallError } from '@cwmb/shared-utils';
import type {
  BatchResultEnvelope,
  BatchResultItem,
  ExecutionErrorEnvelope,
  InlineToolResultEnvelope
} from './types.js';

interface LegacyToolCallSuccess<TResult = unknown> {
  ok: true;
  tool: string;
  result: TResult;
  warnings: string[];
  durationMs: number;
}

interface LegacyToolCallFailure {
  ok: false;
  tool: string;
  error: ToolCallError;
  warnings: string[];
  durationMs: number;
}

interface CreateBatchResultEnvelopeOptions {
  batchId: string;
  messageId?: string;
  items: BatchResultItem[];
  warnings?: string[];
  stoppedOnFailure: boolean;
}

export function createInlineToolResultEnvelopeFromLegacyResponse(
  response: LegacyToolCallSuccess,
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
  response: LegacyToolCallFailure
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

const NON_RETRYABLE_ERROR_CODES = new Set([
  'INVALID_ARGS',
  'TOOL_NOT_FOUND',
  'TOOL_DISABLED',
  'PWSH_DISABLED',
  'BLOCKED_PATH',
  'PATH_OUTSIDE_WORKSPACE',
  'UNAUTHORIZED'
]);
