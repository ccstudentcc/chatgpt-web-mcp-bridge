import { z } from 'zod';

export const RiskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);
export const ToolSourceSchema = z.enum(['builtin', 'external']);
export const ExecutionProfileSchema = z.enum(['legacy_auto', 'reviewed', 'yolo']);
export const DetectionSourceSchema = z.enum(['assistant_message_scan', 'startup_history_rescan', 'manual_retry']);
export const OperatorIntentSchema = z.enum(['auto_flow', 'manual_run', 'manual_retry', 'manual_approve']);
export const PolicyActionSchema = z.enum(['execute', 'proposal_required', 'confirmation_required', 'deny', 'skip']);

export const ToolCallSourceSchema = z.object({
  page: z.literal('chatgpt'),
  conversationId: z.string().optional(),
  callId: z.string().min(8)
});

export const ToolCallRequestSchema = z.object({
  tool: z.string().min(1),
  args: z.record(z.string(), z.unknown()).default({}),
  source: ToolCallSourceSchema
});

export const McpBlockSchema = z.object({
  tool: z.string().min(1),
  args: z.record(z.string(), z.unknown()).default({})
});

export const ToolDescriptorSchema = z.object({
  name: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  risk: RiskLevelSchema,
  requiresConfirmation: z.boolean(),
  enabled: z.boolean(),
  exampleArgs: z.record(z.string(), z.unknown()).default({})
});

export const CatalogToolDescriptorSchema = ToolDescriptorSchema.extend({
  displayName: z.string().min(1),
  source: ToolSourceSchema,
  schemaId: z.string().min(1).optional(),
  availability: z
    .object({
      legacy_auto: PolicyActionSchema.optional(),
      reviewed: PolicyActionSchema.optional(),
      yolo: PolicyActionSchema.optional()
    })
    .optional()
});

export const CatalogContractSchema = z.object({
  catalogVersion: z.string().min(1),
  generatedAt: z.string().datetime(),
  workspaceRoot: z.string().min(1).optional(),
  tools: z.array(CatalogToolDescriptorSchema)
});

export const TurnSourceSchema = z.object({
  page: z.literal('chatgpt'),
  conversationId: z.string().optional(),
  assistantTurnId: z.string().min(1).optional()
});

export const RequestInjectionContextSchema = z.object({
  channel: z.enum(['hidden_request_prompt', 'manual_prompt']),
  promptVersion: z.string().min(1).optional()
});

export const TurnContextSchema = z.object({
  source: TurnSourceSchema,
  detectionSource: DetectionSourceSchema,
  requestInjection: RequestInjectionContextSchema,
  executionProfile: ExecutionProfileSchema
});

export const ExecuteToolCallSchema = z.object({
  callId: z.string().min(1),
  tool: z.string().min(1),
  args: z.record(z.string(), z.unknown()).default({}),
  duplicateGuardKey: z.string().min(1).optional()
});

export const ExecuteRequestSchema = z.object({
  requestId: z.string().min(1),
  turnContext: TurnContextSchema,
  operatorIntent: OperatorIntentSchema,
  calls: z.array(ExecuteToolCallSchema).min(1)
});

export const ToolDecisionSchema = z.object({
  callId: z.string().min(1),
  action: PolicyActionSchema,
  reasonCode: z.string().min(1),
  risk: RiskLevelSchema,
  message: z.string().min(1)
});

export const InlineToolResultEnvelopeSchema = z.object({
  type: z.literal('inline_tool_result'),
  callId: z.string().min(1),
  tool: z.string().min(1),
  ok: z.boolean(),
  output: z.unknown(),
  summary: z.string().min(1),
  warnings: z.array(z.string()).optional()
});

export const BatchResultEnvelopeSchema = z.object({
  type: z.literal('tool_result_batch'),
  ok: z.boolean(),
  batchId: z.string().min(1),
  summary: z.object({
    total: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    stoppedOnFailure: z.boolean()
  }),
  items: z.array(z.unknown()),
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

export const ExecuteResponseSchema = z.object({
  requestId: z.string().min(1),
  executionId: z.string().min(1),
  decisions: z.array(ToolDecisionSchema),
  result: ResultEnvelopeSchema
});
