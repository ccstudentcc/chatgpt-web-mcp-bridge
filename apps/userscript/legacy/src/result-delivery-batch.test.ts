import { describe, expect, it } from 'vitest';
import { describeBatchFailure, deriveBatchDeliveryOutcome } from '../../extension/src/result-delivery/index.js';

describe('describeBatchFailure', () => {
  it('describes stopped-on-failure batches from one owner path', () => {
    const presentation = describeBatchFailure([
      {
        index: 0,
        tool: 'read_file',
        callId: 'call-read',
        ok: false,
        error: { code: 'BLOCKED_PATH', message: 'Blocked path.' },
        warnings: [],
        durationMs: 3
      }
    ], true, 1);

    expect(presentation).toEqual({
      lastError: 'Batch stopped after `read_file` failed: Blocked path.',
      logMessage: 'Batch stopped after a failure in read_file.'
    });
  });

  it('describes partially failed batches without inventing execution semantics', () => {
    const presentation = describeBatchFailure([
      {
        index: 0,
        tool: 'read_file',
        callId: 'call-read',
        ok: false,
        error: { code: 'BLOCKED_PATH', message: 'Blocked path.' },
        warnings: [],
        durationMs: 3
      }
    ], false, 2);

    expect(presentation).toEqual({
      lastError: 'Batch completed with failures. First failed tool: `read_file` (Blocked path.)',
      logMessage: 'Batch completed with 2 failed tool call(s).'
    });
  });
});

describe('deriveBatchDeliveryOutcome', () => {
  it('keeps retryable batch recovery and delivery-ready status on one owner path', () => {
    const outcome = deriveBatchDeliveryOutcome({
      response: {
        type: 'tool_result_batch',
        ok: false,
        batchId: 'batch-1',
        items: [
          {
            index: 0,
            tool: 'read_file',
            callId: 'call-read',
            ok: false,
            error: { code: 'BLOCKED_PATH', message: 'Blocked path.' },
            warnings: [],
            durationMs: 3
          }
        ],
        warnings: [],
        summary: {
          total: 2,
          completed: 0,
          failed: 1,
          skipped: 1,
          stoppedOnFailure: true
        }
      },
      blocks: ['first', 'second'],
      batchId: 'batch-1',
      messageId: 'message-1'
    });

    expect(outcome).toEqual({
      readyStatus: 'batch_stopped_on_failure',
      retryableBatch: {
        blocks: ['first', 'second'],
        batchId: 'batch-1',
        messageId: 'message-1'
      },
      lastError: 'Batch stopped after `read_file` failed: Blocked path.',
      logEvent: {
        level: 'warn',
        message: 'Batch stopped after a failure in read_file.'
      }
    });
  });

  it('does not invent retry recovery for completed batches with failures', () => {
    const outcome = deriveBatchDeliveryOutcome({
      response: {
        type: 'tool_result_batch',
        ok: false,
        batchId: 'batch-2',
        items: [
          {
            index: 0,
            tool: 'read_file',
            callId: 'call-read',
            ok: false,
            error: { code: 'BLOCKED_PATH', message: 'Blocked path.' },
            warnings: [],
            durationMs: 3
          }
        ],
        warnings: [],
        summary: {
          total: 1,
          completed: 0,
          failed: 1,
          skipped: 0,
          stoppedOnFailure: false
        }
      },
      blocks: ['first'],
      batchId: 'batch-2',
      messageId: 'message-2'
    });

    expect(outcome).toEqual({
      readyStatus: 'batch_result_ready',
      lastError: 'Batch completed with failures. First failed tool: `read_file` (Blocked path.)',
      logEvent: {
        level: 'warn',
        message: 'Batch completed with 1 failed tool call(s).'
      }
    });
  });
});
