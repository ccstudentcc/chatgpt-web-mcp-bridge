import { z } from 'zod';

export const RiskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);

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
  enabled: z.boolean()
});
