import { ToolDecisionSchema } from '@cwmb/policy-model';
import { ResultEnvelopeSchema } from '@cwmb/result-model';
import {
  ExecutionProfileSchema,
  GatewayShellInfoSchema,
  OperatorIntentSchema,
  PolicyActionSchema,
  RiskLevelSchema,
  ToolCallErrorSchema,
  ToolSourceSchema
} from '@cwmb/shared-utils';
import { TurnContextSchema } from '@cwmb/turn-model';
import { z } from 'zod';

export const CatalogSourceSchema = z.enum(['live', 'cache']);

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

export const GatewayHealthContractSchema = z.object({
  ok: z.literal(true),
  version: z.string().min(1),
  platform: z.string().min(1),
  host: z.string().min(1),
  port: z.number().int().nonnegative(),
  workspaceRoot: z.string().min(1),
  shell: GatewayShellInfoSchema,
  trustedLocalMode: z.boolean(),
  autoExecuteLowRisk: z.boolean(),
  autoInsertResult: z.boolean(),
  autoSendResult: z.boolean(),
  maxToolRounds: z.number().int()
});

export const GatewayRuntimeSnapshotSchema = z.object({
  health: GatewayHealthContractSchema.optional(),
  catalog: CatalogContractSchema.optional(),
  catalogSource: CatalogSourceSchema.optional()
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

export const ExecuteResponseSchema = z.object({
  requestId: z.string().min(1),
  executionId: z.string().min(1),
  decisions: z.array(ToolDecisionSchema),
  result: ResultEnvelopeSchema
});

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

export const ToolCallSuccessSchema = z.object({
  ok: z.literal(true),
  tool: z.string().min(1),
  result: z.unknown(),
  warnings: z.array(z.string()),
  durationMs: z.number().nonnegative()
});

export const ToolCallFailureSchema = z.object({
  ok: z.literal(false),
  tool: z.string().min(1),
  error: ToolCallErrorSchema,
  warnings: z.array(z.string()),
  durationMs: z.number().nonnegative()
});

export const ToolCallResponseSchema = z.union([ToolCallSuccessSchema, ToolCallFailureSchema]);
