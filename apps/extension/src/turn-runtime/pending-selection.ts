export function isSamePendingSelection(
  currentCallIds: string[],
  currentBatchId: string | undefined,
  nextCallIds: string[],
  nextBatchId: string | undefined
): boolean {
  if (nextCallIds.length !== currentCallIds.length) {
    return false;
  }
  if (nextBatchId !== currentBatchId) {
    return false;
  }

  return nextCallIds.every((callId, index) => callId === currentCallIds[index]);
}
