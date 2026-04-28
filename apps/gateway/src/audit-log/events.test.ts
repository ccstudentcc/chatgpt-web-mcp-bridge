import { describe, expect, it } from 'vitest';
import { createToolDecision } from '@cwmb/policy-model';
import type { ExecuteRequest } from '@cwmb/tool-contracts';
import { createAuditRequestContext, createExecutionCompletedAuditEvent, createExecutionFinishedAuditEvent, createPolicyDeniedAuditEvent } from './events.js';

describe('audit-log events', () => {
  it('shapes policy denial events around stable decision and request concepts', () => {
    const request = createRequest();
    const auditRequest = createAuditRequestContext({
      request,
      executionId: 'req-1.1700000000000'
    });

    const event = createPolicyDeniedAuditEvent({
      ts: '2026-04-28T00:00:00.000Z',
      request: auditRequest,
      call: request.calls[0],
      index: 0,
      decision: createToolDecision({
        callId: 'call-1',
        action: 'deny',
        reasonCode: 'TOOL_DISABLED',
        risk: 'high',
        message: 'write_file requires allowWrite=true in gateway config.'
      }),
      response: {
        ok: false,
        tool: 'write_file',
        error: {
          code: 'TOOL_DISABLED',
          message: 'write_file requires allowWrite=true in gateway config.'
        },
        warnings: [],
        durationMs: 2
      },
      durationMs: 2
    });

    expect(event).toMatchObject({
      category: 'policy',
      event: 'call_denied',
      request: {
        requestId: 'req-1',
        executionId: 'req-1.1700000000000',
        operatorIntent: 'auto_flow',
        executionProfile: 'legacy_auto'
      },
      call: {
        index: 0,
        callId: 'call-1',
        tool: 'write_file',
        risk: 'high'
      },
      decision: {
        action: 'deny',
        reasonCode: 'TOOL_DISABLED',
        risk: 'high'
      },
      outcome: {
        status: 'denied',
        durationMs: 2,
        warningCount: 0
      }
    });
  });

  it('shapes lifecycle events without forcing later diagnostics to infer batch status', () => {
    const event = createExecutionFinishedAuditEvent({
      ts: '2026-04-28T00:00:00.000Z',
      request: createAuditRequestContext({
        request: createRequest(),
        executionId: 'req-1.1700000000000'
      }),
      continueOnFailure: false,
      warnings: ['Result truncated from 200000 chars.'],
      callOutcomes: [
        { index: 0, callId: 'call-1', tool: 'read_file', status: 'completed' },
        { index: 1, callId: 'call-2', tool: 'write_file', status: 'denied', reasonCode: 'TOOL_DISABLED' },
        { index: 2, callId: 'call-3', tool: 'list_directory', status: 'skipped', reasonCode: 'SKIPPED_AFTER_BATCH_FAILURE' }
      ]
    });

    expect(event).toMatchObject({
      category: 'lifecycle',
      event: 'execution_finished',
      summary: {
        totalCalls: 3,
        completedCalls: 1,
        failedCalls: 0,
        deniedCalls: 1,
        skippedCalls: 1,
        stoppedOnFailure: true,
        continueOnFailure: false,
        warnings: ['Result truncated from 200000 chars.'],
        warningCount: 1
      },
      calls: [
        { index: 0, callId: 'call-1', tool: 'read_file', status: 'completed' },
        { index: 1, callId: 'call-2', tool: 'write_file', status: 'denied', reasonCode: 'TOOL_DISABLED' },
        { index: 2, callId: 'call-3', tool: 'list_directory', status: 'skipped', reasonCode: 'SKIPPED_AFTER_BATCH_FAILURE' }
      ]
    });
  });

  it('summarizes execution results without persisting raw result text', () => {
    const request = createRequest();
    const event = createExecutionCompletedAuditEvent({
      ts: '2026-04-28T00:00:00.000Z',
      request: createAuditRequestContext({
        request,
        executionId: 'req-1.1700000000000'
      }),
      call: request.calls[0],
      index: 0,
      decision: createToolDecision({
        callId: 'call-1',
        action: 'execute',
        reasonCode: 'ALLOWED_CURRENT_TOOL',
        risk: 'low',
        message: 'Allowed by the current gateway policy.'
      }),
      response: {
        ok: true,
        tool: 'read_file',
        result: { text: 'password=hunter2' },
        warnings: [],
        durationMs: 3
      },
      durationMs: 3
    });

    expect(event).toMatchObject({
      category: 'execution',
      event: 'call_completed',
      outcome: {
        status: 'completed',
        durationMs: 3,
        warningCount: 0,
        resultSummary: {
          type: 'object',
          entries: {
            text: {
              type: 'string',
              chars: 16,
              redacted: true
            }
          }
        }
      }
    });
    expect(JSON.stringify(event)).not.toContain('hunter2');
  });
});

function createRequest(): ExecuteRequest {
  return {
    requestId: 'req-1',
    turnContext: {
      source: {
        page: 'chatgpt',
        conversationId: 'conv-1',
        assistantTurnId: 'assistant-1'
      },
      detectionSource: 'assistant_message_scan',
      requestInjection: {
        channel: 'hidden_request_prompt',
        promptVersion: 'bridge-v1'
      },
      executionProfile: 'legacy_auto'
    },
    operatorIntent: 'auto_flow',
    calls: [
      {
        callId: 'call-1',
        tool: 'write_file',
        args: {
          path: 'docs/example.md',
          content: 'hello'
        },
        duplicateGuardKey: 'dup-1'
      }
    ]
  };
}
