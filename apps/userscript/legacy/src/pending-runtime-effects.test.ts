import { describe, expect, it } from 'vitest';
import {
  clearPendingSelectionRuntime,
  consumeFirstPendingRuntime,
  createIgnoredPendingRuntimeUpdate
} from '../../extension/src/turn-runtime/pending-runtime-effects.js';

describe('pending runtime effects', () => {
  it('clears pending selection metadata', () => {
    expect(clearPendingSelectionRuntime()).toEqual({
      pending: [],
      pendingBatchId: undefined,
      pendingMessageId: undefined,
      pendingRequestId: undefined
    });
  });

  it('consumes the first pending tool call and keeps the rest pending', () => {
    expect(consumeFirstPendingRuntime([
      { callId: 'call-1' },
      { callId: 'call-2' }
    ])).toEqual({
      pending: [{ callId: 'call-2' }],
      pendingBatchId: undefined,
      pendingMessageId: undefined,
      pendingRequestId: undefined,
      executedCallId: 'call-1'
    });
  });

  it('creates ignored runtime updates for both single and batch pending selections', () => {
    expect(createIgnoredPendingRuntimeUpdate({
      pending: [
        {
          callId: 'call-1',
          block: { tool: 'read_file' }
        }
      ]
    })).toEqual({
      pending: [],
      pendingBatchId: undefined,
      pendingMessageId: undefined,
      pendingRequestId: undefined,
      ignoredKind: 'single',
      ignoredTool: 'read_file',
      executedCallIds: ['call-1'],
      status: 'idle'
    });

    expect(createIgnoredPendingRuntimeUpdate({
      pending: [
        {
          callId: 'call-1',
          block: { tool: 'read_file' }
        },
        {
          callId: 'call-2',
          block: { tool: 'grep_files' }
        }
      ],
      pendingBatchId: 'batch-1'
    })).toEqual({
      pending: [],
      pendingBatchId: undefined,
      pendingMessageId: undefined,
      pendingRequestId: undefined,
      ignoredKind: 'batch',
      executedCallIds: ['call-1', 'call-2'],
      executedBatchId: 'batch-1',
      status: 'idle'
    });
  });
});
