import { describe, expect, it } from 'vitest';
import {
  getDeliveryStatusLabel,
  getDeliveryStatusTone,
  summarizeArgs,
  summarizePendingBlock
} from '../../extension/src/result-delivery/index.js';

describe('result-delivery panel presentation', () => {
  it('renders compact pending argument previews from the extension owner', () => {
    expect(summarizeArgs({ path: 'README.md' })).toBe('path=README.md');
    expect(summarizePendingBlock({
      block: { tool: 'read_file', args: { path: 'README.md' } }
    })).toBe('read_file path=README.md');
  });

  it('truncates longer previews without userscript-local formatting logic', () => {
    const summary = summarizeArgs({
      path: 'docs/very/long/path/that/should/get/truncated.md',
      maxResults: 20,
      context: 3
    }, 32);

    expect(summary.endsWith('...')).toBe(true);
  });

  it('keeps delivery badge tone and label semantics on one owner path', () => {
    expect(getDeliveryStatusTone('batch_stopped_on_failure')).toBe('cwmb-badge-warn');
    expect(getDeliveryStatusLabel('batch_result_ready')).toBe('Batch ready');
    expect(getDeliveryStatusTone('batch_sent')).toBe('cwmb-badge-ok');
    expect(getDeliveryStatusLabel('invalid_mcp_turn')).toBe('Invalid MCP turn');
  });
});
