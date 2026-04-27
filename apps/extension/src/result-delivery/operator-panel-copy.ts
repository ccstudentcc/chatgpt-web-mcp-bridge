export interface DeliveryPanelCopy {
  collapsedSummary: string;
  retryBatchLabel: string;
  insertResultLabel: string;
  copyResultLabel: string;
  pendingDisclosureLabel: string;
  resultDisclosureLabel: string;
  resultEmptyState: string;
}

export function getDeliveryPanelCopy({
  activeCount,
  hasRetryableBatch,
  canInsertResult,
  hasError
}: {
  activeCount: number;
  hasRetryableBatch: boolean;
  canInsertResult: boolean;
  hasError: boolean;
}): DeliveryPanelCopy {
  return {
    collapsedSummary: getCollapsedSummary({
      activeCount,
      hasRetryableBatch,
      canInsertResult,
      hasError
    }),
    retryBatchLabel: 'Retry whole batch',
    insertResultLabel: 'Insert result',
    copyResultLabel: 'Copy result',
    pendingDisclosureLabel: 'Batch / pending details',
    resultDisclosureLabel: 'Last result payload',
    resultEmptyState: 'No result payload yet.'
  };
}

function getCollapsedSummary({
  activeCount,
  hasRetryableBatch,
  canInsertResult,
  hasError
}: {
  activeCount: number;
  hasRetryableBatch: boolean;
  canInsertResult: boolean;
  hasError: boolean;
}): string {
  if (activeCount > 0) {
    return `${activeCount} pending`;
  }

  if (hasRetryableBatch) {
    return 'Retryable batch ready';
  }

  if (canInsertResult) {
    return 'Result ready';
  }

  if (hasError) {
    return 'Attention needed';
  }

  return 'Watching this chat';
}
