import { describe, expect, it } from 'vitest';
import {
  deriveDeliveryPanelState,
  deriveRecoveredDeliveryRuntimeState,
  resolveDeliveredBridgeStatus,
  shouldKeepRecoveredDeliveryRetryWindow
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

describe('deriveRecoveredDeliveryRuntimeState', () => {
  it('resumes authoritative send without deferring when the recovered composer is empty', () => {
    const recovered = deriveRecoveredDeliveryRuntimeState({
      status: 'inserted',
      lastResult: 'tool-result',
      autoSend: true,
      currentComposerText: '',
      composerSnapshot: undefined,
      preservedDraft: undefined,
      hasMatchingPersistedSession: false
    });

    expect(recovered.shouldResume).toBe(true);
    expect(recovered.shouldDeferPendingDetection).toBe(false);
    expect(recovered.nextPreservedDraft).toBeUndefined();
  });

  it('preserves unrelated drafts for recovered send while allowing new detection after the composer diverges', () => {
    const recovered = deriveRecoveredDeliveryRuntimeState({
      status: 'inserted',
      lastResult: [
        'Bridge tool result for `read_file`:',
        'This result was executed outside the model after your previous `mcp` reply.',
        '',
        '```tool_result',
        '{}',
        '```'
      ].join('\n'),
      autoSend: true,
      currentComposerText: 'my unrelated draft',
      composerSnapshot: undefined,
      preservedDraft: undefined,
      hasMatchingPersistedSession: false
    });

    expect(recovered.shouldResume).toBe(true);
    expect(recovered.shouldDeferPendingDetection).toBe(false);
    expect(recovered.nextPreservedDraft).toBe('my unrelated draft');
  });

  it('keeps defer active only while the composer still matches bridge-owned residue', () => {
    const recovered = deriveRecoveredDeliveryRuntimeState({
      status: 'inserted',
      lastResult: [
        'Bridge tool result for `read_file`:',
        'This result was executed outside the model after your previous `mcp` reply.',
        '',
        '```tool_result',
        '{}',
        '```'
      ].join('\n'),
      autoSend: false,
      currentComposerText: 'This result was executed outside the model after your previous `mcp` reply.',
      composerSnapshot: 'This result was executed outside the model after your previous `mcp` reply.',
      preservedDraft: 'kept draft',
      hasMatchingPersistedSession: true
    });

    expect(recovered.shouldResume).toBe(false);
    expect(recovered.shouldDeferPendingDetection).toBe(true);
    expect(recovered.nextPreservedDraft).toBe('kept draft');
  });
});

describe('shouldKeepRecoveredDeliveryRetryWindow', () => {
  it('keeps the startup retry window active while an auto-send recovery is still inserted', () => {
    expect(shouldKeepRecoveredDeliveryRetryWindow({
      status: 'inserted',
      lastResult: 'tool-result',
      autoSend: true
    })).toBe(true);
  });

  it('closes the startup retry window once recovery no longer needs auto-send retry', () => {
    expect(shouldKeepRecoveredDeliveryRetryWindow({
      status: 'sent',
      lastResult: 'tool-result',
      autoSend: true
    })).toBe(false);
    expect(shouldKeepRecoveredDeliveryRetryWindow({
      status: 'inserted',
      lastResult: 'tool-result',
      autoSend: false
    })).toBe(false);
  });
});
