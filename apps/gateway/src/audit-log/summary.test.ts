import { describe, expect, it } from 'vitest';
import { summarizeAuditArgs, summarizeAuditLogEntries, summarizeAuditResult } from './summary.js';

describe('audit-log summary', () => {
  it('keeps safe literal path-like args while summarizing other values structurally', () => {
    expect(summarizeAuditArgs({
      path: 'docs/example.md',
      content: 'hello world'
    })).toMatchObject({
      type: 'object',
      entries: {
        path: {
          type: 'string',
          value: 'docs/example.md'
        },
        content: {
          type: 'string',
          chars: 11
        }
      }
    });
  });

  it('never keeps raw result text when summarizing durable audit truth', () => {
    const summary = summarizeAuditResult({
      text: 'secret_token=abc123'
    });

    expect(summary).toMatchObject({
      type: 'object',
      entries: {
        text: {
          type: 'string',
          chars: 19,
          redacted: true
        }
      }
    });
    expect(JSON.stringify(summary)).not.toContain('abc123');
  });

  it('aggregates audit entries into redacted diagnostics-friendly counts', () => {
    const summary = summarizeAuditLogEntries([
      {
        ts: '2026-04-28T00:00:00.000Z',
        category: 'execution',
        event: 'call_completed',
        request: {
          requestId: 'req-1',
          executionId: 'exec-1',
          operatorIntent: 'auto_flow',
          detectionSource: 'assistant_message_scan',
          executionProfile: 'legacy_auto',
          requestInjection: {
            channel: 'hidden_request_prompt',
            promptVersion: 'bridge-v1'
          },
          source: {
            page: 'chatgpt',
            conversationId: 'conv-1',
            assistantTurnId: 'assistant-1'
          }
        },
        call: {
          index: 0,
          callId: 'call-1',
          tool: 'read_file',
          risk: 'low'
        },
        decision: {
          action: 'execute',
          reasonCode: 'ALLOWED_CURRENT_TOOL',
          risk: 'low'
        },
        argsSummary: {
          type: 'object',
          keys: [],
          entries: {}
        },
        outcome: {
          status: 'completed',
          durationMs: 1,
          warnings: [],
          warningCount: 0,
          resultSummary: {
            type: 'object',
            keys: [],
            entries: {}
          }
        }
      },
      {
        ts: '2026-04-28T00:00:01.000Z',
        category: 'lifecycle',
        event: 'execution_finished',
        request: {
          requestId: 'req-1',
          executionId: 'exec-1',
          operatorIntent: 'auto_flow',
          detectionSource: 'assistant_message_scan',
          executionProfile: 'legacy_auto',
          requestInjection: {
            channel: 'hidden_request_prompt',
            promptVersion: 'bridge-v1'
          },
          source: {
            page: 'chatgpt',
            conversationId: 'conv-1',
            assistantTurnId: 'assistant-1'
          }
        },
        summary: {
          totalCalls: 1,
          completedCalls: 1,
          failedCalls: 0,
          deniedCalls: 0,
          skippedCalls: 0,
          stoppedOnFailure: false,
          continueOnFailure: false,
          warnings: ['warning'],
          warningCount: 1
        },
        calls: [
          {
            index: 0,
            callId: 'call-1',
            tool: 'read_file',
            status: 'completed'
          }
        ]
      }
    ]);

    expect(summary).toMatchObject({
      redacted: true,
      totalEntries: 2,
      warningEventCount: 1,
      categories: {
        execution: 1,
        lifecycle: 1
      },
      events: {
        callCompleted: 1,
        executionFinished: 1
      },
      latestLifecycle: {
        totalCalls: 1,
        warningCount: 1
      }
    });
  });
});
