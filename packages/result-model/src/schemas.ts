import { ToolCallErrorSchema } from '@cwmb/shared-utils';
import { z } from 'zod';

export const InlineToolResultEnvelopeSchema = z.object({
  type: z.literal('inline_tool_result'),
  callId: z.string().min(1),
  tool: z.string().min(1),
  ok: z.boolean(),
  output: z.unknown(),
  summary: z.string().min(1),
  warnings: z.array(z.string()).optional()
});

export const BatchResultSuccessItemSchema = z.object({
  index: z.number().int().nonnegative(),
  tool: z.string().min(1),
  callId: z.string().min(1),
  ok: z.literal(true),
  result: z.unknown(),
  warnings: z.array(z.string()),
  durationMs: z.number().nonnegative()
});

export const BatchResultFailureItemSchema = z.object({
  index: z.number().int().nonnegative(),
  tool: z.string().min(1),
  callId: z.string().min(1),
  ok: z.literal(false),
  error: ToolCallErrorSchema,
  warnings: z.array(z.string()),
  durationMs: z.number().nonnegative()
});

export const BatchResultSkippedItemSchema = z.object({
  index: z.number().int().nonnegative(),
  tool: z.string().min(1),
  callId: z.string().min(1),
  status: z.literal('skipped'),
  reason: z.literal('SKIPPED_AFTER_BATCH_FAILURE')
});

export const BatchResultItemSchema = z.union([
  BatchResultSuccessItemSchema,
  BatchResultFailureItemSchema,
  BatchResultSkippedItemSchema
]);

export const BatchResultEnvelopeSchema = z.object({
  type: z.literal('tool_result_batch'),
  ok: z.boolean(),
  batchId: z.string().min(1),
  source: z.object({
    messageId: z.string().min(1).optional()
  }).optional(),
  summary: z.object({
    total: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    stoppedOnFailure: z.boolean()
  }),
  items: z.array(BatchResultItemSchema),
  warnings: z.array(z.string()).optional()
});

export const ProposalResultEnvelopeSchema = z.object({
  type: z.literal('proposal_result'),
  proposalId: z.string().min(1),
  status: z.enum(['created', 'approved', 'applied', 'rejected']),
  summary: z.string().min(1),
  affectedFiles: z.array(z.string()).optional()
});

export const CachedReferenceEnvelopeSchema = z.object({
  type: z.literal('cached_reference'),
  cacheId: z.string().min(1),
  summary: z.string().min(1),
  totalSizeChars: z.number().int().positive().optional(),
  preview: z.string().optional()
});

export const ExecutionErrorEnvelopeSchema = z.object({
  type: z.literal('execution_error'),
  error: z.object({
    code: z.string().min(1),
    summary: z.string().min(1),
    retryable: z.boolean(),
    details: z.unknown().optional()
  })
});

export const ResultEnvelopeSchema = z.discriminatedUnion('type', [
  InlineToolResultEnvelopeSchema,
  BatchResultEnvelopeSchema,
  ProposalResultEnvelopeSchema,
  CachedReferenceEnvelopeSchema,
  ExecutionErrorEnvelopeSchema
]);
