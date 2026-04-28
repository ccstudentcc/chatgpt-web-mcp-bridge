import type { ToolCallError } from '@cwmb/shared-utils';

export interface InlineToolResultEnvelope {
  type: 'inline_tool_result';
  callId: string;
  tool: string;
  ok: boolean;
  output: unknown;
  summary: string;
  warnings?: string[];
}

export interface BatchResultSuccessItem {
  index: number;
  tool: string;
  callId: string;
  ok: true;
  result: unknown;
  warnings: string[];
  durationMs: number;
}

export interface BatchResultFailureItem {
  index: number;
  tool: string;
  callId: string;
  ok: false;
  error: ToolCallError;
  warnings: string[];
  durationMs: number;
}

export interface BatchResultSkippedItem {
  index: number;
  tool: string;
  callId: string;
  status: 'skipped';
  reason: 'SKIPPED_AFTER_BATCH_FAILURE';
}

export type BatchResultItem =
  | BatchResultSuccessItem
  | BatchResultFailureItem
  | BatchResultSkippedItem;

export interface BatchResultEnvelope {
  type: 'tool_result_batch';
  ok: boolean;
  batchId: string;
  source?: {
    messageId?: string;
  };
  summary: {
    total: number;
    completed: number;
    failed: number;
    skipped: number;
    stoppedOnFailure: boolean;
  };
  items: BatchResultItem[];
  warnings?: string[];
}

export interface ProposalResultEnvelope {
  type: 'proposal_result';
  proposalId: string;
  status: 'created' | 'approved' | 'applied' | 'rejected';
  summary: string;
  affectedFiles?: string[];
}

export interface CachedReferenceEnvelope {
  type: 'cached_reference';
  cacheId: string;
  summary: string;
  totalSizeChars?: number;
  preview?: string;
}

export interface ExecutionErrorEnvelope {
  type: 'execution_error';
  error: {
    code: string;
    summary: string;
    retryable: boolean;
    details?: unknown;
  };
}

export type ResultEnvelope =
  | InlineToolResultEnvelope
  | BatchResultEnvelope
  | ProposalResultEnvelope
  | CachedReferenceEnvelope
  | ExecutionErrorEnvelope;
