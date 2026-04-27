import { describe, expect, it } from 'vitest';
import { getDeliveryPanelCopy } from '../../extension/src/result-delivery/index.js';

describe('getDeliveryPanelCopy', () => {
  it('summarizes retryable batches and result-ready states from one owner path', () => {
    expect(getDeliveryPanelCopy({
      activeCount: 0,
      hasRetryableBatch: true,
      canInsertResult: true,
      hasError: true
    }).collapsedSummary).toBe('Retryable batch ready');

    expect(getDeliveryPanelCopy({
      activeCount: 0,
      hasRetryableBatch: false,
      canInsertResult: true,
      hasError: false
    }).collapsedSummary).toBe('Result ready');
  });

  it('falls back from pending to error to watching copy in the expected order', () => {
    expect(getDeliveryPanelCopy({
      activeCount: 3,
      hasRetryableBatch: false,
      canInsertResult: false,
      hasError: true
    }).collapsedSummary).toBe('3 pending');

    expect(getDeliveryPanelCopy({
      activeCount: 0,
      hasRetryableBatch: false,
      canInsertResult: false,
      hasError: true
    }).collapsedSummary).toBe('Attention needed');

    expect(getDeliveryPanelCopy({
      activeCount: 0,
      hasRetryableBatch: false,
      canInsertResult: false,
      hasError: false
    }).collapsedSummary).toBe('Watching this chat');
  });

  it('keeps delivery-specific action and disclosure labels centralized', () => {
    expect(getDeliveryPanelCopy({
      activeCount: 0,
      hasRetryableBatch: false,
      canInsertResult: false,
      hasError: false
    })).toMatchObject({
      retryBatchLabel: 'Retry whole batch',
      insertResultLabel: 'Insert result',
      copyResultLabel: 'Copy result',
      pendingDisclosureLabel: 'Batch / pending details',
      resultDisclosureLabel: 'Last result payload',
      resultEmptyState: 'No result payload yet.'
    });
  });

  it('switches recovery copy from one owner path when delivery needs manual follow-up', () => {
    expect(getDeliveryPanelCopy({
      activeCount: 0,
      hasRetryableBatch: false,
      canInsertResult: true,
      hasError: false,
      recoveryKind: 'clipboard_fallback',
      recoveryMessage: 'Tool result was preserved in the clipboard.'
    })).toMatchObject({
      insertResultLabel: 'Retry insert',
      copyResultLabel: 'Copy result',
      recoveryCallout: 'Tool result was preserved in the clipboard.'
    });

    expect(getDeliveryPanelCopy({
      activeCount: 0,
      hasRetryableBatch: false,
      canInsertResult: false,
      hasError: false,
      recoveryKind: 'send_button_missing',
      recoveryMessage: 'Tool result stayed in the composer.'
    })).toMatchObject({
      insertResultLabel: 'Insert result',
      copyResultLabel: 'Copy result again',
      recoveryCallout: 'Tool result stayed in the composer.'
    });
  });
});
