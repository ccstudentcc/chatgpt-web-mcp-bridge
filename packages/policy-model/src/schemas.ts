import { PolicyActionSchema, RiskLevelSchema } from '@cwmb/shared-utils';
import { z } from 'zod';

export const ToolDecisionSchema = z.object({
  callId: z.string().min(1),
  action: PolicyActionSchema,
  reasonCode: z.string().min(1),
  risk: RiskLevelSchema,
  message: z.string().min(1)
});
