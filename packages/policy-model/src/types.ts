import type { PolicyAction, RiskLevel } from '@cwmb/shared-utils';

export interface ToolDecision {
  callId: string;
  action: PolicyAction;
  reasonCode: string;
  risk: RiskLevel;
  message: string;
}
