import { getPendingTurnRuntimeStatus, type PendingTurnRuntimeStatus } from './pending-turn-runtime.js';

export type ScanRuntimeStatus =
  | PendingTurnRuntimeStatus
  | 'executing'
  | 'batch_executing'
  | 'invalid_mcp_turn';

export interface PendingDetectionReset {
  shouldClear: boolean;
  nextStatus: ScanRuntimeStatus;
}

export interface PendingDetectionUpdate<TBlock> {
  pending: TBlock[];
  pendingMessageId: string;
  pendingBatchId?: string;
  pendingRequestId: string;
  lastInvalidMcpMessageId?: undefined;
  lastError?: undefined;
  progress?: undefined;
  retryableBatch?: undefined;
  status: PendingTurnRuntimeStatus;
}

export interface InvalidTurnRuntimeUpdate {
  lastInvalidMcpMessageId: string;
  lastError: string;
  status: 'invalid_mcp_turn';
  isNewInvalidTurn: boolean;
}

export function resetPendingDetectionRuntime<TStatus extends string>({
  status,
  hasRetryableBatch
}: {
  status: TStatus;
  hasRetryableBatch: boolean;
}): {
  shouldClear: boolean;
  nextStatus: TStatus | 'idle';
} {
  if (status === 'executing' || status === 'batch_executing' || hasRetryableBatch) {
    return {
      shouldClear: false,
      nextStatus: status
    };
  }

  return {
    shouldClear: true,
    nextStatus: status === 'detected' || status === 'detected_batch' || status === 'invalid_mcp_turn'
      ? 'idle'
      : status
  };
}

export function createPendingDetectionUpdate<TBlock>({
  pending,
  messageId,
  batchId,
  requestId
}: {
  pending: TBlock[];
  messageId: string;
  batchId?: string;
  requestId: string;
}): PendingDetectionUpdate<TBlock> {
  return {
    pending,
    pendingMessageId: messageId,
    pendingBatchId: batchId,
    pendingRequestId: requestId,
    lastInvalidMcpMessageId: undefined,
    lastError: undefined,
    progress: undefined,
    retryableBatch: undefined,
    status: getPendingTurnRuntimeStatus(pending.length, batchId)
  };
}

export function createInvalidTurnRuntimeUpdate({
  lastInvalidMcpMessageId,
  lastError,
  messageId,
  invalidReason
}: {
  lastInvalidMcpMessageId?: string;
  lastError?: string;
  messageId: string;
  invalidReason: string;
}): InvalidTurnRuntimeUpdate {
  return {
    lastInvalidMcpMessageId: messageId,
    lastError: invalidReason,
    status: 'invalid_mcp_turn',
    isNewInvalidTurn: lastInvalidMcpMessageId !== messageId || lastError !== invalidReason
  };
}
