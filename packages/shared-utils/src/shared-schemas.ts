import { z } from 'zod';

export const RiskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);
export const ToolSourceSchema = z.enum(['builtin', 'external']);
export const ExecutionProfileSchema = z.enum(['legacy_auto', 'reviewed', 'yolo']);
export const DetectionSourceSchema = z.enum(['assistant_message_scan', 'startup_history_rescan', 'manual_retry']);
export const OperatorIntentSchema = z.enum(['auto_flow', 'manual_run', 'manual_retry', 'manual_approve']);
export const PolicyActionSchema = z.enum(['execute', 'proposal_required', 'confirmation_required', 'deny', 'skip']);

export const GatewayShellInfoSchema = z.object({
  preferred: z.literal('pwsh'),
  resolved: z.union([z.literal('pwsh'), z.literal('powershell.exe'), z.null()]),
  available: z.boolean(),
  version: z.string().min(1).optional()
});

export const ToolCallErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.unknown().optional()
});
