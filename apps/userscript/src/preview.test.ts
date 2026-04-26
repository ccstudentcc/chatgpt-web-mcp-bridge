import { describe, expect, it } from 'vitest';
import { summarizeArgs, summarizePendingBlock } from './preview.js';

describe('summarizeArgs', () => {
  it('renders compact key-value previews for simple args', () => {
    expect(summarizeArgs({ path: 'README.md' })).toBe('path=README.md');
    expect(summarizeArgs({ pattern: 'todo', glob: '**/*.ts' })).toBe('pattern=todo, glob=**/*.ts');
  });

  it('truncates longer previews and marks omitted values', () => {
    const summary = summarizeArgs({
      path: 'docs/very/long/path/that/should/get/truncated.md',
      maxResults: 20,
      context: 3
    }, 32);

    expect(summary.endsWith('...')).toBe(true);
  });
});

describe('summarizePendingBlock', () => {
  it('combines tool name and summarized args', () => {
    expect(summarizePendingBlock({
      block: { tool: 'read_file', args: { path: 'README.md' } },
      raw: '{"tool":"read_file","args":{"path":"README.md"}}',
      callId: 'call-read'
    })).toBe('read_file path=README.md');
  });
});
