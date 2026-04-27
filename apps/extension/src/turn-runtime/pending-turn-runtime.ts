export type PendingTurnRuntimeStatus = 'idle' | 'detected' | 'detected_batch';

export function hasPendingTurnBatch(pendingCount: number, pendingBatchId?: string): boolean {
  return pendingCount > 1 && Boolean(pendingBatchId);
}

export function getPendingTurnRuntimeStatus(
  pendingCount: number,
  pendingBatchId?: string
): PendingTurnRuntimeStatus {
  if (hasPendingTurnBatch(pendingCount, pendingBatchId)) {
    return 'detected_batch';
  }

  return pendingCount > 0 ? 'detected' : 'idle';
}
