import { describe, expect, it } from 'vitest';
import { summarizeAuditArgs, summarizeAuditResult } from './summary.js';

describe('audit-log summary', () => {
  it('keeps safe path literals while redacting sensitive content fields', () => {
    expect(summarizeAuditArgs({
      path: 'docs/readme.md',
      content: 'token=super-secret-value',
      mode: 'replace'
    })).toEqual({
      type: 'object',
      keys: ['path', 'content', 'mode'],
      entries: {
        path: { type: 'string', chars: 14, value: 'docs/readme.md' },
        content: { type: 'string', chars: 24, redacted: true },
        mode: { type: 'string', chars: 7, value: 'replace' }
      },
      truncatedKeys: 0
    });
  });

  it('never keeps raw result text when summarizing durable audit truth', () => {
    expect(summarizeAuditResult({
      text: 'password=hunter2',
      entries: ['docs', 'src']
    })).toEqual({
      type: 'object',
      keys: ['text', 'entries'],
      entries: {
        text: { type: 'string', chars: 16, redacted: true },
        entries: {
          type: 'array',
          length: 2,
          items: [
            { type: 'string', chars: 4 },
            { type: 'string', chars: 3 }
          ],
          truncatedItems: 0
        }
      },
      truncatedKeys: 0
    });
  });
});
