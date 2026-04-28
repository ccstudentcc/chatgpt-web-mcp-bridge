import { describe, expect, it } from 'vitest';
import { PAGE_ORIGIN_HEADER } from '@cwmb/tool-contracts';
import { assertAllowedOrigin } from './origin.js';

describe('assertAllowedOrigin', () => {
  it('allows direct ChatGPT Web origins', () => {
    expect(() => assertAllowedOrigin({ origin: 'https://chatgpt.com' })).not.toThrow();
    expect(() => assertAllowedOrigin({ origin: 'https://chat.openai.com' })).not.toThrow();
  });

  it('allows extension-origin requests when they assert a ChatGPT page origin', () => {
    expect(() =>
      assertAllowedOrigin({
        origin: 'chrome-extension://abcdefghijklmnopabcdefghijklmnop',
        [PAGE_ORIGIN_HEADER.toLowerCase()]: 'https://chatgpt.com'
      })
    ).not.toThrow();
  });

  it('rejects extension-origin requests without a trusted ChatGPT page origin assertion', () => {
    expect(() =>
      assertAllowedOrigin({
        origin: 'chrome-extension://abcdefghijklmnopabcdefghijklmnop'
      })
    ).toThrowError(/origin is not allowed/i);

    expect(() =>
      assertAllowedOrigin({
        origin: 'chrome-extension://abcdefghijklmnopabcdefghijklmnop',
        [PAGE_ORIGIN_HEADER.toLowerCase()]: 'https://example.com'
      })
    ).toThrowError(/origin is not allowed/i);
  });

  it('rejects unrelated web origins', () => {
    expect(() => assertAllowedOrigin({ origin: 'https://example.com' })).toThrowError(/origin is not allowed/i);
  });
});
