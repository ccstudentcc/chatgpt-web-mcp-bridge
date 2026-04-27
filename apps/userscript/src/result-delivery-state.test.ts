import { describe, expect, it } from 'vitest';
import {
  deriveDeliveryPanelState,
  resolveDeliveredBridgeStatus
} from '../../extension/src/result-delivery/index.js';

describe('deriveDeliveryPanelState', () => {
  it('keeps retryable batch visibility and manual insert availability on one owner path', () => {
    const retryBlocks = [
      { block: { tool: 'read_file', args: { path: 'README.md' } }, raw: '{}', callId: 'call-read' },
      { block: { tool: 'grep_files', args: { query: 'todo' } }, raw: '{}', callId: 'call-grep' }
    ];

    const panel = deriveDeliveryPanelState({
      status: 'batch_stopped_on_failure',
      lastResult: 'batch-result',
      pending: [],
      pendingBatchId: undefined,
      retryableBatch: { blocks: retryBlocks }
    });

    expect(panel.hasRetryableBatch).toBe(true);
    expect(panel.visibleBatch).toEqual(retryBlocks);
    expect(panel.activeBlocks).toEqual(retryBlocks);
    expect(panel.canInsertResult).toBe(true);
    expect(panel.readyStatus).toBe('batch_stopped_on_failure');
    expect(panel.isBatchReady).toBe(true);
  });

  it('falls back to single-result ready state when no retryable batch remains', () => {
    const panel = deriveDeliveryPanelState({
      status: 'inserted',
      lastResult: 'single-result',
      pending: [],
      pendingBatchId: undefined,
      retryableBatch: undefined
    });

    expect(panel.readyStatus).toBe('result_ready');
    expect(panel.canInsertResult).toBe(false);
    expect(panel.isBatchReady).toBe(false);
  });
});

describe('resolveDeliveredBridgeStatus', () => {
  it('maps batch delivery phases back to batch bridge statuses', () => {
    expect(resolveDeliveredBridgeStatus('batch_result_ready', 'inserted')).toBe('batch_inserted');
    expect(resolveDeliveredBridgeStatus('batch_result_ready', 'sent')).toBe('batch_sent');
  });

  it('preserves failed single-result readiness when insertion still falls back', () => {
    expect(resolveDeliveredBridgeStatus('failed', 'ready')).toBe('failed');
  });
});
