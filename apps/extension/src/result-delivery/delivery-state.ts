import {
  matchesRecoveredComposerState,
  resolveRecoveredComposerDraft,
  type DeliveryPhase
} from './composer-delivery.js';

export type DeliveryBridgeStatus =
  | 'failed'
  | 'result_ready'
  | 'batch_result_ready'
  | 'batch_stopped_on_failure'
  | 'inserted'
  | 'batch_inserted'
  | 'sent'
  | 'batch_sent'
  | 'idle'
  | 'detected'
  | 'detected_batch'
  | 'executing'
  | 'batch_executing'
  | 'disconnected'
  | 'unauthorized'
  | 'invalid_mcp_turn';

export type ReadyDeliveryStatus = Extract<
  DeliveryBridgeStatus,
  'failed' | 'result_ready' | 'batch_result_ready' | 'batch_stopped_on_failure'
>;

export interface RecoveredDeliveryRuntimeState {
  shouldResume: boolean;
  shouldDeferPendingDetection: boolean;
  nextPreservedDraft?: string;
}

export function shouldKeepRecoveredDeliveryRetryWindow({
  status,
  lastResult,
  autoSend
}: {
  status: DeliveryBridgeStatus;
  lastResult?: string;
  autoSend: boolean;
}): boolean {
  return autoSend
    && Boolean(lastResult)
    && (status === 'inserted' || status === 'batch_inserted');
}

export interface DeliveryPanelState<TBlock> {
  activeBlocks: TBlock[];
  visibleBatch: TBlock[];
  hasRetryableBatch: boolean;
  canInsertResult: boolean;
  readyStatus: ReadyDeliveryStatus;
  isPendingBatch: boolean;
  isBatchReady: boolean;
}

export function deriveDeliveryPanelState<TBlock>({
  status,
  lastResult,
  pending,
  pendingBatchId,
  retryableBatch
}: {
  status: DeliveryBridgeStatus;
  lastResult?: string;
  pending: TBlock[];
  pendingBatchId?: string;
  retryableBatch?: { blocks: TBlock[] };
}): DeliveryPanelState<TBlock> {
  const isPendingBatch = pending.length > 1 && Boolean(pendingBatchId);
  const hasRetryableBatch = Boolean(retryableBatch);
  const visibleBatch = isPendingBatch ? pending : retryableBatch?.blocks ?? [];

  return {
    activeBlocks: pending.length > 0 ? pending : visibleBatch,
    visibleBatch,
    hasRetryableBatch,
    canInsertResult: Boolean(lastResult) && isReadyDeliveryStatus(status),
    readyStatus: deriveReadyDeliveryStatus(status, hasRetryableBatch),
    isPendingBatch,
    isBatchReady: isBatchReadyDeliveryStatus(status)
  };
}

export function deriveReadyDeliveryStatus(
  status: DeliveryBridgeStatus,
  hasRetryableBatch: boolean
): ReadyDeliveryStatus {
  if (isReadyDeliveryStatus(status)) {
    return status;
  }

  return hasRetryableBatch ? 'batch_result_ready' : 'result_ready';
}

export function isReadyDeliveryStatus(status: DeliveryBridgeStatus): status is ReadyDeliveryStatus {
  return status === 'result_ready'
    || status === 'batch_result_ready'
    || status === 'batch_stopped_on_failure'
    || status === 'failed';
}

export function isBatchReadyDeliveryStatus(status: ReadyDeliveryStatus | DeliveryBridgeStatus): boolean {
  return status === 'batch_result_ready' || status === 'batch_stopped_on_failure';
}

export function resolveDeliveredBridgeStatus(
  readyStatus: ReadyDeliveryStatus,
  phase: DeliveryPhase
): DeliveryBridgeStatus {
  if (phase === 'ready') {
    return readyStatus;
  }

  if (phase === 'sent') {
    return isBatchReadyDeliveryStatus(readyStatus) ? 'batch_sent' : 'sent';
  }

  return isBatchReadyDeliveryStatus(readyStatus) ? 'batch_inserted' : 'inserted';
}

export function deriveRecoveredDeliveryRuntimeState({
  status,
  lastResult,
  autoSend,
  currentComposerText,
  composerSnapshot,
  preservedDraft,
  hasMatchingPersistedSession
}: {
  status: DeliveryBridgeStatus;
  lastResult?: string;
  autoSend: boolean;
  currentComposerText: string;
  composerSnapshot?: string;
  preservedDraft?: string;
  hasMatchingPersistedSession: boolean;
}): RecoveredDeliveryRuntimeState {
  if ((status !== 'inserted' && status !== 'batch_inserted') || !lastResult) {
    return {
      shouldResume: false,
      shouldDeferPendingDetection: false,
      nextPreservedDraft: preservedDraft
    };
  }

  return {
    shouldResume: autoSend,
    shouldDeferPendingDetection: hasMatchingPersistedSession
      && matchesRecoveredComposerState({
        currentText: currentComposerText,
        payload: lastResult,
        composerSnapshot
      }),
    nextPreservedDraft: resolveRecoveredComposerDraft({
      currentText: currentComposerText,
      payload: lastResult,
      composerSnapshot,
      preservedDraft
    })
  };
}
