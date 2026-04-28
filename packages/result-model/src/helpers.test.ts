import { describe, expect, it } from 'vitest';
import {
  createBatchResultEnvelope,
  createExecutionErrorEnvelopeFromLegacyResponse,
  createInlineToolResultEnvelopeFromLegacyResponse
} from './helpers.js';

describe('legacy result helpers', () => {
  it('creates inline envelopes for successful legacy responses', () => {
    expect(createInlineToolResultEnvelopeFromLegacyResponse({
      ok: true,
      tool: 'read_file',
      result: { text: 'hello' },
      warnings: [],
      durationMs: 12
    }, 'call-1')).toMatchObject({
      type: 'inline_tool_result',
      callId: 'call-1',
      tool: 'read_file'
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

  it('summarizes mixed batch outcomes and keeps optional source metadata', () => {
    expect(createBatchResultEnvelope({
      batchId: 'batch-1',
      messageId: 'assistant-1',
      stoppedOnFailure: true,
      warnings: ['Result truncated from 1000 chars.'],
      items: [
        {
          index: 0,
          tool: 'read_file',
          callId: 'call-read',
          ok: true,
          result: { text: 'hello' },
          warnings: [],
          durationMs: 2
        },
        {
          index: 1,
          tool: 'grep_files',
          callId: 'call-grep',
          ok: false,
          error: {
            code: 'BLOCKED_PATH',
            message: 'Blocked path.'
          },
          warnings: [],
          durationMs: 3
        },
        {
          index: 2,
          tool: 'list_directory',
          callId: 'call-list',
          status: 'skipped',
          reason: 'SKIPPED_AFTER_BATCH_FAILURE'
        }
      ]
    })).toMatchObject({
      type: 'tool_result_batch',
      ok: false,
      source: { messageId: 'assistant-1' },
      summary: {
        total: 3,
        completed: 1,
        failed: 1,
        skipped: 1,
        stoppedOnFailure: true
      }
    });
  });
});
