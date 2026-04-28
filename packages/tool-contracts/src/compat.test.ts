import { describe, expect, it } from 'vitest';
import { createToolDecision } from '@cwmb/policy-model';
import { createInlineToolResultEnvelopeFromLegacyResponse } from '@cwmb/result-model';
import {
  createExecuteRequestFromToolCallRequest,
  createExecuteResponse,
  createLegacyToolCallRequest,
  getExecuteResponseCompat
} from './compat.js';

describe('createLegacyToolCallRequest', () => {
  it('builds the current single-call bridge request shape from minimal inputs', () => {
    expect(createLegacyToolCallRequest({
      tool: 'read_file',
      args: { path: 'README.md' },
      callId: 'call-1',
      conversationId: 'conv-1'
    })).toEqual({
      tool: 'read_file',
      args: { path: 'README.md' },
      source: {
        page: 'chatgpt',
        conversationId: 'conv-1',
        callId: 'call-1'
      }
    });
  });
});

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
  it('creates explicit decision metadata for successful legacy responses', () => {
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

  it('extracts execute-response compat metadata from a mixed legacy payload', () => {
    const mixedPayload = {
      ok: true,
      tool: 'read_file',
      result: { text: 'hello' },
      warnings: [],
      durationMs: 2,
      execute: {
        requestId: 'legacy-call-1',
        executionId: 'legacy-call-1.exec',
        decisions: [
          {
            callId: 'call-1',
            action: 'execute',
            reasonCode: 'ALLOWED_CURRENT_TOOL',
            risk: 'low',
            message: 'Allowed by the current gateway policy.'
          }
        ],
        result: {
          type: 'inline_tool_result',
          callId: 'call-1',
          tool: 'read_file',
          ok: true,
          output: { text: 'hello' },
          summary: 'Tool read_file completed successfully.'
        }
      }
    };

    expect(getExecuteResponseCompat(mixedPayload)).toMatchObject({
      requestId: 'legacy-call-1',
      executionId: 'legacy-call-1.exec',
      decisions: [{ action: 'execute' }],
      result: { type: 'inline_tool_result' }
    });
  });

  it('rejects flat top-level execute metadata that is no longer part of the live compat surface', () => {
    expect(getExecuteResponseCompat({
      requestId: 'legacy-call-2',
      executionId: 'legacy-call-2.exec',
      decisions: [],
      result: {
        type: 'execution_error',
        error: {
          code: 'TOOL_DISABLED',
          summary: 'Tool disabled: write_file',
          retryable: false
        }
      }
    })).toBeNull();
  });
});
