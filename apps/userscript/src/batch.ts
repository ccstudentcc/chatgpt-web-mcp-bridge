import {
  createBatchResultEnvelope,
  createLegacyToolCallRequest,
  type BatchResultEnvelope,
  type BatchResultFailureItem,
  type BatchResultItem,
  type BatchResultSkippedItem,
  type BatchResultSuccessItem,
  type ToolCallFailure,
  type ToolCallRequest,
  type ToolCallResponse
} from '@cwmb/protocol';
import type { ParsedMcpBlock } from './parser.js';
import { sha256Normalized } from './hash.js';

interface ExecuteBatchOptions {
  batchId: string;
  messageId: string;
  blocks: ParsedMcpBlock[];
  executeTool: (request: ToolCallRequest) => Promise<ToolCallResponse>;
  continueOnFailure?: boolean;
  onProgress?: (progress: { current: number; total: number; tool: string }) => void;
}

export async function createBatchId(messageId: string, blocks: Array<Pick<ParsedMcpBlock, 'raw'>>): Promise<string> {
  return sha256Normalized([messageId, ...blocks.map((block) => block.raw)].join('\n\n'));
}

export async function executeBatch(options: ExecuteBatchOptions): Promise<BatchResultEnvelope> {
  const { batchId, messageId, blocks, executeTool, continueOnFailure = false, onProgress } = options;
  const items: BatchResultItem[] = [];
  const warnings = new Set<string>();

  for (const [index, pending] of blocks.entries()) {
    onProgress?.({ current: index + 1, total: blocks.length, tool: pending.block.tool });
    const response = await executeSafely(pending, executeTool);

    for (const warning of response.warnings) {
      warnings.add(warning);
    }

    if (response.ok) {
      items.push({
        index,
        tool: pending.block.tool,
        callId: pending.callId,
        ok: true,
        result: response.result,
        warnings: response.warnings,
        durationMs: response.durationMs
      });
      continue;
    }

    items.push({
      index,
      tool: pending.block.tool,
      callId: pending.callId,
      ok: false,
      error: response.error,
      warnings: response.warnings,
      durationMs: response.durationMs
    });

    if (continueOnFailure) {
      continue;
    }

    for (const [offset, skipped] of blocks.slice(index + 1).entries()) {
      items.push({
        index: index + offset + 1,
        tool: skipped.block.tool,
        callId: skipped.callId,
        status: 'skipped',
        reason: 'SKIPPED_AFTER_BATCH_FAILURE'
      });
    }

    return buildBatchResult(batchId, messageId, items, warnings, true);
  }

  return buildBatchResult(batchId, messageId, items, warnings, false);
}

async function executeSafely(
  pending: ParsedMcpBlock,
  executeTool: (request: ToolCallRequest) => Promise<ToolCallResponse>
): Promise<ToolCallResponse> {
  const request = createLegacyToolCallRequest({
    tool: pending.block.tool,
    args: pending.block.args,
    callId: pending.callId
  });

  try {
    return await executeTool(request);
  } catch (error) {
    return failureFromError(request.tool, error);
  }
}

function buildBatchResult(
  batchId: string,
  messageId: string,
  items: BatchResultItem[],
  warnings: Set<string>,
  stoppedOnFailure: boolean
): BatchResultEnvelope {
  return createBatchResultEnvelope({
    batchId,
    messageId,
    items,
    warnings: [...warnings],
    stoppedOnFailure
  });
}

function failureFromError(tool: string, error: unknown): ToolCallFailure {
  const details = error && typeof error === 'object' && 'details' in error ? (error as { details?: unknown }).details : undefined;
  const code = error && typeof error === 'object' && 'code' in error ? String((error as { code: unknown }).code) : 'INTERNAL_ERROR';
  const message = error instanceof Error ? error.message : 'Tool call failed';

  return {
    ok: false,
    tool,
    error: {
      code,
      message,
      details
    },
    warnings: [],
    durationMs: 0
  };
}
