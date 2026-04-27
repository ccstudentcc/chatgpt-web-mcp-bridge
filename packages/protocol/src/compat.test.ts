import { describe, expect, it } from 'vitest';
import {
  createExecuteRequestFromToolCallRequest,
  createExecuteResponse,
  createExecutionErrorEnvelopeFromLegacyResponse,
  createInlineToolResultEnvelopeFromLegacyResponse,
  createToolDecision
} from './compat.js';

describe('createExecuteRequestFromToolCallRequest', () => {
  it('maps the legacy single-call request into a batch-first execute request', () => {
    expect(createExecuteRequestFromToolCallRequest({
      tool: 'read_file',
      args: { path: 'README.md' },
      source: {
        page: 'chatgpt',
        conversationId: 'conv-1',
        callId: 'call-1'
      }
    })).toEqual({
      requestId: 'legacy-call-1',
      turnContext: {
        source: {
          page: 'chatgpt',
          conversationId: 'conv-1',
          assistantTurnId: undefined
        },
        detectionSource: 'assistant_message_scan',
        requestInjection: {
          channel: 'hidden_request_prompt',
          promptVersion: 'legacy-v0.1'
        },
        executionProfile: 'legacy_auto'
      },
      operatorIntent: 'auto_flow',
      calls: [
        {
          callId: 'call-1',
          tool: 'read_file',
          args: { path: 'README.md' },
          duplicateGuardKey: 'legacy-call-1'
        }
      ]
    });
  });
});

describe('legacy execute response helpers', () => {
  it('creates explicit decision and inline result metadata for successful legacy responses', () => {
    const decision = createToolDecision({
      callId: 'call-1',
      action: 'execute',
      reasonCode: 'ALLOWED_CURRENT_TOOL',
      risk: 'low',
      message: 'Allowed by the current gateway policy.'
    });
    const result = createInlineToolResultEnvelopeFromLegacyResponse({
      ok: true,
      tool: 'read_file',
      result: { text: 'hello' },
      warnings: [],
      durationMs: 12
    }, 'call-1');

    expect(createExecuteResponse({
      requestId: 'legacy-call-1',
      executionId: 'legacy-call-1.exec',
      decisions: [decision],
      result
    })).toMatchObject({
      requestId: 'legacy-call-1',
      decisions: [{ action: 'execute' }],
      result: {
        type: 'inline_tool_result',
        tool: 'read_file'
      }
    });
  });

  it('creates retryability-aware execution errors for failed legacy responses', () => {
    expect(createExecutionErrorEnvelopeFromLegacyResponse({
      ok: false,
      tool: 'write_file',
      error: {
        code: 'BLOCKED_PATH',
        message: 'Blocked by policy.'
      },
      warnings: [],
      durationMs: 4
    })).toEqual({
      type: 'execution_error',
      error: {
        code: 'BLOCKED_PATH',
        summary: 'Blocked by policy.',
        retryable: false,
        details: undefined
      }
    });
  });
});
