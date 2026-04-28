import { describe, expect, it } from 'vitest';
import {
  getPendingTurnRuntimeStatus,
  hasPendingTurnBatch
} from '../../extension/src/turn-runtime/pending-turn-runtime.js';

describe('pending turn runtime helpers', () => {
  it('treats only multi-block selections with a batch id as batch pending work', () => {
    expect(hasPendingTurnBatch(2, 'batch-1')).toBe(true);
    expect(hasPendingTurnBatch(2, undefined)).toBe(false);
    expect(hasPendingTurnBatch(1, 'batch-1')).toBe(false);
  });

  it('maps pending selections to the live detected statuses', () => {
    expect(getPendingTurnRuntimeStatus(0, undefined)).toBe('idle');
    expect(getPendingTurnRuntimeStatus(1, undefined)).toBe('detected');
    expect(getPendingTurnRuntimeStatus(2, 'batch-1')).toBe('detected_batch');
  });
});
