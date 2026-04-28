import type { BatchResultEnvelope } from '@cwmb/result-model';
import { describeBatchFailure } from './batch-outcome-presentation.js';
import type { DeliveryLogEvent } from './composer-delivery.js';
import type { ReadyDeliveryStatus } from './delivery-state.js';

export interface RetryableDeliveryBatch<TBlock> {
  blocks: TBlock[];
  batchId: string;
  messageId: string;
}

export interface BatchDeliveryOutcome<TBlock> {
  readyStatus: ReadyDeliveryStatus;
  retryableBatch?: RetryableDeliveryBatch<TBlock>;
  lastError?: string;
  logEvent: DeliveryLogEvent;
}

export function deriveBatchDeliveryOutcome<TBlock>({
  response,
  blocks,
  batchId,
  messageId
}: {
  response: BatchResultEnvelope;
  blocks: TBlock[];
  batchId: string;
  messageId: string;
}): BatchDeliveryOutcome<TBlock> {
  if (!response.ok && response.summary.stoppedOnFailure) {
    const failurePresentation = describeBatchFailure(response.items, true, response.summary.failed);
    return {
      readyStatus: 'batch_stopped_on_failure',
      retryableBatch: {
        blocks,
        batchId,
        messageId
      },
      lastError: failurePresentation.lastError,
      logEvent: {
        level: 'warn',
        message: failurePresentation.logMessage
      }
    };
  }

  if (!response.ok) {
    const failurePresentation = describeBatchFailure(response.items, false, response.summary.failed);
    return {
      readyStatus: 'batch_result_ready',
      lastError: failurePresentation.lastError,
      logEvent: {
        level: 'warn',
        message: failurePresentation.logMessage
      }
    };
  }

  return {
    readyStatus: 'batch_result_ready',
    logEvent: {
      level: 'success',
      message: `Batch completed: ${response.summary.completed} tool call(s).`
    }
  };
}
