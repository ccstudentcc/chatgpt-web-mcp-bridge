import type {
  DetectionSource,
  ExecutionProfile,
  OperatorIntent,
  PolicyAction,
  RiskLevel
} from '@cwmb/shared-utils';
import type { RequestInjectionContext, TurnSource } from '@cwmb/turn-model';

export interface AuditRequestContext {
  requestId: string;
  executionId: string;
  operatorIntent: OperatorIntent;
  detectionSource: DetectionSource;
  executionProfile: ExecutionProfile;
  requestInjection: RequestInjectionContext;
  source: TurnSource;
}

export interface AuditCallContext {
  index: number;
  callId: string;
  tool: string;
  risk?: RiskLevel;
}

export interface AuditDecisionSummary {
  action: PolicyAction;
  reasonCode: string;
  risk: RiskLevel;
}

export type AuditValueSummary =
  | { type: 'null' }
  | { type: 'undefined' }
  | { type: 'boolean'; value: boolean }
  | { type: 'number'; value: number }
  | { type: 'string'; chars: number; value?: string; redacted?: boolean; blocked?: boolean }
  | { type: 'array'; length: number; items: AuditValueSummary[]; truncatedItems?: number; maxDepthReached?: boolean }
  | { type: 'object'; keys: string[]; entries: Record<string, AuditValueSummary>; truncatedKeys?: number; maxDepthReached?: boolean };

interface AuditEventBase {
  ts: string;
  category: 'execution' | 'policy' | 'lifecycle';
  event: 'call_completed' | 'call_failed' | 'call_denied' | 'execution_finished';
  request: AuditRequestContext;
}

export interface AuditPolicyDeniedEvent extends AuditEventBase {
  category: 'policy';
  event: 'call_denied';
  call: AuditCallContext;
  decision: AuditDecisionSummary;
  argsSummary: AuditValueSummary;
  outcome: {
    status: 'denied';
    durationMs: number;
    warnings: string[];
    warningCount: number;
  };
}

export interface AuditExecutionCompletedEvent extends AuditEventBase {
  category: 'execution';
  event: 'call_completed';
  call: AuditCallContext;
  decision: AuditDecisionSummary;
  argsSummary: AuditValueSummary;
  outcome: {
    status: 'completed';
    durationMs: number;
    warnings: string[];
    warningCount: number;
    resultSummary: AuditValueSummary;
  };
}

export interface AuditExecutionFailedEvent extends AuditEventBase {
  category: 'execution';
  event: 'call_failed';
  call: AuditCallContext;
  decision: AuditDecisionSummary;
  argsSummary: AuditValueSummary;
  outcome: {
    status: 'failed';
    durationMs: number;
    warnings: string[];
    warningCount: number;
    error: {
      code: string;
      retryable: boolean;
    };
  };
}

export interface AuditExecutionFinishedEvent extends AuditEventBase {
  category: 'lifecycle';
  event: 'execution_finished';
  summary: {
    totalCalls: number;
    completedCalls: number;
    failedCalls: number;
    deniedCalls: number;
    skippedCalls: number;
    stoppedOnFailure: boolean;
    continueOnFailure: boolean;
    warnings: string[];
    warningCount: number;
  };
  calls: Array<{
    index: number;
    callId: string;
    tool: string;
    status: 'completed' | 'failed' | 'denied' | 'skipped';
    reasonCode?: string;
  }>;
}

export interface AuditLogSummary {
  redacted: true;
  totalEntries: number;
  warningEventCount: number;
  categories: {
    execution: number;
    policy: number;
    lifecycle: number;
  };
  events: {
    callCompleted: number;
    callFailed: number;
    callDenied: number;
    executionFinished: number;
  };
  latestEventAt?: string;
  latestLifecycle?: {
    totalCalls: number;
    completedCalls: number;
    failedCalls: number;
    deniedCalls: number;
    skippedCalls: number;
    stoppedOnFailure: boolean;
    continueOnFailure: boolean;
    warningCount: number;
  };
}

export type AuditLogEntry =
  | AuditPolicyDeniedEvent
  | AuditExecutionCompletedEvent
  | AuditExecutionFailedEvent
  | AuditExecutionFinishedEvent;

export interface Logger {
  write(entry: AuditLogEntry): Promise<void>;
}
