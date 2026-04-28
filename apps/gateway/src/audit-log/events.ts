import {
  createExecutionErrorEnvelopeFromLegacyResponse,
  type ExecuteRequest,
  type ToolCallFailure,
  type ToolCallSuccess,
  type ToolDecision
} from '@cwmb/protocol';
import type { AuditCallContext, AuditLogEntry, AuditRequestContext } from './types.js';
import { summarizeAuditArgs, summarizeAuditResult } from './summary.js';

interface CreateAuditRequestContextOptions {
  request: ExecuteRequest;
  executionId: string;
}

interface CreateCallAuditEventOptions {
  ts: string;
  request: AuditRequestContext;
  call: ExecuteRequest['calls'][number];
  index: number;
  decision: ToolDecision;
  durationMs: number;
}

interface CreateCompletedAuditEventOptions extends CreateCallAuditEventOptions {
  response: ToolCallSuccess;
}

interface CreateFailedAuditEventOptions extends CreateCallAuditEventOptions {
  response: ToolCallFailure;
}

interface CreateExecutionFinishedAuditEventOptions {
  ts: string;
  request: AuditRequestContext;
  continueOnFailure: boolean;
  callOutcomes: Array<{
    index: number;
    callId: string;
    tool: string;
    status: 'completed' | 'failed' | 'denied' | 'skipped';
    reasonCode?: string;
  }>;
  warnings: string[];
}

export function createAuditRequestContext(options: CreateAuditRequestContextOptions): AuditRequestContext {
  return {
    requestId: options.request.requestId,
    executionId: options.executionId,
    operatorIntent: options.request.operatorIntent,
    detectionSource: options.request.turnContext.detectionSource,
    executionProfile: options.request.turnContext.executionProfile,
    requestInjection: options.request.turnContext.requestInjection,
    source: options.request.turnContext.source
  };
}

export function createPolicyDeniedAuditEvent(options: CreateFailedAuditEventOptions): AuditLogEntry {
  return {
    ts: options.ts,
    category: 'policy',
    event: 'call_denied',
    request: options.request,
    call: createCallContext(options.call, options.index, options.decision),
    decision: toDecisionSummary(options.decision),
    argsSummary: summarizeAuditArgs(options.call.args),
    outcome: {
      status: 'denied',
      durationMs: options.durationMs,
      warnings: options.response.warnings,
      warningCount: options.response.warnings.length
    }
  };
}

export function createExecutionCompletedAuditEvent(options: CreateCompletedAuditEventOptions): AuditLogEntry {
  return {
    ts: options.ts,
    category: 'execution',
    event: 'call_completed',
    request: options.request,
    call: createCallContext(options.call, options.index, options.decision),
    decision: toDecisionSummary(options.decision),
    argsSummary: summarizeAuditArgs(options.call.args),
    outcome: {
      status: 'completed',
      durationMs: options.durationMs,
      warnings: options.response.warnings,
      warningCount: options.response.warnings.length,
      resultSummary: summarizeAuditResult(options.response.result)
    }
  };
}

export function createExecutionFailedAuditEvent(options: CreateFailedAuditEventOptions): AuditLogEntry {
  const error = createExecutionErrorEnvelopeFromLegacyResponse(options.response).error;

  return {
    ts: options.ts,
    category: 'execution',
    event: 'call_failed',
    request: options.request,
    call: createCallContext(options.call, options.index, options.decision),
    decision: toDecisionSummary(options.decision),
    argsSummary: summarizeAuditArgs(options.call.args),
    outcome: {
      status: 'failed',
      durationMs: options.durationMs,
      warnings: options.response.warnings,
      warningCount: options.response.warnings.length,
      error: {
        code: error.code,
        retryable: error.retryable
      }
    }
  };
}

export function createExecutionFinishedAuditEvent(options: CreateExecutionFinishedAuditEventOptions): AuditLogEntry {
  const completedCalls = options.callOutcomes.filter((outcome) => outcome.status === 'completed').length;
  const deniedCalls = options.callOutcomes.filter((outcome) => outcome.status === 'denied').length;
  const failedCalls = options.callOutcomes.filter((outcome) => outcome.status === 'failed').length;
  const skippedCalls = options.callOutcomes.filter((outcome) => outcome.status === 'skipped').length;

  return {
    ts: options.ts,
    category: 'lifecycle',
    event: 'execution_finished',
    request: options.request,
    summary: {
      totalCalls: options.callOutcomes.length,
      completedCalls,
      failedCalls,
      deniedCalls,
      skippedCalls,
      stoppedOnFailure: skippedCalls > 0,
      continueOnFailure: options.continueOnFailure,
      warnings: options.warnings,
      warningCount: options.warnings.length
    },
    calls: options.callOutcomes
  };
}

function createCallContext(
  call: ExecuteRequest['calls'][number],
  index: number,
  decision: ToolDecision
): AuditCallContext {
  return {
    index,
    callId: call.callId,
    tool: call.tool,
    risk: decision.risk
  };
}

function toDecisionSummary(decision: ToolDecision) {
  return {
    action: decision.action,
    reasonCode: decision.reasonCode,
    risk: decision.risk
  };
}
