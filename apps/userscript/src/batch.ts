import type { ToolCallError, ToolCallFailure, ToolCallRequest, ToolCallResponse } from '@cwmb/protocol';
import type { ParsedMcpBlock } from './parser.js';
import { sha256Normalized } from './hash.js';

export interface BatchSuccessItem {
  index: number;
  tool: string;
  callId: string;
  ok: true;
  result: unknown;
  warnings: string[];
  durationMs: number;
}

export interface BatchFailureItem {
  index: number;
  tool: string;
  callId: string;
  ok: false;
  error: ToolCallError;
  warnings: string[];
  durationMs: number;
}

export interface BatchSkippedItem {
  index: number;
  tool: string;
  callId: string;
  status: 'skipped';
  reason: 'SKIPPED_AFTER_BATCH_FAILURE';
}

export type BatchResultItem = BatchSuccessItem | BatchFailureItem | BatchSkippedItem;

export interface ToolResultBatch {
  type: 'tool_result_batch';
  ok: boolean;
  batchId: string;
  source: {
    messageId: string;
  };
  summary: {
    total: number;
    completed: number;
    failed: number;
    skipped: number;
    stoppedOnFailure: boolean;
  };
  items: BatchResultItem[];
  warnings: string[];
}

interface ExecuteBatchOptions {
  batchId: string;
  messageId: string;
  blocks: ParsedMcpBlock[];
  executeTool: (request: ToolCallRequest) => Promise<ToolCallResponse>;
  onProgress?: (progress: { current: number; total: number; tool: string }) => void;
}

export async function createBatchId(messageId: string, blocks: Array<Pick<ParsedMcpBlock, 'raw'>>): Promise<string> {
  return sha256Normalized([messageId, ...blocks.map((block) => block.raw)].join('\n\n'));
}

export async function executeBatch(options: ExecuteBatchOptions): Promise<ToolResultBatch> {
  const { batchId, messageId, blocks, executeTool, onProgress } = options;
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

    for (const skipped of blocks.slice(index + 1)) {
      items.push({
        index: items.length,
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
  const request: ToolCallRequest = {
    tool: pending.block.tool,
    args: pending.block.args,
    source: {
      page: 'chatgpt',
      callId: pending.callId
    }
  };

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
): ToolResultBatch {
  const completed = items.filter((item): item is BatchSuccessItem => 'ok' in item && item.ok === true).length;
  const failed = items.filter((item): item is BatchFailureItem => 'ok' in item && item.ok === false).length;
  const skipped = items.filter((item): item is BatchSkippedItem => 'status' in item && item.status === 'skipped').length;

  return {
    type: 'tool_result_batch',
    ok: failed === 0,
    batchId,
    source: { messageId },
    summary: {
      total: items.length,
      completed,
      failed,
      skipped,
      stoppedOnFailure
    },
    items,
    warnings: [...warnings]
  };
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
