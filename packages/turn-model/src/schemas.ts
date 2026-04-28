import { DetectionSourceSchema, ExecutionProfileSchema } from '@cwmb/shared-utils';
import { z } from 'zod';

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

export const McpBlockSchema = z.object({
  tool: z.string().min(1),
  args: z.record(z.string(), z.unknown()).default({})
});
