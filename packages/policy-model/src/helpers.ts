import type { PolicyAction, RiskLevel } from '@cwmb/shared-utils';
import type { ToolDecision } from './types.js';

interface CreateToolDecisionOptions {
  callId: string;
  action: PolicyAction;
  reasonCode: string;
  risk: RiskLevel;
  message: string;
}

export function createToolDecision(options: CreateToolDecisionOptions): ToolDecision {
  return {
    callId: options.callId,
    action: options.action,
    reasonCode: options.reasonCode,
    risk: options.risk,
    message: options.message
  };
}
