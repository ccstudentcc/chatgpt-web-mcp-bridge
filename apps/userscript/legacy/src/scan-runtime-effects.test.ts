import { describe, expect, it } from 'vitest';
import {
  createInvalidTurnRuntimeUpdate,
  createPendingDetectionUpdate,
  resetPendingDetectionRuntime
} from '../../extension/src/turn-runtime/scan-runtime-effects.js';

describe('scan runtime effects', () => {
  it('clears pending detection only when execution and retry state allow it', () => {
    expect(resetPendingDetectionRuntime({
      status: 'detected',
      hasRetryableBatch: false
    })).toEqual({
      shouldClear: true,
      nextStatus: 'idle'
    });

    expect(resetPendingDetectionRuntime({
      status: 'executing',
      hasRetryableBatch: false
    })).toEqual({
      shouldClear: false,
      nextStatus: 'executing'
    });
  });

  it('creates pending detection updates from pending blocks and request identity', () => {
    const next = [{ callId: 'call-1' }, { callId: 'call-2' }];

    expect(createPendingDetectionUpdate({
      pending: next,
      messageId: 'assistant-1',
      batchId: 'batch-1',
      requestId: 'user-1'
    })).toEqual({
      pending: next,
      pendingMessageId: 'assistant-1',
      pendingBatchId: 'batch-1',
      pendingRequestId: 'user-1',
      lastInvalidMcpMessageId: undefined,
      lastError: undefined,
      progress: undefined,
      retryableBatch: undefined,
      status: 'detected_batch'
    });
  });

  it('marks only changed invalid turns as new warnings', () => {
    expect(createInvalidTurnRuntimeUpdate({
      lastInvalidMcpMessageId: 'assistant-1',
      lastError: 'bad turn',
      messageId: 'assistant-1',
      invalidReason: 'bad turn'
    }).isNewInvalidTurn).toBe(false);

    expect(createInvalidTurnRuntimeUpdate({
      lastInvalidMcpMessageId: 'assistant-1',
      lastError: 'bad turn',
      messageId: 'assistant-2',
      invalidReason: 'bad turn'
    }).isNewInvalidTurn).toBe(true);
  });
});
