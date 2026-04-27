import { describe, expect, it } from 'vitest';
import { describeBatchFailure } from '../../extension/src/result-delivery/index.js';

describe('describeBatchFailure', () => {
  it('describes stopped-on-failure batches from one owner path', () => {
    const presentation = describeBatchFailure([
      {
        index: 0,
        tool: 'read_file',
        callId: 'call-read',
        ok: false,
        error: { code: 'BLOCKED_PATH', message: 'Blocked path.' },
        warnings: [],
        durationMs: 3
      }
    ], true, 1);

    expect(presentation).toEqual({
      lastError: 'Batch stopped after `read_file` failed: Blocked path.',
      logMessage: 'Batch stopped after a failure in read_file.'
    });
  });

  it('describes partially failed batches without inventing execution semantics', () => {
    const presentation = describeBatchFailure([
      {
        index: 0,
        tool: 'read_file',
        callId: 'call-read',
        ok: false,
        error: { code: 'BLOCKED_PATH', message: 'Blocked path.' },
        warnings: [],
        durationMs: 3
      }
    ], false, 2);

    expect(presentation).toEqual({
      lastError: 'Batch completed with failures. First failed tool: `read_file` (Blocked path.)',
      logMessage: 'Batch completed with 2 failed tool call(s).'
    });
  });
});
