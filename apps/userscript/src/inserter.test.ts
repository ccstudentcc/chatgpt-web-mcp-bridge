import { describe, expect, it } from 'vitest';
import { formatBatchToolResult } from './inserter.js';

describe('formatBatchToolResult', () => {
  it('renders a batch summary and fenced tool_result_batch block', () => {
    const output = formatBatchToolResult({
      type: 'tool_result_batch',
      ok: false,
      batchId: 'batch-1',
      source: {
        messageId: 'assistant-1'
      },
      summary: {
        total: 3,
        completed: 1,
        failed: 1,
        skipped: 1,
        stoppedOnFailure: true
      },
      items: [],
      warnings: ['Result truncated from 1000 chars.']
    });

    expect(output).toContain('Batch tool results for one assistant reply:');
    expect(output).toContain('- total: 3');
    expect(output).toContain('```tool_result_batch');
    expect(output).toContain('"batchId": "batch-1"');
    expect(output).toContain('Please continue based on the batch tool results above.');
  });
});
