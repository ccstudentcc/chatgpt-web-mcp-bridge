export interface DeliveryPanelCopy {
  collapsedSummary: string;
  retryBatchLabel: string;
  insertResultLabel: string;
  copyResultLabel: string;
  pendingDisclosureLabel: string;
  resultDisclosureLabel: string;
  resultEmptyState: string;
  recoveryCallout?: string;
}

export function getDeliveryPanelCopy({
  activeCount,
  hasRetryableBatch,
  canInsertResult,
  hasError,
  recoveryKind,
  recoveryMessage
}: {
  activeCount: number;
  hasRetryableBatch: boolean;
  canInsertResult: boolean;
  hasError: boolean;
  recoveryKind?: 'clipboard_fallback' | 'send_button_missing' | 'submission_not_confirmed';
  recoveryMessage?: string;
}): DeliveryPanelCopy {
  return {
    collapsedSummary: getCollapsedSummary({
      activeCount,
      hasRetryableBatch,
      canInsertResult,
      hasError
    }),
    retryBatchLabel: 'Retry whole batch',
    insertResultLabel: recoveryKind === 'clipboard_fallback' ? 'Retry insert' : 'Insert result',
    copyResultLabel: recoveryKind === 'send_button_missing' || recoveryKind === 'submission_not_confirmed'
      ? 'Copy result again'
      : 'Copy result',
    pendingDisclosureLabel: 'Batch / pending details',
    resultDisclosureLabel: 'Last result payload',
    resultEmptyState: 'No result payload yet.',
    recoveryCallout: recoveryMessage
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
